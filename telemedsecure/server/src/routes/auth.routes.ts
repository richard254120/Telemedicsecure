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

const generateTokens = (user) => {
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

// 2. STAFF REGISTRATION VIA INVITATION TOKEN
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

    if (!invitation || invitation.isAccepted || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid, expired, or already used invitation token' });
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: `Invitation token was issued for ${invitation.email}, not ${email}` });
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
        role: invitation.role,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: medicalLicenseNo || null,
        licenseJurisdiction: licenseJurisdiction || null,
        specialty: specialty || null,
        verifiedAt: new Date(),
        verifiedById: invitation.invitedById,
        isActive: true
      }
    });

    await prisma.staffInvitation.update({
      where: { id: invitation.id },
      data: { isAccepted: true }
    });

    await logAudit('STAFF_REGISTER_INVITED', 'AUTH', user.id, req.ip);

    res.status(201).json({
      message: `Staff account (${user.role}) registered and verified successfully`,
      user: { id: user.id, email: user.email, role: user.role }
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
    const { email, password, totp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Generic error response for any failure
    const invalidResponse = () => res.status(401).json({ error: 'Invalid credentials' });

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
      const failedAttempts = user.failedAttempts + 1;
      const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({ where: { id: user.id }, data: { failedAttempts, lockedUntil } });
      await logAudit('LOGIN_FAILURE', 'AUTH', user.id, req.ip);
      await rulesEngine.recordFailedLogin(user.email, req.ip || 'unknown', user.id);
      return invalidResponse();
    }

    // TOTP check if enabled
    if (user.totpSecret && !totp) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.totpSecret && totp) {
      const isValid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: totp });
      if (!isValid) {
        await logAudit('LOGIN_FAILURE_TOTP', 'AUTH', user.id, req.ip);
        return invalidResponse();
      }
    }

    // Reset failed attempts on success
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
    rulesEngine.resetFailedLogins(user.email);
    await logAudit('LOGIN_SUCCESS', 'AUTH', user.id, req.ip);

    // Include mustChangePassword in token payload and response
    // Reset failed attempts on success
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
    rulesEngine.resetFailedLogins(user.email);
    await logAudit('LOGIN_SUCCESS', 'AUTH', user.id, req.ip);

    // Include mustChangePassword in token payload and response
    const tokens = generateTokens(user);
    const payload = { ...tokens, user: { id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword } };
    res.json(payload);
  });
  const { email, password, totp } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await logAudit('LOGIN_FAILURE', 'AUTH', null, req.ip);
    await rulesEngine.recordFailedLogin(email, req.ip || 'unknown', null);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) {
    await logAudit('LOGIN_LOCKED', 'AUTH', user.id, req.ip);
    return res.status(403).json({ error: 'Account locked or inactive' });
  }

  let validPassword = false;
  try {
    if (user.passwordHash.startsWith('$argon2')) {
      validPassword = await argon2.verify(user.passwordHash, password);
    }
  } catch { }
  if (!validPassword) {
    try {
      validPassword = await bcrypt.compare(password, user.passwordHash);
    } catch { }
  }

  if (!validPassword) {
    const failedAttempts = user.failedAttempts + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts, lockedUntil } });

    await logAudit('LOGIN_FAILURE', 'AUTH', user.id, req.ip);
    await rulesEngine.recordFailedLogin(user.email, req.ip || 'unknown', user.id);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Security gate: Verify clinical practitioner credential approval
  if (user.role !== Role.PATIENT && user.verificationStatus === VerificationStatus.PENDING_REVIEW) {
    await logAudit('LOGIN_BLOCKED_PENDING_VERIFICATION', 'AUTH', user.id, req.ip);
    return res.status(403).json({
      error: 'Clinical credential verification pending. A medical administrator must verify your medical license before access is granted.'
    });
  }

  if (user.verificationStatus === VerificationStatus.REJECTED) {
    await logAudit('LOGIN_BLOCKED_REJECTED', 'AUTH', user.id, req.ip);
    return res.status(403).json({
      error: 'Your practitioner verification was rejected. Please contact clinical administration.'
    });
  }

  if (user.totpSecret && !totp) {
    return res.status(401).json({ error: 'TOTP required' });
  }

  if (user.totpSecret && totp) {
    const isValid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: totp });
    if (!isValid) {
      await logAudit('LOGIN_FAILURE_TOTP', 'AUTH', user.id, req.ip);
      return res.status(401).json({ error: 'Invalid TOTP' });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  rulesEngine.resetFailedLogins(user.email);
  await logAudit('LOGIN_SUCCESS', 'AUTH', user.id, req.ip);

  const tokens = generateTokens(user.id);
  res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      verificationStatus: user.verificationStatus,
      specialty: user.specialty,
      medicalLicenseNo: user.medicalLicenseNo
    }
  });
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
