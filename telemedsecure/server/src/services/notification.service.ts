import { PrismaClient, NotificationType } from '@prisma/client';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  consultationId?: string | null;
}

/**
 * Persist a notification for a user and push it in real time to their
 * `user-{id}` socket room. Never throws: a failure to notify must not roll
 * back the clinical action that triggered it (the DB write and the audit event
 * are the source of truth; the socket push is best-effort).
 */
export async function notify(input: NotifyInput) {
  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        consultationId: input.consultationId ?? null,
      },
    });

    const io = getIO();
    if (io) {
      io.to(`user-${input.userId}`).emit('booking-notification', created);
    }
    return created;
  } catch (err) {
    console.error('[notification.service] failed to notify:', err);
    return null;
  }
}

/** Fan the same notification out to several users (deduplicated). */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  await Promise.all(unique.map((userId) => notify({ userId, ...input })));
}
