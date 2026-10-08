import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as speakeasy from 'speakeasy';

const router = Router();
const prisma = new PrismaClient();

// Only ADMIN can access these routes
router.use(requireAuth);
router.use(requireRole([Role.ADMIN]));

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, lockedUntil: true }
  });
  res.json(users);
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
    data: { isActive, lockedUntil: isActive ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) } // lock practically forever if deactivated
  });
  res.json({ message: 'Status updated', isActive: user.isActive });
});

// Generate TOTP for a user (usually user does this themselves, but admin can trigger setup)
router.post('/users/:id/totp', async (req, res) => {
  const secret = speakeasy.generateSecret().base32;
  await prisma.user.update({
    where: { id: req.params.id },
    data: { totpSecret: secret }
  });
  res.json({ message: 'TOTP secret generated', secret }); // in real app, return QR code
});

export default router;
