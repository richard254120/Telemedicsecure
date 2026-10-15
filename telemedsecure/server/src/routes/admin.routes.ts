import crypto from 'crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as speakeasy from 'speakeasy';
import { createChainedAuditEvent } from '../services/audit.service';

const router = Router();
const prisma = new PrismaClient();

// Only ADMIN can access these routes
router.use(requireAuth);
router.use(requireRole([Role.ADMIN]));

const logAudit = async (action: string, resource: string, userId?: string | null, ip?: string) => {
  await createChainedAuditEvent({
    action,
    resource,
    userId,
    ipAddress: ip || 'unknown',
    userAgent: 'unknown',
  });
};

// 1. List all users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lockedUntil: true,
      verificationStatus: true,
      medicalLicenseNo: true,
      licenseJurisdiction: true,
      specialty: true,
      verifiedAt: true,
      verifiedById: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// 2. Provision staff (admin creates account with password or generated temporary credentials)
router.post('/users', async (req, res) => {
  try {
    const { email, firstName, lastName, role, medicalLicenseNo, licenseJurisdiction, specialty, password } = req.body;
    const adminUser = (req as any).user;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Email, first name, last name, and role are required' });
    }
    if (role === Role.PATIENT) {
      return res.status(400).json({ error: 'Cannot assign PATIENT role via admin endpoint' });
    }
    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Use admin-supplied password if provided and valid (>= 8 chars), otherwise generate strong temporary password
    const rawPassword = (password && typeof password === 'string' && password.trim().length >= 8)
      ? password.trim()
      : crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, 'A');
    const passwordHash = await argon2.hash(rawPassword);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: medicalLicenseNo?.trim() || null,
        licenseJurisdiction:
          licenseJurisdiction?.trim() ||
          (['DOCTOR', 'NURSE', 'PHARMACIST', 'RECEPTIONIST', 'ADMIN'].includes(role) ? 'US-NPI' : null),
        specialty: specialty?.trim() || (['DOCTOR', 'NURSE'].includes(role) ? 'General Practice' : (role === Role.ADMIN ? 'Hospital Administration' : null)),
        verifiedAt: new Date(),
        verifiedById: adminUser.id,
        createdById: adminUser.id,
        mustChangePassword: false,
        isActive: true,
      },
    });

    await logAudit('STAFF_ACCOUNT_PROVISIONED', `USER:${newUser.id}`, adminUser.id, req.ip);
    res.status(201).json({
      message: `${role} account provisioned successfully`,
      temporaryPassword: rawPassword,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        verificationStatus: newUser.verificationStatus,
        medicalLicenseNo: newUser.medicalLicenseNo,
        specialty: newUser.specialty,
      },
    });
  } catch (err: any) {
    console.error('Provision staff error:', err);
    res.status(500).json({ error: 'Failed to provision staff account' });
  }
});

// 3. Verify / reject practitioner credentials
router.put('/users/:id/verify-credentials', async (req, res) => {
  const { verificationStatus } = req.body;
  const adminUser = (req as any).user;
  if (!Object.values(VerificationStatus).includes(verificationStatus)) {
    return res.status(400).json({ error: 'Invalid verification status' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      verificationStatus,
      verifiedAt: new Date(),
      verifiedById: adminUser.id,
      isActive: verificationStatus === VerificationStatus.VERIFIED ? true : target.isActive,
    },
  });

  await logAudit(
    verificationStatus === VerificationStatus.VERIFIED
      ? 'PRACTITIONER_CREDENTIAL_VERIFIED'
      : 'PRACTITIONER_CREDENTIAL_REJECTED',
    `USER:${target.id}`,
    adminUser.id,
    req.ip,
  );
  res.json({ message: `Credentials updated to ${verificationStatus}`, user: updated });
});

// 4. Staff invitation endpoints (create, list, revoke)
// Default expiration: 5 minutes (enforces tight security for single-use onboarding tokens)
router.post('/invitations', async (req, res) => {
  try {
    const { email, role, expiresInMinutes, expiresInHours } = req.body;
    const adminUser = (req as any).user;
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }
    if (!Object.values(Role).includes(role) || role === Role.PATIENT) {
      return res.status(400).json({ error: 'Invalid role for invitation' });
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    // Explicitly set default expiration to 5 minutes
    const minutes = expiresInMinutes !== undefined 
      ? Number(expiresInMinutes) 
      : (expiresInHours !== undefined ? Number(expiresInHours) * 60 : 5);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    const invitation = await prisma.staffInvitation.create({
      data: { email: email.toLowerCase().trim(), role, tokenHash, invitedById: adminUser.id, expiresAt },
    });
    await logAudit('STAFF_INVITATION_CREATED', `INVITATION:${invitation.id}`, adminUser.id, req.ip);
    res.status(201).json({ message: 'Invitation created', token: rawToken, invitation, expiresInMinutes: minutes });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.get('/invitations', async (req, res) => {
  const invitations = await prisma.staffInvitation.findMany({
    include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invitations);
});

router.delete('/invitations/:id', async (req, res) => {
  const adminUser = (req as any).user;
  await prisma.staffInvitation.delete({ where: { id: req.params.id } });
  await logAudit('STAFF_INVITATION_REVOKED', `INVITATION:${req.params.id}`, adminUser.id, req.ip);
  res.json({ message: 'Invitation revoked' });
});

// 5. Change user role (cannot set to PATIENT)
router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!Object.values(Role).includes(role) || role === Role.PATIENT) {
    return res.status(400).json({ error: 'Invalid or disallowed role' });
  }
  const adminUser = (req as any).user;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  await logAudit('USER_ROLE_CHANGED', `USER:${req.params.id}`, adminUser.id, req.ip);
  res.json({ message: 'Role updated', role: user.role });
});

// 6. Activate / deactivate user (admin cannot deactivate self)
router.put('/users/:id/status', async (req, res) => {
  const { isActive } = req.body;
  const adminUser = (req as any).user;
  const targetId = req.params.id;
  if (targetId === adminUser.id) {
    return res.status(400).json({ error: 'Admins cannot change their own activation status' });
  }
  const user = await prisma.user.update({
    where: { id: targetId },
    data: { isActive, lockedUntil: isActive ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) },
  });
  await logAudit('USER_STATUS_CHANGED', `USER:${targetId}`, adminUser.id, req.ip);
  res.json({ message: 'Status updated', isActive: user.isActive });
});

// 7. Generate TOTP secret for a user
router.post('/users/:id/totp', async (req, res) => {
  const secret = speakeasy.generateSecret().base32;
  await prisma.user.update({ where: { id: req.params.id }, data: { totpSecret: secret } });
  await logAudit('TOTP_GENERATED', `USER:${req.params.id}`, (req as any).user.id, req.ip);
  res.json({ message: 'TOTP secret generated', secret });
});

export default router;

