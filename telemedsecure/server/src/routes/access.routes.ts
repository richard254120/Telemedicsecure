import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient, Role, AccessGrantStatus, NotificationType } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { createChainedAuditEvent } from '../services/audit.service';
import { rulesEngine } from '../services/rulesEngine.service';
import { notify } from '../services/notification.service';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

const TTL_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

// Any authenticated staff member (everyone except the patient themselves) may be
// issued a key and may redeem one. This generalises the old doctor-only model.
const STAFF_ROLES: Role[] = [
  Role.DOCTOR,
  Role.NURSE,
  Role.PHARMACIST,
  Role.RECEPTIONIST,
  Role.ADMIN,
  Role.LAB_TECHNICIAN,
  Role.RADIOLOGIST,
  Role.BILLING_OFFICER,
  Role.TRIAGE_OFFICER,
  Role.CARE_COORDINATOR,
];

// RFC-4648 base32 alphabet (no padding): unambiguous, human-readable codes.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateCode(): string {
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += B32[bytes[i] % B32.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

const normalizeCode = (raw: string) => (raw || '').trim().toUpperCase().replace(/\s+/g, '');
const hashToken = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

const granteeSelect = { id: true, firstName: true, lastName: true, email: true, role: true, specialty: true };
const patientSelect = { id: true, firstName: true, lastName: true, email: true };

const displayName = (u: any) =>
  u?.role === Role.DOCTOR ? `Dr. ${u.lastName}` : `${u.firstName} ${u.lastName}`;

/**
 * GET /api/v1/access/grantees  (PATIENT)
 * Directory of active staff the patient may bind an access key to. Deliberately
 * broader than the old doctors-only picker so a nurse, pharmacist, etc. can be
 * authorised to view the patient's full record.
 */
router.get('/grantees', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const grantees = await prisma.user.findMany({
      where: { role: { not: Role.PATIENT }, isActive: true },
      select: granteeSelect,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
    res.json(grantees);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch grantees directory', details: err.message });
  }
});

/**
 * POST /api/v1/access/grants  (PATIENT)
 * Issue a temporary, staff-bound, time-boxed read-access key. The plaintext
 * code is returned once and never stored (only its SHA-256 hash is kept).
 * `granteeId` names any active staff member; `doctorId` is accepted as an alias.
 */
router.post('/grants', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { granteeId: rawGranteeId, doctorId, ttl = '24h', purpose } = req.body;
    const granteeId = rawGranteeId || doctorId;

    if (!granteeId) return res.status(400).json({ error: 'granteeId is required' });
    if (!TTL_MS[ttl]) return res.status(400).json({ error: 'ttl must be one of 1h, 24h, 72h, 7d' });

    const grantee = await prisma.user.findFirst({
      where: { id: granteeId, role: { not: Role.PATIENT }, isActive: true },
      select: granteeSelect,
    });
    if (!grantee) return res.status(404).json({ error: 'Selected staff member not found or inactive' });

    const code = generateCode();
    const tokenHash = hashToken(code);
    const expiresAt = new Date(Date.now() + TTL_MS[ttl]);

    const grant = await prisma.accessGrant.create({
      data: {
        patientId: user.id,
        granteeId: grantee.id,
        granteeRole: grantee.role,
        tokenHash,
        scope: 'RECORDS_READ',
        purpose: purpose || null,
        expiresAt,
        status: AccessGrantStatus.ACTIVE,
      },
    });

    await createChainedAuditEvent({
      action: 'ACCESS_GRANT_ISSUED',
      resource: `AccessGrant:${grant.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    // Let the chosen staff member know a key was issued in their name.
    await notify({
      userId: grantee.id,
      type: NotificationType.ACCESS_GRANTED,
      title: 'New access key issued to you',
      body: `${user.firstName} ${user.lastName} issued you a time-limited access key${purpose ? ` for "${purpose}"` : ''}. Redeem it from your dashboard.`,
      link: `/dashboard?tab=shared`,
    });

    // Code is shown once here; it cannot be retrieved later.
    res.status(201).json({ id: grant.id, code, expiresAt: grant.expiresAt, grantee });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to issue access key', details: err.message });
  }
});

/**
 * GET /api/v1/access/grants  (PATIENT)
 * List this patient's issued grants (masked — no code/token), most recent first.
 */
router.get('/grants', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const grants = await prisma.accessGrant.findMany({
      where: { patientId: user.id },
      include: { grantee: { select: granteeSelect } },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    res.json(grants.map((g) => ({
      id: g.id,
      grantee: g.grantee,
      granteeRole: g.granteeRole,
      scope: g.scope,
      purpose: g.purpose,
      status: g.status,
      // Surface real state: an ACTIVE row past expiry reads as EXPIRED to callers.
      effectiveStatus: g.status === AccessGrantStatus.ACTIVE && g.expiresAt.getTime() <= now
        ? AccessGrantStatus.EXPIRED
        : g.status,
      redeemed: Boolean(g.redeemedAt),
      redeemedAt: g.redeemedAt,
      lastAccessAt: g.lastAccessAt,
      expiresAt: g.expiresAt,
      createdAt: g.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list access grants', details: err.message });
  }
});

/**
 * POST /api/v1/access/grants/:id/revoke  (PATIENT)
 * Cut a grant's access immediately. Checked on every subsequent read.
 */
router.post('/grants/:id/revoke', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const grant = await prisma.accessGrant.findFirst({
      where: { id: String(req.params.id), patientId: user.id },
      include: { grantee: { select: granteeSelect } },
    });
    if (!grant) return res.status(404).json({ error: 'Grant not found' });

    const updated = await prisma.accessGrant.update({
      where: { id: grant.id },
      data: { status: AccessGrantStatus.REVOKED, revokedAt: new Date() },
    });

    await createChainedAuditEvent({
      action: 'ACCESS_GRANT_REVOKED',
      resource: `AccessGrant:${grant.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    await notify({
      userId: grant.granteeId,
      type: NotificationType.ACCESS_REVOKED,
      title: 'Access key revoked',
      body: `${user.firstName} ${user.lastName} revoked the access key issued to you.`,
      link: `/dashboard?tab=shared`,
    });

    res.json({ id: updated.id, status: updated.status, revokedAt: updated.revokedAt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke access grant', details: err.message });
  }
});

/**
 * POST /api/v1/access/grants/:id/regenerate  (PATIENT)
 * Revoke the current key and issue a fresh code for the same grantee and window.
 * The old code stops working immediately; the new code is returned once.
 */
router.post('/grants/:id/regenerate', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const grant = await prisma.accessGrant.findFirst({
      where: { id: String(req.params.id), patientId: user.id },
    });
    if (!grant) return res.status(404).json({ error: 'Grant not found' });

    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: { status: AccessGrantStatus.REVOKED, revokedAt: new Date() },
    });

    const code = generateCode();
    const tokenHash = hashToken(code);

    const fresh = await prisma.accessGrant.create({
      data: {
        patientId: user.id,
        granteeId: grant.granteeId,
        granteeRole: grant.granteeRole,
        tokenHash,
        scope: grant.scope,
        purpose: grant.purpose,
        expiresAt: grant.expiresAt,
        status: AccessGrantStatus.ACTIVE,
      },
      include: { grantee: { select: granteeSelect } },
    });

    await createChainedAuditEvent({
      action: 'ACCESS_GRANT_REGENERATED',
      resource: `AccessGrant:${fresh.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    res.status(201).json({ id: fresh.id, code, expiresAt: fresh.expiresAt, grantee: fresh.grantee });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to regenerate access key', details: err.message });
  }
});

/**
 * POST /api/v1/access/redeem  (STAFF)
 * Redeem a patient-issued code bound to this staff member. Sets redeemedAt so
 * the chart becomes readable for the remainder of the window.
 */
router.post('/redeem', requireRole(STAFF_ROLES), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const code = normalizeCode(req.body?.code);
  const fail = async () => {
    await rulesEngine.triggerViolation({
      ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
      description: `Staff ${user.email} attempted to redeem an invalid/expired/foreign access key.`,
      userId: user.id,
      sourceIp: req.ip,
      resource: 'AccessGrant:Redeem',
    });
    // Generic message: never reveal whether the code exists.
    return res.status(400).json({ error: 'Invalid access key' });
  };

  try {
    if (!code) return await fail();
    const tokenHash = hashToken(code);
    const grant = await prisma.accessGrant.findUnique({
      where: { tokenHash },
      include: { patient: { select: patientSelect } },
    });

    if (
      !grant ||
      grant.granteeId !== user.id ||
      grant.status !== AccessGrantStatus.ACTIVE ||
      grant.revokedAt ||
      grant.expiresAt.getTime() <= Date.now()
    ) {
      return await fail();
    }

    const firstRedemption = !grant.redeemedAt;
    const updated = await prisma.accessGrant.update({
      where: { id: grant.id },
      data: { redeemedAt: grant.redeemedAt || new Date() },
    });

    await createChainedAuditEvent({
      action: 'ACCESS_GRANT_REDEEMED',
      resource: `AccessGrant:${grant.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    // Tell the patient their record was just unlocked by the person they chose.
    if (firstRedemption) {
      await notify({
        userId: grant.patientId,
        type: NotificationType.ACCESS_GRANTED,
        title: 'Your access key was used',
        body: `${displayName(user)} redeemed your access key and can now view your records until ${updated.expiresAt.toLocaleString()}.`,
        link: `/patient?tab=access`,
      });
    }

    res.json({
      id: grant.id,
      patient: grant.patient,
      scope: grant.scope,
      purpose: grant.purpose,
      expiresAt: updated.expiresAt,
      redeemedAt: updated.redeemedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to redeem access key', details: err.message });
  }
});

/**
 * GET /api/v1/access/shared-with-me  (STAFF)
 * Every grant bound to this staff member, so the UI can distinguish "awaiting
 * key" (issued but not yet redeemed) from an unlocked, counting-down window.
 */
router.get('/shared-with-me', requireRole(STAFF_ROLES), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const grants = await prisma.accessGrant.findMany({
      where: { granteeId: user.id },
      include: { patient: { select: patientSelect } },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    res.json(grants.map((g) => ({
      id: g.id,
      patient: g.patient,
      scope: g.scope,
      purpose: g.purpose,
      status: g.status,
      effectiveStatus: g.status === AccessGrantStatus.ACTIVE && g.expiresAt.getTime() <= now
        ? AccessGrantStatus.EXPIRED
        : g.status,
      redeemed: Boolean(g.redeemedAt),
      expiresAt: g.expiresAt,
      lastAccessAt: g.lastAccessAt,
      createdAt: g.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list shared-with-me grants', details: err.message });
  }
});

/**
 * GET /api/v1/access/log  (PATIENT)
 * "Who viewed my records" — recent PatientAccessEvent rows for this patient.
 */
router.get('/log', requireRole([Role.PATIENT]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const events = await prisma.patientAccessEvent.findMany({
      where: { patientId: user.id },
      include: { viewer: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(events.map((e) => ({
      id: e.id,
      viewer: e.viewer,
      viewerRole: e.viewerRole,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      createdAt: e.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve access log', details: err.message });
  }
});

export default router;
