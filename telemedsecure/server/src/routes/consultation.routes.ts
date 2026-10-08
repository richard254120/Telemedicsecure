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

router.get('/', async (req, res) => {
  const user = (req as any).user;
  let whereClause: any = {};
  if (user.role === Role.PATIENT) {
    whereClause = { patientId: user.id };
  } else if (user.role === Role.DOCTOR) {
    whereClause = { doctorId: user.id };
  }
  // NURSE and ADMIN see all consultations

  const consultations = await prisma.consultation.findMany({
    where: whereClause,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      doctor: { select: { id: true, firstName: true, lastName: true, email: true } },
      clinicalFlags: true,
      vitalSigns: { select: { id: true, createdAt: true } }
    },
    orderBy: { scheduledAt: 'desc' }
  });
  res.json(consultations);
});

router.post('/', requireRole([Role.DOCTOR, Role.ADMIN]), async (req, res) => {
  const { patientId, scheduledAt } = req.body;
  const doctorId = (req as any).user.id;

  // Rule Check: Consent Missing (GDPR)
  const hasConsent = await gdprService.hasActiveConsent(patientId, 'TELEMEDICINE_TREATMENT');
  if (!hasConsent) {
    await rulesEngine.triggerViolation({
      ruleId: 'CONSENT_MISSING',
      description: `Attempted to schedule consultation for patient ${patientId} without valid GDPR consent.`,
      userId: doctorId,
      sourceIp: req.ip,
      resource: `Patient:${patientId}`,
    });
    return res.status(403).json({
      error: 'GDPR Compliance Error: Patient has not granted active consent for telemedicine treatment.',
    });
  }

  const consultation = await prisma.consultation.create({
    data: { patientId, doctorId, scheduledAt: new Date(scheduledAt) }
  });

  await createChainedAuditEvent({
    action: 'CREATE_CONSULTATION',
    resource: `Consultation:${consultation.id}`,
    userId: doctorId,
    ipAddress: req.ip || 'unknown'
  });
  res.status(201).json(consultation);
});

router.put('/:id/notes', requireRole([Role.DOCTOR]), async (req, res) => {
  const { notes, unencryptedPhi } = req.body;
  const consultationId = req.params.id as string;
  const user = (req as any).user;

  // Rule Check: Unencrypted PHI detection
  const phiCheck = rulesEngine.detectUnencryptedPhi(unencryptedPhi || notes);
  if (phiCheck.detected) {
    await rulesEngine.triggerViolation({
      ruleId: 'UNENCRYPTED_PHI_DETECTED',
      description: `Unencrypted PHI (${phiCheck.patternMatched}: ${phiCheck.snippets.join(', ')}) detected in consultation note body.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Consultation:${consultationId}`,
      metadata: { matchedSnippets: phiCheck.snippets },
    });
  }

  // Off-hours check
  if (rulesEngine.isOffHours() || req.headers['x-simulate-off-hours'] === 'true') {
    await rulesEngine.triggerViolation({
      ruleId: 'OFF_HOURS_ACCESS',
      description: `Doctor ${user.email} updated consultation notes outside standard operating hours.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Consultation:${consultationId}`,
    });
  }

  const { encryptedDek, dekIv, dekAuthTag, ciphertext, iv, authTag } = encryptDataEnvelope(notes);

  await prisma.consultation.update({
    where: { id: consultationId },
    data: { encryptedNotes: ciphertext, notesIv: iv, notesAuthTag: authTag, encryptedDek, dekIv, dekAuthTag }
  });

  await createChainedAuditEvent({
    action: 'UPDATE_NOTES',
    resource: `Consultation:${consultationId}`,
    userId: user.id,
    ipAddress: req.ip || 'unknown'
  });
  res.json({ message: 'Notes securely updated with envelope encryption' });
});

router.get('/:id/notes', async (req, res) => {
  const user = (req as any).user;
  const consultationId = req.params.id as string;

  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  
  if (!consultation) return res.status(404).json({ error: 'Not found' });

  // Rule Check: Access outside role/assignment
  if (user.role === Role.ADMIN || (consultation.patientId !== user.id && consultation.doctorId !== user.id)) {
    await rulesEngine.triggerViolation({
      ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
      description: `User ${user.email} (Role: ${user.role}) attempted unauthorized access to clinical notes of Consultation:${consultationId}`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Consultation:${consultationId}`,
    });
    return res.status(403).json({ error: 'Access denied: You are not authorized to view these notes.' });
  }

  if (!consultation.encryptedNotes) return res.json({ notes: null });

  // Check if data was crypto-shredded
  if (consultation.encryptedNotes === '[CRYPTO_SHREDDED_GDPR_ART_17]') {
    return res.status(410).json({
      error: 'Clinical notes unavailable: Patient exercised GDPR Art. 17 Right to Erasure (Keys crypto-shredded).',
    });
  }

  // Off-hours check
  if (rulesEngine.isOffHours() || req.headers['x-simulate-off-hours'] === 'true') {
    await rulesEngine.triggerViolation({
      ruleId: 'OFF_HOURS_ACCESS',
      description: `User ${user.email} accessed clinical notes outside standard operating hours.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Consultation:${consultationId}`,
    });
  }

  const notes = decryptDataEnvelope(
    consultation.encryptedNotes,
    consultation.notesIv!,
    consultation.notesAuthTag!,
    consultation.encryptedDek!,
    consultation.dekIv!,
    consultation.dekAuthTag!
  );
  
  await createChainedAuditEvent({
    action: 'READ_NOTES',
    resource: `Consultation:${consultationId}`,
    userId: user.id,
    ipAddress: req.ip || 'unknown'
  });
  res.json({ notes });
});

export default router;
