import { Router } from 'express';
import { PrismaClient, Role, ConsultationStatus, NotificationType } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { encryptDataEnvelope, decryptDataEnvelope } from '../utils/crypto';
import { rulesEngine } from '../services/rulesEngine.service';
import { gdprService } from '../services/gdpr.service';
import { createChainedAuditEvent } from '../services/audit.service';
import { getAccessiblePatientIds, canViewPatient } from '../services/panelAccess.service';
import { notify } from '../services/notification.service';

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
  } else if (user.role === Role.NURSE) {
    // Nurses see only their assigned care-team patients.
    const accessible = await getAccessiblePatientIds(user);
    if (accessible !== null) whereClause = { patientId: { in: accessible } };
  }
  // ADMIN and other staff see all

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
router.get('/patients', requireRole([Role.DOCTOR, Role.NURSE, Role.ADMIN, Role.RECEPTIONIST, Role.CARE_COORDINATOR, Role.TRIAGE_OFFICER, Role.RADIOLOGIST, Role.LAB_TECHNICIAN, Role.PHARMACIST, Role.BILLING_OFFICER]), async (req, res) => {
  try {
    const user = (req as any).user;
    const where: any = { role: Role.PATIENT };
    // Doctors and nurses only see the patients on their own panel; station
    // roles and admins keep the full directory so scheduling does not regress.
    if (user.role === Role.DOCTOR || user.role === Role.NURSE) {
      const accessible = await getAccessiblePatientIds(user);
      if (accessible !== null) where.id = { in: accessible };
    }
    const patients = await prisma.user.findMany({
      where,
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
        // New self-bookings start as a PENDING request the clinician must action.
        status: ConsultationStatus.PENDING,
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

    // Tell the clinician there is a new booking request awaiting them.
    const when = new Date(scheduledAt).toLocaleString();
    await notify({
      userId: doctorId,
      type: NotificationType.BOOKING_CREATED,
      title: 'New consultation request',
      body: `${user.firstName} ${user.lastName} requested a consultation for ${when}.`,
      link: `/doctor?tab=schedule&consultationId=${consultation.id}`,
      consultationId: consultation.id
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

  // Staff-initiated bookings are already accepted, so surface them to the patient.
  await notify({
    userId: patientId,
    type: NotificationType.BOOKING_ACCEPTED,
    title: 'Appointment scheduled',
    body: `${user.firstName} ${user.lastName} scheduled a consultation for ${new Date(scheduledAt).toLocaleString()}.`,
    link: `/patient?tab=appointments&consultationId=${consultation.id}`,
    consultationId: consultation.id
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

// ---------------------------------------------------------------------------
// Booking lifecycle: accept / decline / reschedule / cancel
//
// A self-booking lands as PENDING. The assigned clinician (or a nurse with
// patient access, or an admin) either accepts or declines it; either way the
// patient is notified. Any still-active booking can be rescheduled by the
// clinician (auto-moves + notifies the patient) or cancelled by either side.
// ---------------------------------------------------------------------------

const CLINICIAN_MANAGER_ROLES = [Role.DOCTOR, Role.NURSE, Role.ADMIN];
const ACTIVE_BOOKING_STATES: ConsultationStatus[] = [
  ConsultationStatus.PENDING,
  ConsultationStatus.CONFIRMED,
  ConsultationStatus.SCHEDULED,
];

/**
 * Can this staff user action the booking? Admins yes; the assigned doctor yes;
 * a nurse only if the patient is on their care panel.
 */
async function canManageBooking(user: any, consultation: any): Promise<boolean> {
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.DOCTOR) return consultation.doctorId === user.id;
  if (user.role === Role.NURSE) return canViewPatient(user, consultation.patientId);
  return false;
}

// Accept a PENDING booking request -> CONFIRMED
router.patch('/:id/accept', requireRole(CLINICIAN_MANAGER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: { doctor: { select: { firstName: true, lastName: true } } },
    });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (consultation.status !== ConsultationStatus.PENDING) {
      return res.status(409).json({ error: 'Only pending requests can be accepted' });
    }
    if (!(await canManageBooking(user, consultation))) {
      return res.status(403).json({ error: 'You are not authorized to action this booking' });
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.CONFIRMED, confirmedAt: new Date() },
    });

    await createChainedAuditEvent({
      action: 'BOOKING_ACCEPTED',
      resource: `Consultation:${id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    await notify({
      userId: consultation.patientId,
      type: NotificationType.BOOKING_ACCEPTED,
      title: 'Appointment confirmed',
      body: `Dr. ${consultation.doctor.lastName} accepted your consultation for ${updated.scheduledAt.toLocaleString()}.`,
      link: `/patient?tab=appointments&consultationId=${id}`,
      consultationId: id,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept booking', details: err.message });
  }
});

// Decline a PENDING booking request -> DECLINED
router.patch('/:id/decline', requireRole(CLINICIAN_MANAGER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const reason: string = (req.body?.reason || '').trim() || 'The clinician is unavailable at this time.';
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: { doctor: { select: { firstName: true, lastName: true } } },
    });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (consultation.status !== ConsultationStatus.PENDING) {
      return res.status(409).json({ error: 'Only pending requests can be declined' });
    }
    if (!(await canManageBooking(user, consultation))) {
      return res.status(403).json({ error: 'You are not authorized to action this booking' });
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.DECLINED, declineReason: reason },
    });

    await createChainedAuditEvent({
      action: 'BOOKING_DECLINED',
      resource: `Consultation:${id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    await notify({
      userId: consultation.patientId,
      type: NotificationType.BOOKING_DECLINED,
      title: 'Appointment declined',
      body: `Dr. ${consultation.doctor.lastName} declined your request: ${reason}`,
      link: `/patient?tab=appointments&consultationId=${id}`,
      consultationId: id,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to decline booking', details: err.message });
  }
});

// Reschedule an active booking -> auto-moves + notifies the patient
router.patch('/:id/reschedule', requireRole(CLINICIAN_MANAGER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const { newScheduledAt, reason } = req.body || {};
    if (!newScheduledAt) {
      return res.status(400).json({ error: 'newScheduledAt is required' });
    }
    const next = new Date(newScheduledAt);
    if (Number.isNaN(next.getTime())) {
      return res.status(400).json({ error: 'newScheduledAt is not a valid date' });
    }
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: { doctor: { select: { firstName: true, lastName: true } } },
    });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (!ACTIVE_BOOKING_STATES.includes(consultation.status)) {
      return res.status(409).json({ error: 'This booking can no longer be rescheduled' });
    }
    if (!(await canManageBooking(user, consultation))) {
      return res.status(403).json({ error: 'You are not authorized to reschedule this booking' });
    }

    const previous = consultation.scheduledAt;
    const wasPending = consultation.status === ConsultationStatus.PENDING;
    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        // A clinician proposing a new time is an implicit acceptance.
        status: ConsultationStatus.CONFIRMED,
        scheduledAt: next,
        confirmedAt: consultation.confirmedAt ?? new Date(),
        rescheduledFrom: previous,
        rescheduledById: user.id,
        rescheduledAt: new Date(),
      },
    });

    await createChainedAuditEvent({
      action: 'BOOKING_RESCHEDULED',
      resource: `Consultation:${id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    const note = (reason || '').trim() ? ` Reason: ${String(reason).trim()}` : '';
    await notify({
      userId: consultation.patientId,
      type: NotificationType.BOOKING_RESCHEDULED,
      title: 'Appointment rescheduled',
      body: `Dr. ${consultation.doctor.lastName} moved your consultation from ${previous.toLocaleString()} to ${next.toLocaleString()}.${note}`,
      link: `/patient?tab=appointments&consultationId=${id}`,
      consultationId: id,
    });

    // If the request was still pending, let the clinician know it was resolved.
    if (wasPending && consultation.doctorId !== user.id) {
      await notify({
        userId: consultation.doctorId,
        type: NotificationType.BOOKING_RESCHEDULED,
        title: 'Your booking was rescheduled',
        body: `Your consultation with the patient on ${previous.toLocaleString()} was moved to ${next.toLocaleString()}.`,
        link: `/doctor?tab=schedule&consultationId=${id}`,
        consultationId: id,
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reschedule booking', details: err.message });
  }
});

// Cancel a booking: the patient (owner) or a managing clinician, from any active state
router.patch('/:id/cancel', async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const reason: string = (req.body?.reason || '').trim() || 'No reason provided.';
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
    });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (!ACTIVE_BOOKING_STATES.includes(consultation.status)) {
      return res.status(409).json({ error: 'This booking can no longer be cancelled' });
    }

    const isPatientOwner = consultation.patientId === user.id;
    const isManager = CLINICIAN_MANAGER_ROLES.includes(user.role) && (await canManageBooking(user, consultation));
    if (!isPatientOwner && !isManager) {
      return res.status(403).json({ error: 'You are not authorized to cancel this booking' });
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        status: ConsultationStatus.CANCELLED,
        cancelReason: reason,
        cancelledById: user.id,
        cancelledAt: new Date(),
      },
    });

    await createChainedAuditEvent({
      action: 'BOOKING_CANCELLED',
      resource: `Consultation:${id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    const byWhom = isPatientOwner
      ? `${consultation.patient.firstName} ${consultation.patient.lastName}`
      : `Dr. ${consultation.doctor.lastName}`;
    // Notify the party that did NOT cancel.
    const recipientId = isPatientOwner ? consultation.doctorId : consultation.patientId;
    await notify({
      userId: recipientId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Appointment cancelled',
      body: `${byWhom} cancelled the consultation scheduled for ${consultation.scheduledAt.toLocaleString()}. Reason: ${reason}`,
      link: isPatientOwner
        ? `/doctor?tab=schedule&consultationId=${id}`
        : `/patient?tab=appointments&consultationId=${id}`,
      consultationId: id,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel booking', details: err.message });
  }
});

export default router;
