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
    userAgent: 'unknown'
  });
};

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
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(users);
});

// Admin directly provisions clinical staff (Doctor, Nurse, Admin)
router.post('/users', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, medicalLicenseNo, licenseJurisdiction, specialty } = req.body;
    const adminUser = (req as any).user;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Email, password, first name, last name, and role are required' });
    }

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await argon2.hash(password);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: medicalLicenseNo?.trim() || null,
        licenseJurisdiction: licenseJurisdiction?.trim() || (['DOCTOR', 'NURSE'].includes(role) ? 'US-NPI' : null),
        specialty: specialty?.trim() || (['DOCTOR', 'NURSE'].includes(role) ? 'General Practice' : null),
        verifiedAt: new Date(),
        verifiedById: adminUser.id,
        isActive: true
      }
    });

    await logAudit('STAFF_ACCOUNT_PROVISIONED', `USER:${newUser.id}`, adminUser.id, req.ip);

    res.status(201).json({
      message: `${role} account provisioned successfully`,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        verificationStatus: newUser.verificationStatus,
        medicalLicenseNo: newUser.medicalLicenseNo,
        specialty: newUser.specialty
      }
    });
  } catch (err: any) {
    console.error('Provision staff error:', err);
    res.status(500).json({ error: 'Failed to provision staff account' });
  }
});

// Admin reviews and verifies / rejects clinical practitioner credentials
router.put('/users/:id/verify-credentials', async (req, res) => {
  const { verificationStatus } = req.body;
  const adminUser = (req as any).user;

  if (![VerificationStatus.VERIFIED, VerificationStatus.REJECTED].includes(verificationStatus)) {
    return res.status(400).json({ error: 'Status must be VERIFIED or REJECTED' });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      verificationStatus,
      verifiedAt: new Date(),
      verifiedById: adminUser.id,
      isActive: verificationStatus === VerificationStatus.VERIFIED ? true : targetUser.isActive
    }
  });

  await logAudit(
    verificationStatus === VerificationStatus.VERIFIED ? 'PRACTITIONER_CREDENTIAL_VERIFIED' : 'PRACTITIONER_CREDENTIAL_REJECTED',
    `USER:${targetUser.id}`,
    adminUser.id,
    req.ip
  );

  res.json({
    message: `Practitioner credentials updated to ${verificationStatus}`,
    user: updatedUser
  });
});

// Create single-use staff invitation token (Doctor / Nurse / Admin)
router.post('/invitations', async (req, res) => {
  try {
    const { email, role, expiresInHours } = req.body;
    const adminUser = (req as any).user;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (![Role.DOCTOR, Role.NURSE, Role.ADMIN].includes(role)) {
      return res.status(400).json({ error: 'Invitations can only be issued for DOCTOR, NURSE, or ADMIN' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hours = Number(expiresInHours) || 48;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

    const invitation = await prisma.staffInvitation.create({
      data: {
        email: email.toLowerCase().trim(),
        role,
        tokenHash,
        invitedById: adminUser.id,
        expiresAt
      }
    });

    await logAudit('STAFF_INVITATION_CREATED', `INVITATION:${invitation.id}`, adminUser.id, req.ip);

    res.status(201).json({
      message: 'Staff invitation issued successfully',
      token: rawToken,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (err: any) {
    console.error('Create invitation error:', err);
    res.status(500).json({ error: 'Failed to create staff invitation' });
  }
});

// List all staff invitations
router.get('/invitations', async (req, res) => {
  const invitations = await prisma.staffInvitation.findMany({
    include: {
      invitedBy: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(invitations);
});

// Revoke an invitation
router.delete('/invitations/:id', async (req, res) => {
  const adminUser = (req as any).user;
  await prisma.staffInvitation.delete({
    where: { id: req.params.id }
  });
  await logAudit('STAFF_INVITATION_REVOKED', `INVITATION:${req.params.id}`, adminUser.id, req.ip);
  res.json({ message: 'Invitation revoked successfully' });
});

router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!Object.values(Role).includes(role)) return res.status(400).json({ error: 'Invalid role' });
  
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role }
  });
  res.json({ message: 'Role updated', role: user.role });
});

router.put('/users/:id/status', async (req, res) => {
  const { isActive } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive, lockedUntil: isActive ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) }
  });
  res.json({ message: 'Status updated', isActive: user.isActive });
});

router.post('/users/:id/totp', async (req, res) => {
  const secret = speakeasy.generateSecret().base32;
  await prisma.user.update({
    where: { id: req.params.id },
    data: { totpSecret: secret }
  });
  res.json({ message: 'TOTP secret generated', secret });
});

export default router;

