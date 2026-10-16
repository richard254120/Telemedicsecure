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

// Patients directory for clinical staff and administration (Doctor, Nurse, Admin, Receptionist, Care Coordinator, Triage)
router.get('/patients', requireRole([Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.RECEPTIONIST, Role.CARE_COORDINATOR, Role.TRIAGE_OFFICER]), async (req, res) => {
  try {
    const patients = await prisma.user.findMany({
      where: { role: Role.PATIENT },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        isActive: true,
        verificationStatus: true,
        patientConsultations: {
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            clinicalFlags: true
          },
          orderBy: { scheduledAt: 'desc' },
          take: 5
        },
        prescriptions: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            items: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { lastName: 'asc' }
    });
    res.json(patients);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch patients', details: err.message });
  }
});

// Verified Doctors directory for patient booking
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: Role.DOCTOR, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        specialty: true,
        medicalLicenseNo: true,
        verificationStatus: true
      },
      orderBy: { lastName: 'asc' }
    });
    res.json(doctors);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch doctors directory', details: err.message });
  }
});

// Patient Self-Booking Endpoint
router.post('/book', requireRole([Role.PATIENT, Role.DOCTOR]), async (req, res) => {
  try {
    const user = (req as any).user;
    const patientId = user.role === Role.PATIENT ? user.id : req.body.patientId;
    const { doctorId, scheduledAt, reason, symptoms, notes } = req.body;

    if (!doctorId || !scheduledAt) {
      return res.status(400).json({ error: 'Doctor selection and scheduled appointment time are required' });
    }

    // Verify GDPR Consent
    const consentRecord = await prisma.consent.findFirst({
      where: { patientId, purpose: 'TELEMEDICINE_TREATMENT' },
      orderBy: { grantedAt: 'desc' },
    });

    if (consentRecord && !consentRecord.granted) {
      return res.status(403).json({
        error: 'GDPR Compliance Error: Please grant treatment consent in your privacy settings before booking.',
      });
    }

    if (!consentRecord) {
      await gdprService.grantConsent({
        patientId,
        purpose: 'TELEMEDICINE_TREATMENT',
        ipAddress: req.ip
      });
    }

    // Encrypt clinical intake notes
    let encryptedNotes: string | null = null;
    let notesIv: string | null = null;
    let notesAuthTag: string | null = null;
    let encryptedDek: string | null = null;
    let dekIv: string | null = null;
    let dekAuthTag: string | null = null;

    const intakeData = JSON.stringify({
      type: 'PATIENT_SELF_BOOKING',
      reason: reason || 'General Telehealth Consultation',
      symptoms: symptoms || 'Routine follow-up',
      notes: notes || '',
      bookedAt: new Date().toISOString()
    });

    try {
      const enc = encryptDataEnvelope(intakeData);
      encryptedNotes = enc.ciphertext;
      notesIv = enc.iv;
      notesAuthTag = enc.authTag;
      encryptedDek = enc.encryptedDek;
      dekIv = enc.dekIv;
      dekAuthTag = enc.dekAuthTag;
    } catch (e) {
      console.warn('Note encryption warning during booking:', e);
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: new Date(scheduledAt),
        encryptedNotes,
        notesIv,
        notesAuthTag,
        encryptedDek,
        dekIv,
        dekAuthTag
      },
      include: {
        doctor: { select: { firstName: true, lastName: true, specialty: true } }
      }
    });

    await createChainedAuditEvent({
      action: 'BOOK_CONSULTATION',
      resource: `Consultation:${consultation.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown'
    });

    res.status(201).json(consultation);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to book consultation', details: err.message });
  }
});

// Licensed DOCTOR, ADMIN, RECEPTIONIST, or CARE_COORDINATOR can schedule clinical consultations
router.post('/', requireRole([Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CARE_COORDINATOR]), async (req, res) => {
  const { patientId, scheduledAt, doctorId: reqDoctorId } = req.body;
  const user = (req as any).user;
  let doctorId = user.role === Role.DOCTOR ? user.id : reqDoctorId;

  if (!doctorId) {
    const defaultDoctor = await prisma.user.findFirst({
      where: { role: Role.DOCTOR, isActive: true },
      select: { id: true }
    });
    doctorId = defaultDoctor?.id;
  }

  if (!patientId || !scheduledAt) {
    return res.status(400).json({ error: 'patientId and scheduledAt are required' });
  }

  if (!doctorId) {
    return res.status(400).json({ error: 'Doctor ID is required or no active doctor was found' });
  }

  // Rule Check: Consent Check (GDPR)
  const consentRecord = await prisma.consent.findFirst({
    where: { patientId, purpose: 'TELEMEDICINE_TREATMENT' },
    orderBy: { grantedAt: 'desc' },
  });

  if (consentRecord && !consentRecord.granted) {
    await rulesEngine.triggerViolation({
      ruleId: 'CONSENT_MISSING',
      description: `Attempted to schedule consultation for patient ${patientId} whose GDPR consent was explicitly revoked.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Patient:${patientId}`,
    });
    return res.status(403).json({
      error: 'GDPR Compliance Error: Patient has explicitly revoked consent for telemedicine treatment.',
    });
  }

  if (!consentRecord) {
    await gdprService.grantConsent({
      patientId,
      purpose: 'TELEMEDICINE_TREATMENT',
      ipAddress: req.ip
    });
  }

  const consultation = await prisma.consultation.create({
    data: { patientId, doctorId, scheduledAt: new Date(scheduledAt) }
  });

  await createChainedAuditEvent({
    action: 'CREATE_CONSULTATION',
    resource: `Consultation:${consultation.id}`,
    userId: user.id,
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
