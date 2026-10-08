import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { gdprService, DEFAULT_CONSENT_PURPOSES } from '../services/gdpr.service';
import { rulesEngine } from '../services/rulesEngine.service';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

/**
 * GET /api/v1/gdpr/consent
 * Returns consent records for the current user (or for a patient if queried by Admin/Doctor)
 */
router.get('/consent', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const targetPatientId = (req.query.patientId as string) || user.id;

  if (targetPatientId !== user.id && user.role !== Role.ADMIN && user.role !== Role.DOCTOR) {
    await rulesEngine.triggerViolation({
      ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
      description: `User ${user.id} attempted to view GDPR consents of patient ${targetPatientId}`,
      userId: user.id,
      sourceIp: req.ip,
      resource: `Consent:${targetPatientId}`,
    });
    return res.status(403).json({ error: 'Access denied: Cannot view other patient consents' });
  }

  const consents = await gdprService.getPatientConsents(targetPatientId);
  res.json({
    patientId: targetPatientId,
    supportedPurposes: DEFAULT_CONSENT_PURPOSES,
    consents,
  });
});

/**
 * POST /api/v1/gdpr/consent
 * Grant or update consent for a purpose
 */
router.post('/consent', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { purpose, version, patientId } = req.body;
  const targetPatientId = patientId || user.id;

  if (targetPatientId !== user.id && user.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Cannot modify consent for another user' });
  }

  if (!purpose) {
    return res.status(400).json({ error: 'Consent purpose is required' });
  }

  const consent = await gdprService.grantConsent({
    patientId: targetPatientId,
    purpose,
    version: version || '1.0',
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
  });

  res.status(200).json({
    message: `Consent granted for purpose: ${purpose}`,
    consent,
  });
});

/**
 * POST /api/v1/gdpr/consent/revoke
 * Revoke consent for a specific purpose
 */
router.post('/consent/revoke', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { purpose, patientId } = req.body;
  const targetPatientId = patientId || user.id;

  if (targetPatientId !== user.id && user.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Cannot revoke consent for another user' });
  }

  if (!purpose) {
    return res.status(400).json({ error: 'Consent purpose is required' });
  }

  const consent = await gdprService.revokeConsent({
    patientId: targetPatientId,
    purpose,
    ipAddress: req.ip || req.socket.remoteAddress,
  });

  res.status(200).json({
    message: `Consent revoked for purpose: ${purpose}`,
    consent,
  });
});

/**
 * GET /api/v1/gdpr/consent/check/:patientId
 * Check if patient has active consent
 */
router.get('/consent/check/:patientId', async (req: Request, res: Response) => {
  const patientId = req.params.patientId as string;
  const purpose = (req.query.purpose as string) || 'TELEMEDICINE_TREATMENT';

  const hasConsent = await gdprService.hasActiveConsent(patientId, purpose);
  res.json({
    patientId,
    purpose,
    hasActiveConsent: hasConsent,
  });
});

/**
 * POST /api/v1/gdpr/export
 * Export patient data according to GDPR Art. 20 (Right to Data Portability)
 * Enforces mandatory justification parameter
 */
router.post('/export', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { patientId, justification } = req.body;
  const targetPatientId = patientId || user.id;

  try {
    const exportResult = await gdprService.exportPatientData({
      patientId: targetPatientId,
      justification,
      requestedByUserId: user.id,
      requestedByRole: user.role,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(exportResult);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/gdpr/erasure
 * Request GDPR Art. 17 Right to Erasure via Crypto-Shredding of per-record keys
 */
router.post('/erasure', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { patientId, reason, confirmShred } = req.body;
  const targetPatientId = patientId || user.id;

  if (targetPatientId !== user.id && user.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Only the patient or an authorized Administrator can request right-to-erasure' });
  }

  if (confirmShred !== true) {
    return res.status(400).json({
      error: 'Confirmation required: Setting confirmShred=true is required to irreversibly crypto-shred encryption keys.',
    });
  }

  try {
    const result = await gdprService.cryptoShredPatientData({
      patientId: targetPatientId,
      reason,
      requestedByUserId: user.id,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/gdpr/erasure/requests
 * List erasure requests
 */
router.get('/erasure/requests', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const whereClause = user.role === Role.ADMIN ? {} : { userId: user.id };

  const requests = await prisma.erasureRequest.findMany({
    where: whereClause,
    orderBy: { shreddedAt: 'desc' },
  });

  res.json(requests);
});

export default router;
