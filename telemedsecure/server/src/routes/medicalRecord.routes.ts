import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { encryptDataEnvelope, decryptDataEnvelope } from '../utils/crypto';
import { rulesEngine } from '../services/rulesEngine.service';
import { gdprService } from '../services/gdpr.service';
import { createChainedAuditEvent } from '../services/audit.service';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

/**
 * GET /api/v1/medical-records
 * List medical records (subject to role filters, bulk access tracking, and off-hours checks)
 */
router.get('/', async (req, res) => {
  const user = (req as any).user;
  const { patientId, limit } = req.query;

  // Off-hours check
  if (rulesEngine.isOffHours() || req.headers['x-simulate-off-hours'] === 'true') {
    await rulesEngine.triggerViolation({
      ruleId: 'OFF_HOURS_ACCESS',
      description: `User ${user.email} queried medical records outside standard operating hours (07:00 - 20:00).`,
      userId: user.id,
      sourceIp: req.ip,
      resource: 'MedicalRecords:List',
    });
  }

  // Bulk access check
  const requestedCount = limit ? parseInt(limit as string, 10) : 10;
  await rulesEngine.trackRecordAccess(user.id, requestedCount, req.ip || 'unknown', 'MedicalRecords:List');

  let whereClause: any = {};
  if (user.role === Role.PATIENT) {
    whereClause.patientId = user.id;
  } else if (patientId) {
    whereClause.patientId = patientId as string;
  }

  if (user.role === Role.ADMIN) {
    // Admins only see metadata
    const records = await prisma.medicalRecord.findMany({
      where: whereClause,
      select: { id: true, patientId: true, createdAt: true, updatedAt: true },
      take: requestedCount,
    });
    return res.json(records);
  }

  const records = await prisma.medicalRecord.findMany({
    where: whereClause,
    take: requestedCount,
    orderBy: { createdAt: 'desc' },
  });

  res.json(records.map(r => ({
    id: r.id,
    patientId: r.patientId,
    createdAt: r.createdAt,
    hasCiphertext: Boolean(r.encryptedData),
  })));
});

/**
 * POST /api/v1/medical-records
 * Create a new encrypted medical record
 */
router.post('/', requireRole([Role.DOCTOR, Role.NURSE]), async (req, res) => {
  const { patientId, data, unencryptedPhi } = req.body;
  const user = (req as any).user;

  // 1. Check for unencrypted PHI leak in payload
  const phiCheck = rulesEngine.detectUnencryptedPhi(unencryptedPhi || (typeof data === 'string' ? data : ''));
  if (phiCheck.detected) {
    await rulesEngine.triggerViolation({
      ruleId: 'UNENCRYPTED_PHI_DETECTED',
      description: `Unencrypted Protected Health Information (${phiCheck.patternMatched}: ${phiCheck.snippets.join(', ')}) detected in submission payload.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `MedicalRecord:Draft`,
      metadata: { matchedSnippets: phiCheck.snippets },
    });
  }

  // 2. Check GDPR consent
  const hasConsent = await gdprService.hasActiveConsent(patientId, 'TELEMEDICINE_TREATMENT');
  if (!hasConsent) {
    await rulesEngine.triggerViolation({
      ruleId: 'CONSENT_MISSING',
      description: `Attempted to create medical record for patient ${patientId} without active GDPR consent for TELEMEDICINE_TREATMENT.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Patient:${patientId}`,
    });
    return res.status(403).json({
      error: 'GDPR Compliance Error: Patient has not granted active consent for health data processing.',
    });
  }

  // 3. Off-hours check
  if (rulesEngine.isOffHours() || req.headers['x-simulate-off-hours'] === 'true') {
    await rulesEngine.triggerViolation({
      ruleId: 'OFF_HOURS_ACCESS',
      description: `Doctor ${user.email} created medical record outside standard operating hours.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Patient:${patientId}`,
    });
  }

  const { encryptedDek, dekIv, dekAuthTag, ciphertext, iv, authTag } = encryptDataEnvelope(JSON.stringify(data));

  const record = await prisma.medicalRecord.create({
    data: { patientId, encryptedData: ciphertext, dataIv: iv, dataAuthTag: authTag, encryptedDek, dekIv, dekAuthTag },
  });

  await createChainedAuditEvent({
    action: 'CREATE_MEDICAL_RECORD',
    resource: `MedicalRecord:${record.id}`,
    userId: user.id,
    ipAddress: req.ip || 'unknown',
  });

  res.status(201).json({ id: record.id, message: 'Medical record securely created with envelope encryption' });
});

/**
 * GET /api/v1/medical-records/:id
 * Retrieve and decrypt medical record
 */
router.get('/:id', async (req, res) => {
  const recordId = req.params.id;
  const user = (req as any).user;

  const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
  if (!record) return res.status(404).json({ error: 'Not found' });

  // Rule Check: Admin attempting to access clinical plaintext
  if (user.role === Role.ADMIN) {
    await rulesEngine.triggerViolation({
      ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
      description: `Administrator ${user.email} attempted to inspect decrypted clinical content of MedicalRecord:${recordId}`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `MedicalRecord:${recordId}`,
    });
    return res.status(403).json({ error: 'Access denied: Administrators cannot view clinical content' });
  }

  // Rule Check: Patient accessing another patient's record
  if (user.role === Role.PATIENT && record.patientId !== user.id) {
    await rulesEngine.triggerViolation({
      ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
      description: `Patient ${user.id} attempted unauthorized access to MedicalRecord:${recordId} belonging to patient ${record.patientId}`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `MedicalRecord:${recordId}`,
    });
    return res.status(403).json({ error: 'Access denied' });
  }

  // Rule Check: Doctor accessing record of patient without assignment/consultation
  if (user.role === Role.DOCTOR) {
    const consultation = await prisma.consultation.findFirst({
      where: { patientId: record.patientId, doctorId: user.id },
    });
    if (!consultation) {
      await rulesEngine.triggerViolation({
        ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
        description: `Doctor ${user.email} attempted access to MedicalRecord:${recordId} for unassigned patient ${record.patientId}`,
        userId: user.id,
        sourceIp: req.ip,
        resource: `MedicalRecord:${recordId}`,
      });
      return res.status(403).json({ error: 'Access denied: You are not assigned to this patient' });
    }
  }

  // Check if data was crypto-shredded
  if (record.encryptedData === '[CRYPTO_SHREDDED_GDPR_ART_17]') {
    return res.status(410).json({
      error: 'Record unavailable: Patient exercised GDPR Art. 17 Right to Erasure. Per-record encryption keys have been crypto-shredded.',
    });
  }

  // Off-hours check
  if (rulesEngine.isOffHours() || req.headers['x-simulate-off-hours'] === 'true') {
    await rulesEngine.triggerViolation({
      ruleId: 'OFF_HOURS_ACCESS',
      description: `User ${user.email} accessed clinical MedicalRecord:${recordId} outside standard operating hours.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `MedicalRecord:${recordId}`,
    });
  }

  const plaintext = decryptDataEnvelope(
    record.encryptedData,
    record.dataIv,
    record.dataAuthTag,
    record.encryptedDek,
    record.dekIv,
    record.dekAuthTag
  );

  await createChainedAuditEvent({
    action: 'READ_MEDICAL_RECORD',
    resource: `MedicalRecord:${recordId}`,
    userId: user.id,
    ipAddress: req.ip || 'unknown',
  });

  res.json({ id: record.id, patientId: record.patientId, data: JSON.parse(plaintext), createdAt: record.createdAt });
});

export default router;
