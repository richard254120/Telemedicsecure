import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

/**
 * GET /api/v1/notifications
 * The authenticated user's notifications, newest first.
 * `?unread=true` returns only unread; `?limit=` caps the page (default 50).
 * Always returns `{ items, unreadCount }` so a bell can badge independently.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const onlyUnread = String(req.query.unread).toLowerCase() === 'true';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const where: any = { userId: user.id };
    if (onlyUnread) where.read = false;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    res.json({ items, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

/**
 * POST /api/v1/notifications/:id/read
 * Mark a single notification read (scoped to the owner).
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: user.id },
      data: { read: true },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update notification', details: err.message });
  }
});

/**
 * POST /api/v1/notifications/read-all
 * Mark every unread notification for this user as read.
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    res.json({ ok: true, updated: result.count });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update notifications', details: err.message });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Dismiss (remove) a notification for its owner.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await prisma.notification.deleteMany({
      where: { id: String(req.params.id), userId: user.id },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to dismiss notification', details: err.message });
  }
});

export default router;
