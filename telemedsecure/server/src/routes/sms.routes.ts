import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/auth';
import { smsService } from '../services/sms.service';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 1. Get SMS Service Status & Provider Details
router.get('/status', (req: Request, res: Response) => {
  const status = smsService.getStatus();
  res.json(status);
});

// 2. Get SMS Dispatch Logs (Requires Auth)
router.get('/logs', requireAuth, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const logs = smsService.getLogs(limit);
  res.json(logs);
});

// 3. Generic Send SMS Endpoint
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, message, purpose, referenceId } = req.body;
    const user = (req as any).user;

    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient phone number and message body are required' });
    }

    const log = await smsService.sendSMS({
      to,
      message,
      purpose: purpose || 'GENERAL',
      referenceId,
      userId: user?.id,
    });

    res.json({ success: true, log });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Send Instant Consultation Join Link to Patient
router.post('/doctor-ready', requireAuth, async (req: Request, res: Response) => {
  try {
    const { consultationId, patientPhone } = req.body;
    const user = (req as any).user;

    if (!consultationId) {
      return res.status(400).json({ error: 'Consultation ID is required' });
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const recipientPhone = patientPhone || (consultation.patient as any).phone || '+1234567890';
    const doctorName = `${consultation.doctor.firstName} ${consultation.doctor.lastName}`;
    const patientName = `${consultation.patient.firstName} ${consultation.patient.lastName}`;

    const log = await smsService.sendDoctorReadySMS({
      to: recipientPhone,
      patientName,
      doctorName,
      consultationId,
    });

    res.json({
      success: true,
      recipient: recipientPhone,
      log,
      message: `SMS join alert dispatched to ${patientName} (${recipientPhone})`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Send Appointment Schedule Confirmation with Link
router.post('/invite-consultation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { consultationId, patientPhone } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: 'Consultation ID is required' });
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const recipientPhone = patientPhone || (consultation.patient as any).phone || '+1234567890';
    const doctorName = `${consultation.doctor.firstName} ${consultation.doctor.lastName}`;
    const patientName = `${consultation.patient.firstName} ${consultation.patient.lastName}`;

    const log = await smsService.sendAppointmentInviteSMS({
      to: recipientPhone,
      patientName,
      doctorName,
      scheduledAt: consultation.scheduledAt.toISOString(),
      consultationId,
    });

    res.json({
      success: true,
      recipient: recipientPhone,
      log,
      message: `Appointment SMS invitation sent to ${patientName}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Send Prescription Dispensed Alert
router.post('/prescription-alert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { prescriptionId, patientPhone, pharmacyName } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({ error: 'Prescription ID is required' });
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: true,
        consultation: {
          include: {
            patient: true,
          },
        },
      },
    });

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const patient = prescription.consultation.patient;
    const recipientPhone = patientPhone || (patient as any).phone || '+1234567890';
    const patientName = `${patient.firstName} ${patient.lastName}`;

    const log = await smsService.sendPrescriptionDispensedSMS({
      to: recipientPhone,
      patientName,
      rxId: prescriptionId,
      medicationCount: prescription.items.length,
      pharmacyName,
    });

    res.json({
      success: true,
      recipient: recipientPhone,
      log,
      message: `Prescription SMS notification sent to ${patientName}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Send Emergency Clinical Vitals Alert
router.post('/emergency-alert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { doctorPhone, patientName, metric, value, consultationId } = req.body;

    if (!patientName || !metric || !value) {
      return res.status(400).json({ error: 'Patient name, abnormal metric, and value are required' });
    }

    const targetPhone = doctorPhone || process.env.EMERGENCY_ONCALL_PHONE || '+1 (555) 911-DOCS';

    const log = await smsService.sendCriticalVitalsAlertSMS({
      to: targetPhone,
      patientName,
      metric,
      value,
      consultationId,
    });

    res.json({
      success: true,
      recipient: targetPhone,
      log,
      message: `Emergency SMS broadcasted to clinical team (${targetPhone})`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
