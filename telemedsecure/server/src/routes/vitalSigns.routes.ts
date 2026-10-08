import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { encryptDataEnvelope, decryptDataEnvelope } from '../utils/crypto';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

interface VitalsData {
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  temp: number;
  spO2: number;
}

router.post('/', requireRole([Role.DOCTOR, Role.NURSE]), async (req, res) => {
  const { consultationId, vitals } = req.body;
  const v = vitals as VitalsData;

  const { encryptedDek, dekIv, dekAuthTag, ciphertext, iv, authTag } = encryptDataEnvelope(JSON.stringify(vitals));

  const record = await prisma.vitalSign.create({
    data: { consultationId, encryptedVitals: ciphertext, vitalsIv: iv, vitalsAuthTag: authTag, encryptedDek, dekIv, dekAuthTag }
  });

  await prisma.auditEvent.create({
    data: { action: 'CREATE_VITALS', resource: `VitalSign:${record.id}`, userId: (req as any).user.id, ipAddress: req.ip || 'unknown' }
  });

  const flags: string[] = [];
  if (v.bpSystolic > 140 || v.bpDiastolic > 90) flags.push(`Hypertension (${v.bpSystolic}/${v.bpDiastolic})`);
  if (v.heartRate > 100 || v.heartRate < 60) flags.push(`Abnormal HR (${v.heartRate} bpm)`);
  if (v.spO2 < 92) flags.push(`Hypoxia (${v.spO2}%)`);
  if (v.temp > 38) flags.push(`Fever (${v.temp}°C)`);

  if (flags.length > 0) {
    const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (consultation) {
      await prisma.clinicalFlag.create({
        data: {
          consultationId,
          patientId: consultation.patientId,
          flagType: 'ABNORMAL_VITALS',
          description: flags.join(', '),
          severity: v.spO2 < 90 || v.bpSystolic > 180 ? 'HIGH' : 'MEDIUM'
        }
      });
    }
  }

  res.status(201).json({ id: record.id, message: 'Vitals stored', flagged: flags.length > 0 });
});

router.get('/:id', async (req, res) => {
  const recordId = req.params.id;
  const user = (req as any).user;

  const record = await prisma.vitalSign.findUnique({ where: { id: recordId }, include: { consultation: true } });
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (user.role === Role.ADMIN) return res.status(403).json({ error: 'Admins cannot view clinical content' });
  if (user.role === Role.PATIENT && record.consultation.patientId !== user.id) return res.status(403).json({ error: 'Access denied' });

  const plaintext = decryptDataEnvelope(record.encryptedVitals, record.vitalsIv, record.vitalsAuthTag, record.encryptedDek, record.dekIv, record.dekAuthTag);

  await prisma.auditEvent.create({
    data: { action: 'READ_VITALS', resource: `VitalSign:${recordId}`, userId: user.id, ipAddress: req.ip || 'unknown' }
  });

  res.json({ id: record.id, consultationId: record.consultationId, vitals: JSON.parse(plaintext), createdAt: record.createdAt });
});

router.get('/consultation/:consultationId', async (req, res) => {
  try {
    const consultationId = req.params.consultationId;
    const user = (req as any).user;

    if (user.role === Role.ADMIN) return res.status(403).json({ error: 'Admins cannot view clinical content' });

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        clinicalFlags: true,
        vitalSigns: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    if (user.role === Role.PATIENT && consultation.patientId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const decryptedVitals = consultation.vitalSigns.map(vs => {
      try {
        const plaintext = decryptDataEnvelope(
          vs.encryptedVitals,
          vs.vitalsIv,
          vs.vitalsAuthTag,
          vs.encryptedDek,
          vs.dekIv,
          vs.dekAuthTag
        );
        return {
          id: vs.id,
          consultationId: vs.consultationId,
          vitals: JSON.parse(plaintext),
          createdAt: vs.createdAt
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    res.json({
      consultationId,
      vitals: decryptedVitals,
      clinicalFlags: consultation.clinicalFlags
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve consultation vitals', details: err.message });
  }
});

router.get('/clinical-flags/all', async (req, res) => {
  try {
    const user = (req as any).user;
    let whereClause: any = {};
    if (user.role === Role.PATIENT) {
      whereClause = { patientId: user.id };
    } else if (user.role === Role.ADMIN) {
      return res.status(403).json({ error: 'Admins cannot view clinical content' });
    }

    const flags = await prisma.clinicalFlag.findMany({
      where: whereClause,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        consultation: { select: { id: true, scheduledAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flags);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve clinical flags', details: err.message });
  }
});

export default router;
