import { Router } from 'express';
import argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as speakeasy from 'speakeasy';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || 'rsecret', { expiresIn: '7d' });
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

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User exists' });

    const passwordHash = await argon2.hash(password);
    const userRole = Object.values(Role).includes(role) ? role : Role.PATIENT;

    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, role: userRole }
    });

    await logAudit('REGISTER', 'AUTH', user.id, req.ip);
    res.status(201).json({ message: 'User registered' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
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
    return res.status(401).json({ error: 'Invalid credentials' });
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
      role: user.role
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
    role: user.role
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
