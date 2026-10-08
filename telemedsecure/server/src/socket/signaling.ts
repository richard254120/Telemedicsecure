import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupSignaling = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    // In a real app, authenticate socket via middleware using JWT
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', async (data: { consultationId: string, userId: string, role: string }) => {
      const { consultationId, userId, role } = data;
      socket.join(consultationId);
      socket.to(consultationId).emit('user-joined', { userId, role });
      console.log(`User ${userId} joined ${consultationId}`);
    });

    socket.on('join-admin', (data: { userId?: string, role?: string }) => {
      socket.join('admins');
      console.log(`Socket ${socket.id} (user: ${data?.userId || 'unknown'}) joined admins room`);
      socket.emit('admin-joined', { status: 'subscribed_to_security_alerts' });
    });

    socket.on('start-consultation', async (data: { consultationId: string, userId: string }) => {
      await prisma.consultation.update({
        where: { id: data.consultationId },
        data: { status: 'IN_PROGRESS', startedAt: new Date() }
      });
      await prisma.auditEvent.create({
        data: { action: 'CONSULTATION_STARTED', resource: `Consultation:${data.consultationId}`, userId: data.userId, ipAddress: socket.handshake.address }
      });
      io.to(data.consultationId).emit('consultation-started');
    });

    socket.on('end-consultation', async (data: { consultationId: string, userId: string }) => {
      await prisma.consultation.update({
        where: { id: data.consultationId },
        data: { status: 'COMPLETED', endedAt: new Date() }
      });
      await prisma.auditEvent.create({
        data: { action: 'CONSULTATION_ENDED', resource: `Consultation:${data.consultationId}`, userId: data.userId, ipAddress: socket.handshake.address }
      });
      io.to(data.consultationId).emit('consultation-ended');
    });

    // E2EE Public Key Exchange
    socket.on('exchange-public-key', async (data: { consultationId: string, publicKey: string, fingerprint: string, userId: string }) => {
      // Log metadata only (fingerprint), server never sees the private key
      await prisma.auditEvent.create({
        data: { action: 'KEY_EXCHANGE', resource: `Consultation:${data.consultationId}`, userId: data.userId, ipAddress: socket.handshake.address }
      });
      socket.to(data.consultationId).emit('receive-public-key', { publicKey: data.publicKey, userId: data.userId });
    });

    // WebRTC Signaling
    socket.on('offer', (data: { consultationId: string, offer: any }) => {
      socket.to(data.consultationId).emit('offer', data.offer);
    });

    socket.on('answer', (data: { consultationId: string, answer: any }) => {
      socket.to(data.consultationId).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data: { consultationId: string, candidate: any }) => {
      socket.to(data.consultationId).emit('ice-candidate', data.candidate);
    });
    
    // Encrypted Chat Messages
    socket.on('chat-message', (data: { consultationId: string, ciphertext: string, iv: string }) => {
      // Server routes encrypted message, cannot read content
      socket.to(data.consultationId).emit('chat-message', data);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
