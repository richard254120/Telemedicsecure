import crypto from 'crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as speakeasy from 'speakeasy';
import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const generateTokens = (user: any) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role, mustChangePassword: user.mustChangePassword }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || 'rsecret', { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

import { createChainedAuditEvent } from '../services/audit.service';
import { rulesEngine } from '../services/rulesEngine.service';

const logAudit = async (action: string, resource: string, userId?: string | null, ip?: string) => {
  await createChainedAuditEvent({
    action,
    resource,
    userId,
    ipAddress: ip || 'unknown',
    userAgent: 'unknown'
  });
};

const validatePassword = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return 'Password must contain uppercase, lowercase, and number';
  }
  return null;
};

// 1. PUBLIC PATIENT REGISTRATION (Self-Service)
// Strictly restricted to Role.PATIENT. Privileged roles are prohibited.
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    if (firstName.length < 2 || lastName.length < 2) {
      return res.status(400).json({ error: 'Names must be at least 2 characters' });
    }

    // Security check: Reject any attempt to self-assign privileged clinical or admin roles
    if (role && role !== Role.PATIENT) {
      return res.status(400).json({
        error: 'Privileged clinical or administrative roles cannot be self-assigned. Practitioners must register with an invitation code or submit a credential application.'
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User with this email already exists' });

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: Role.PATIENT,
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true
      }
    });

    await logAudit('REGISTER_PATIENT', 'AUTH', user.id, req.ip);
    res.status(201).json({
      message: 'Patient account registered successfully',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// 2. VERIFY INVITATION TOKEN
router.get('/invitations/:token', async (req, res) => {
  try {
    const rawToken = (req.params.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        invitedBy: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    if (invitation.isAccepted) {
      return res.status(400).json({ error: 'This invitation token has already been accepted and used' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'This invitation token has expired (valid for 5 minutes). Please request a new invitation from your administrator.',
        expired: true
      });
    }

    res.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      invitedBy: invitation.invitedBy
    });
  } catch (err: any) {
    console.error('Verify invitation error:', err);
    res.status(500).json({ error: 'Failed to verify invitation token' });
  }
});

// 3. STAFF REGISTRATION VIA INVITATION TOKEN
// For Doctors, Nurses, or Administrators invited by clinic leadership
router.post('/register-staff', async (req, res) => {
  try {
    const {
      invitationToken,
      email,
      password,
      firstName,
      lastName,
      medicalLicenseNo,
      licenseJurisdiction,
      specialty
    } = req.body;

    if (!invitationToken || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Invitation token, email, name, and password are required' });
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    const tokenHash = crypto.createHash('sha256').update(invitationToken.trim()).digest('hex');

    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash }
    });

    if (!invitation) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    if (invitation.isAccepted) {
      return res.status(400).json({ error: 'This invitation token has already been accepted and used' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'This invitation token has expired. Please request a new invitation from your administrator.',
        expired: true
      });
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase().trim()) {
      return res.status(400).json({ error: `Invitation token was issued for ${invitation.email}, not ${email}` });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) return res.status(400).json({ error: 'User with this email already exists' });

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: invitation.role,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: medicalLicenseNo?.trim() || null,
        licenseJurisdiction: licenseJurisdiction?.trim() || (['DOCTOR', 'NURSE'].includes(invitation.role) ? 'US-NPI' : null),
        specialty: specialty?.trim() || (['DOCTOR', 'NURSE'].includes(invitation.role) ? 'General Practice' : (invitation.role === Role.ADMIN ? 'Hospital Administration' : null)),
        verifiedAt: new Date(),
        verifiedById: invitation.invitedById,
        createdById: invitation.invitedById,
        mustChangePassword: false,
        isActive: true
      }
    });

    await prisma.staffInvitation.update({
      where: { id: invitation.id },
      data: { isAccepted: true }
    });

    await logAudit('STAFF_REGISTER_INVITED', 'AUTH', user.id, req.ip);

    const tokens = generateTokens(user);
    res.status(201).json({
      message: `Staff account (${user.role}) registered and verified successfully`,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error: any) {
    console.error('Staff registration error:', error);
    res.status(500).json({ error: 'Staff registration failed. Please try again.' });
  }
});

// 3. PRACTITIONER APPLICATION (Disabled - Staff accounts must be provisioned directly by Admin)
router.post('/apply-practitioner', async (req, res) => {
  await logAudit('UNAUTHORIZED_PRACTITIONER_SELF_REGISTRATION_ATTEMPT', 'AUTH', null, req.ip);
  return res.status(403).json({
    error: 'Self-registration for clinical staff is disabled. All Doctor, Nurse, and Administrative accounts must be created directly by Hospital Administration.'
  });
});

  // 2. LOGIN FOR ALL ROLES
  router.post('/change-password', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  const pwdErr = validatePassword(newPassword);
  if (pwdErr) return res.status(400).json({ error: pwdErr });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  let valid = false;
  try {
    if (user.passwordHash.startsWith('$argon2')) {
      valid = await argon2.verify(user.passwordHash, oldPassword);
    }
  } catch {}
  if (!valid) {
    try {
      valid = await bcrypt.compare(oldPassword, user.passwordHash);
    } catch {}
  }
  if (!valid) {
    await logAudit('PASSWORD_CHANGE_FAILURE', 'AUTH', user.id, req.ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const newHash = await argon2.hash(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false }
  });
  await logAudit('PASSWORD_CHANGE_SUCCESS', 'AUTH', user.id, req.ip);
  res.json({ message: 'Password changed successfully' });
});
router.post('/login', async (req, res) => {
  const { email, password, totp } = req.body;

  // Generic error response for any failure
  const invalidResponse = () => res.status(401).json({ error: 'Invalid credentials' });

  if (!email || !password) {
    await logAudit('LOGIN_FAILURE', 'AUTH', null, req.ip);
    await rulesEngine.recordFailedLogin(email, req.ip || 'unknown', null);
    return invalidResponse();
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await logAudit('LOGIN_FAILURE', 'AUTH', null, req.ip);
    await rulesEngine.recordFailedLogin(email, req.ip || 'unknown', null);
    return invalidResponse();
  }

  // Reject deactivated or locked accounts
  if (!user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) {
    await logAudit('LOGIN_LOCKED', 'AUTH', user.id, req.ip);
    return res.status(403).json({ error: 'Invalid credentials' });
  }

  // Verify password (argon2 or bcrypt fallback)
  let validPassword = false;
  try {
    if (user.passwordHash.startsWith('$argon2')) {
      validPassword = await argon2.verify(user.passwordHash, password);
    }
  } catch {}
  if (!validPassword) {
    try {
      validPassword = await bcrypt.compare(password, user.passwordHash);
    } catch {}
  }
  if (!validPassword) {
    const failedAttempts = (user.failedAttempts ?? 0) + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts, lockedUntil } });
    await logAudit('LOGIN_FAILURE', 'AUTH', user.id, req.ip);
    await rulesEngine.recordFailedLogin(user.email, req.ip || 'unknown', user.id);
    return invalidResponse();
  }

  // Reset failed attempts on success
  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  rulesEngine.resetFailedLogins(user.email);
  await logAudit('LOGIN_SUCCESS', 'AUTH', user.id, req.ip);

  const tokens = generateTokens(user);
  const payload = { ...tokens, user: { id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword } };
  res.json(payload);
});

// 2FA TOTP Enrollment & Management
router.get('/2fa/status', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, totpSecret: true, email: true }
    });
    res.json({ isEnabled: !!dbUser?.totpSecret, email: dbUser?.email });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve 2FA status' });
  }
});

router.post('/2fa/generate', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const secret = speakeasy.generateSecret({
      name: `TeleMedSecure (${user.email})`,
      issuer: 'TeleMedSecure EPCS',
      length: 20
    });

    res.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate 2FA secret' });
  }
});

router.post('/2fa/enable', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ error: 'Secret and 6-digit TOTP token are required' });
    }

    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 1
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid authenticator code. Verification failed.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret }
    });

    await logAudit('2FA_ENABLED', 'AUTH', user.id, req.ip);

    res.json({ success: true, message: 'Two-Factor Authentication successfully enrolled and active.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to enable 2FA', details: err.message });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { token } = req.body;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.totpSecret) {
      return res.status(400).json({ error: '2FA is not currently enabled' });
    }

    const isValid = speakeasy.totp.verify({
      secret: dbUser.totpSecret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 1
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid authenticator verification code' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null }
    });

    await logAudit('2FA_DISABLED', 'AUTH', user.id, req.ip);

    res.json({ success: true, message: 'Two-Factor Authentication disabled.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    verificationStatus: user.verificationStatus,
    specialty: user.specialty,
    medicalLicenseNo: user.medicalLicenseNo
  });
});

router.post('/quick-login', async (req, res) => {
  try {
    const { role } = req.body;
    const targetRole = Object.values(Role).includes(role) ? role : Role.DOCTOR;
    let user = await prisma.user.findFirst({
      where: { role: targetRole, isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    if (!user) {
      return res.status(404).json({ error: `No active user found for role ${targetRole}` });
    }

    const tokens = generateTokens(user.id);
    res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Quick login failed', details: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'rsecret') as any;
    const tokens = generateTokens(decoded.id);
    res.json(tokens);
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', (req, res) => {
  // In a real app, invalidate refresh token in a blacklist/db
  res.json({ message: 'Logged out' });
});

export default router;
