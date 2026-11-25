import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WaitingRoomInfo {
  consultationId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: string;
  joinedAt: string;
  hasPatient: boolean;
  hasDoctor: boolean;
}

// In-memory active call & waiting rooms tracker
const activeCallRooms = new Map<string, {
  consultationId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: string;
  joinedAt: string;
  patientSockets: Set<string>;
  doctorSockets: Set<string>;
}>();

// Socket to consultation mapping
const socketSessionMap = new Map<string, { consultationId: string; userId: string; role: string }>();

export const getWaitingRoomsSnapshot = (): WaitingRoomInfo[] => {
  const result: WaitingRoomInfo[] = [];
  for (const [consultationId, room] of activeCallRooms.entries()) {
    if (room.patientSockets.size > 0 || room.doctorSockets.size > 0) {
      result.push({
        consultationId,
        patientId: room.patientId,
        patientName: room.patientName,
        doctorId: room.doctorId,
        doctorName: room.doctorName,
        scheduledAt: room.scheduledAt,
        joinedAt: room.joinedAt,
        hasPatient: room.patientSockets.size > 0,
        hasDoctor: room.doctorSockets.size > 0,
      });
    }
  }
  return result;
};

export const setupSignaling = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    // In a real app, authenticate socket via middleware using JWT
    console.log(`Socket connected: ${socket.id}`);

    // Direct user socket registration for real-time notifications & targeted alerts
    socket.on('register-user', (data: { userId?: string, role?: string }) => {
      const { userId, role } = data || {};
      if (userId) {
        socket.join(`user-${userId}`);
        if (role === 'DOCTOR') {
          socket.join(`doctor-${userId}`);
        }
        console.log(`Socket ${socket.id} registered for user-${userId} (${role})`);
      }
      if (role) {
        socket.join(`role-${role}`);
      }

      // Immediately push any active waiting rooms where someone is waiting for this user
      sendActiveAlertsToSocket(socket, userId, role);
    });

    // Request active waiting room alerts on demand
    socket.on('get-active-call-alerts', (data: { userId?: string, role?: string }) => {
      sendActiveAlertsToSocket(socket, data?.userId, data?.role);
    });

    socket.on('join-room', async (data: { consultationId: string, userId: string, role: string }) => {
      const { consultationId, userId, role } = data;
      socket.join(consultationId);
      if (userId) {
        socket.join(`user-${userId}`);
        if (role === 'DOCTOR') {
          socket.join(`doctor-${userId}`);
        }
      }
      if (role) {
        socket.join(`role-${role}`);
      }
      socketSessionMap.set(socket.id, { consultationId, userId, role });
      socket.to(consultationId).emit('user-joined', { userId, role });
      console.log(`User ${userId} (${role}) joined ${consultationId}`);

      // Track active call participants & dispatch immediate alerts
      try {
        const consultation = await prisma.consultation.findUnique({
          where: { id: consultationId },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, email: true } },
            doctor: { select: { id: true, firstName: true, lastName: true, email: true } },
          }
        });

        if (consultation) {
          let room = activeCallRooms.get(consultationId);
          if (!room) {
            room = {
              consultationId,
              patientId: consultation.patientId,
              patientName: `${consultation.patient.firstName} ${consultation.patient.lastName}`,
              doctorId: consultation.doctorId,
              doctorName: `Dr. ${consultation.doctor.firstName} ${consultation.doctor.lastName}`,
              scheduledAt: consultation.scheduledAt.toISOString(),
              joinedAt: new Date().toISOString(),
              patientSockets: new Set(),
              doctorSockets: new Set(),
            };
            activeCallRooms.set(consultationId, room);
          }

          if (role === 'PATIENT') {
            room.patientSockets.add(socket.id);

            // Alert Doctor and Nurses that the patient is in the call room
            const alertPayload = {
              type: 'PATIENT_IN_CALL',
              consultationId,
              patientId: consultation.patientId,
              patientName: `${consultation.patient.firstName} ${consultation.patient.lastName}`,
              doctorId: consultation.doctorId,
              doctorName: `Dr. ${consultation.doctor.firstName} ${consultation.doctor.lastName}`,
              scheduledAt: consultation.scheduledAt.toISOString(),
              joinedAt: room.joinedAt,
              message: `Patient ${consultation.patient.firstName} ${consultation.patient.lastName} has entered the Consultation Room and is waiting for you!`,
            };

            io.to(`doctor-${consultation.doctorId}`).emit('consultation-call-alert', alertPayload);
            io.to(`user-${consultation.doctorId}`).emit('consultation-call-alert', alertPayload);
            io.to('role-NURSE').emit('consultation-call-alert', alertPayload);
            io.to('role-DOCTOR').emit('consultation-call-alert', alertPayload);
            console.log(`[Alert] Patient ${consultation.patient.firstName} entered call room ${consultationId} - alert pushed to doctor ${consultation.doctorId}`);
          } else if (role === 'DOCTOR') {
            room.doctorSockets.add(socket.id);

            // Alert Patient that Doctor has joined the call
            const alertPayload = {
              type: 'DOCTOR_IN_CALL',
              consultationId,
              patientId: consultation.patientId,
              patientName: `${consultation.patient.firstName} ${consultation.patient.lastName}`,
              doctorId: consultation.doctorId,
              doctorName: `Dr. ${consultation.doctor.firstName} ${consultation.doctor.lastName}`,
              scheduledAt: consultation.scheduledAt.toISOString(),
              joinedAt: new Date().toISOString(),
              message: `Dr. ${consultation.doctor.firstName} ${consultation.doctor.lastName} is in your Consultation Call Room ready to begin!`,
            };

            io.to(`user-${consultation.patientId}`).emit('consultation-call-alert', alertPayload);
            console.log(`[Alert] Doctor ${consultation.doctor.firstName} entered call room ${consultationId} - alert pushed to patient ${consultation.patientId}`);
          }
        }
      } catch (err: any) {
        console.error('Error handling join-room notification:', err.message);
      }
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
      
      // Clean up room and notify all
      activeCallRooms.delete(data.consultationId);
      io.emit('consultation-call-ended', { consultationId: data.consultationId });
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

    // Leave consultation room
    socket.on('leave-room', (data: { consultationId: string, userId?: string }) => {
      handleSocketLeavingRoom(socket, data.consultationId);
      socket.leave(data.consultationId);
      socket.to(data.consultationId).emit('user-left', { userId: data.userId });
      console.log(`User ${data.userId || socket.id} left ${data.consultationId}`);
    });

    socket.on('disconnecting', () => {
      const session = socketSessionMap.get(socket.id);
      if (session) {
        handleSocketLeavingRoom(socket, session.consultationId);
        socketSessionMap.delete(socket.id);
      }
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('user-left', { socketId: socket.id });
        }
      }
    });

    socket.on('disconnect', () => {
      socketSessionMap.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  function handleSocketLeavingRoom(socket: Socket, consultationId: string) {
    const room = activeCallRooms.get(consultationId);
    if (!room) return;

    room.patientSockets.delete(socket.id);
    room.doctorSockets.delete(socket.id);

    // If both empty, remove room and emit clear alert
    if (room.patientSockets.size === 0 && room.doctorSockets.size === 0) {
      activeCallRooms.delete(consultationId);
      io.emit('consultation-call-ended', { consultationId });
    } else if (room.patientSockets.size === 0) {
      io.emit('patient-left-call', { consultationId });
    }
  }

  function sendActiveAlertsToSocket(socket: Socket, userId?: string, role?: string) {
    if (!userId) return;

    for (const [consultationId, room] of activeCallRooms.entries()) {
      if (role === 'DOCTOR' && room.doctorId === userId && room.patientSockets.size > 0 && room.doctorSockets.size === 0) {
        socket.emit('consultation-call-alert', {
          type: 'PATIENT_IN_CALL',
          consultationId,
          patientId: room.patientId,
          patientName: room.patientName,
          doctorId: room.doctorId,
          doctorName: room.doctorName,
          scheduledAt: room.scheduledAt,
          joinedAt: room.joinedAt,
          message: `Patient ${room.patientName} is waiting in the Consultation Call Room!`,
        });
      } else if (role === 'PATIENT' && room.patientId === userId && room.doctorSockets.size > 0) {
        socket.emit('consultation-call-alert', {
          type: 'DOCTOR_IN_CALL',
          consultationId,
          patientId: room.patientId,
          patientName: room.patientName,
          doctorId: room.doctorId,
          doctorName: room.doctorName,
          scheduledAt: room.scheduledAt,
          joinedAt: room.joinedAt,
          message: `${room.doctorName} is in your Consultation Call Room ready to begin!`,
        });
      } else if (role === 'NURSE' && room.patientSockets.size > 0) {
        socket.emit('consultation-call-alert', {
          type: 'PATIENT_IN_CALL',
          consultationId,
          patientId: room.patientId,
          patientName: room.patientName,
          doctorId: room.doctorId,
          doctorName: room.doctorName,
          scheduledAt: room.scheduledAt,
          joinedAt: room.joinedAt,
          message: `Patient ${room.patientName} is waiting in Consultation #${consultationId.slice(0, 8)}`,
        });
      }
    }
  }
};
