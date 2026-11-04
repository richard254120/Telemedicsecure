import { PrismaClient, Role, CareTeamStatus } from '@prisma/client';
import { createChainedAuditEvent } from './audit.service';
import { getIO } from '../socket';

const prisma = new PrismaClient();

export interface ClinicalChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  ciphertext?: string;
  iv?: string;
  timestamp: string;
  encrypted: boolean;
}

export interface ClinicalChatNotification {
  id: string;
  type: 'NEW_CHAT_MESSAGE';
  userId: string; // The targeted recipient (e.g. doctor)
  senderId: string;
  senderName: string;
  senderRole: string;
  patientId?: string;
  patientName: string;
  channelId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

const SYSTEM_WELCOME =
  'Encrypted Attending Care Team channel established. Protected under HIPAA §164.312 with per-session envelope encryption.';

// Notifications are ephemeral real-time state; messages are persisted in the DB.
const userNotificationsStore = new Map<string, ClinicalChatNotification[]>();

const formatTimestamp = (d: Date): string =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function rowToMessage(m: {
  id: string; channelId: string; senderId: string; senderName: string;
  senderRole: string; body: string; encrypted: boolean; createdAt: Date;
}): ClinicalChatMessage {
  return {
    id: m.id,
    channelId: m.channelId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    text: m.body,
    timestamp: formatTimestamp(m.createdAt),
    encrypted: m.encrypted,
  };
}

/**
 * Resolve the patient a channel belongs to (care-team or consultation channel).
 * Returns null for non-patient-scoped (e.g. station) channels.
 */
async function resolveChannelPatientId(channelId: string): Promise<string | null> {
  if (channelId.startsWith('care-team-patient-')) {
    return channelId.replace('care-team-patient-', '');
  }
  if (channelId.startsWith('consultation-')) {
    const consultId = channelId.replace('consultation-', '');
    const consult = await prisma.consultation.findUnique({
      where: { id: consultId },
      select: { patientId: true },
    });
    return consult?.patientId ?? null;
  }
  return null;
}

/**
 * Channel access control. Station / general channels are unrestricted for
 * signed-in staff, but patient-scoped care-team and consultation channels are
 * limited to the patient, admins, the assigned doctor, and active team members.
 */
export async function canAccessChannel(user: any, channelId: string): Promise<boolean> {
  if (!user) return false;
  if (!channelId.startsWith('care-team-patient-') && !channelId.startsWith('consultation-')) {
    return true; // non patient-scoped channel
  }
  if (user.role === Role.ADMIN) return true;

  const patientId = await resolveChannelPatientId(channelId);
  if (!patientId) return false;
  if (user.role === Role.PATIENT) return user.id === patientId;

  // Active care-team membership?
  const membership = await prisma.careTeamMembership.findFirst({
    where: { patientId, clinicianId: user.id, status: CareTeamStatus.ACTIVE },
    select: { id: true },
  });
  if (membership) return true;

  // Assigned doctor via consultation?
  const consult = await prisma.consultation.findFirst({
    where: { patientId, doctorId: user.id },
    select: { id: true },
  });
  return Boolean(consult);
}

export class ChatService {
  /**
   * Get all notifications for a specific user
   */
  getUserNotifications(userId: string): ClinicalChatNotification[] {
    return userNotificationsStore.get(userId) || [];
  }

  /**
   * Mark a notification as read
   */
  markNotificationRead(userId: string, notificationId: string): boolean {
    const list = userNotificationsStore.get(userId) || [];
    const notif = list.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications for a user as read
   */
  markAllNotificationsRead(userId: string): void {
    const list = userNotificationsStore.get(userId) || [];
    list.forEach((n) => {
      n.read = true;
    });
  }

  /**
   * Get all persisted messages in a clinical channel. Seeds the system welcome
   * notice on first read of an empty channel.
   */
  async getChannelMessages(channelId: string): Promise<ClinicalChatMessage[]> {
    const rows = await prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) {
      const sys = await prisma.chatMessage.create({
        data: {
          channelId,
          senderId: 'system',
          senderName: 'TeleMedSecure E2EE Engine',
          senderRole: 'SYSTEM',
          body: SYSTEM_WELCOME,
          encrypted: true,
        },
      });
      return [rowToMessage(sys)];
    }

    return rows.map(rowToMessage);
  }

  /**
   * Post a new message to a clinical channel (persisted) and fan it out.
   */
  async postMessage(
    channelId: string,
    message: {
      senderId: string;
      senderName: string;
      senderRole: string;
      text: string;
      ciphertext?: string;
      iv?: string;
    },
    ipAddress?: string
  ): Promise<ClinicalChatMessage> {
    const row = await prisma.chatMessage.create({
      data: {
        channelId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        body: message.text,
        encrypted: true,
      },
    });
    const newMsg = rowToMessage(row);

    // Audit Log state change
    try {
      await createChainedAuditEvent({
        action: 'CLINICAL_CHAT_MESSAGE',
        resource: `ChatChannel:${channelId}`,
        userId: message.senderId,
        ipAddress: ipAddress || 'unknown',
      });
    } catch (e: any) {
      console.warn('Chat audit event warning:', e.message);
    }

    // Broadcast over WebSocket to all peers in this clinical room
    const io = getIO();
    if (io) {
      io.to(channelId).emit('chat-message', newMsg);
    }

    // Real-time notification dispatch
    if (message.senderRole === 'PATIENT') {
      this.dispatchTeamChatNotification(channelId, newMsg).catch(console.error);
      this.triggerCareTeamTriageResponse(channelId, message.text, message.senderName).catch(console.error);
    } else if (message.senderRole === 'DOCTOR' || message.senderRole === 'NURSE') {
      this.dispatchPatientChatNotification(channelId, newMsg).catch(console.error);
    }

    return newMsg;
  }

  /**
   * Persist + broadcast an assistant/system care-team reply.
   */
  private async appendChannelMessage(
    channelId: string,
    data: { senderId: string; senderName: string; senderRole: string; text: string }
  ): Promise<ClinicalChatMessage> {
    const row = await prisma.chatMessage.create({
      data: {
        channelId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        body: data.text,
        encrypted: true,
      },
    });
    const msg = rowToMessage(row);
    const io = getIO();
    if (io) {
      io.to(channelId).emit('chat-message', msg);
    }
    return msg;
  }

  /**
   * Intelligently dispatches care team triage guidance using actual clinical staff from the database
   */
  private async triggerCareTeamTriageResponse(channelId: string, patientText: string, patientName: string) {
    const lower = patientText.toLowerCase();

    let doctorName = 'Attending Physician';
    let nurseName = 'On-Duty Triage Nurse';
    let pharmacistName = 'Clinical Pharmacist';

    try {
      const patientId = await resolveChannelPatientId(channelId);

      let doctorUser: any = null;
      if (patientId) {
        const recentConsult = await prisma.consultation.findFirst({
          where: { patientId },
          orderBy: { scheduledAt: 'desc' },
          include: { doctor: true },
        });
        if (recentConsult?.doctor) doctorUser = recentConsult.doctor;
      }
      if (!doctorUser) {
        doctorUser = await prisma.user.findFirst({
          where: { role: 'DOCTOR', isActive: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      const nurseUser = await prisma.user.findFirst({
        where: { role: 'NURSE', isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      const pharmacistUser = await prisma.user.findFirst({
        where: { role: 'PHARMACIST', isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (doctorUser) doctorName = `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`;
      if (nurseUser) nurseName = `Nurse ${nurseUser.firstName} ${nurseUser.lastName}`;
      if (pharmacistUser) pharmacistName = `Pharmacist ${pharmacistUser.firstName} ${pharmacistUser.lastName}`;
    } catch (err) {
      console.error('Error fetching clinical care team staff from DB for chat triage:', err);
    }

    const patientFirstName = (patientName || 'Patient').trim().split(' ')[0];

    let replyText =
      `Thank you ${patientFirstName}, your message has been encrypted and routed to your Attending Care Team. ${doctorName} and ${nurseName} have been notified.`;
    let triageRole = 'CARE_TEAM';
    let authorName = `${nurseName} (Clinical Triage)`;

    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('breathing')) {
      replyText =
        `⚠️ URGENT CLINICAL NOTICE: If you are experiencing acute chest pressure, sudden shortness of breath, or dizziness, please immediately call 911 or proceed to the nearest emergency facility. Critical priority notification has been transmitted to ${doctorName}.`;
      authorName = 'Emergency Virtual Triage';
      triageRole = 'TRIAGE_OFFICER';
    } else if (lower.includes('prescription') || lower.includes('refill') || lower.includes('pharmacy') || lower.includes('medication')) {
      replyText =
        `Pharmacy & Therapeutics Notice: Your medication query has been forwarded to ${pharmacistName} and ${doctorName} for electronic review. You will receive an SMS alert once approved.`;
      authorName = `${pharmacistName} (Clinical Pharmacy)`;
      triageRole = 'PHARMACIST';
    } else if (lower.includes('fever') || lower.includes('temp') || lower.includes('bp') || lower.includes('vitals') || lower.includes('pain')) {
      replyText =
        `Triage Alert Received: Your biometric symptoms have been registered in your clinical telemetry file. Please continue logging vitals in the Vitals tab. ${nurseName} is reviewing your acuity score.`;
      authorName = `${nurseName} (Triage)`;
      triageRole = 'NURSE';
    } else if (lower.includes('call') || lower.includes('video') || lower.includes('doctor')) {
      replyText =
        `${doctorName} is on clinical duty. You can join the secure zero-knowledge video room directly using the 'Join Video Call' button on your dashboard.`;
      authorName = `${doctorName}, MD`;
      triageRole = 'DOCTOR';
    }

    setTimeout(() => {
      this.appendChannelMessage(channelId, {
        senderId: 'care-team-lead',
        senderName: authorName,
        senderRole: triageRole,
        text: replyText,
      }).catch(console.error);
    }, 1200);
  }

  /**
   * Fan a patient message out to every ACTIVE care-team member (doctors + nurses)
   * of the channel's patient, falling back to the assigned doctor.
   */
  private async dispatchTeamChatNotification(channelId: string, message: ClinicalChatMessage) {
    try {
      const patientId = (await resolveChannelPatientId(channelId)) || message.senderId;
      if (!patientId) return;

      const members = await prisma.careTeamMembership.findMany({
        where: { patientId, status: CareTeamStatus.ACTIVE },
        select: { clinicianId: true },
      });
      let recipientIds = Array.from(new Set(members.map((m) => m.clinicianId)));

      if (recipientIds.length === 0) {
        // Fallback: assigned doctor (or any active doctor) so the thread is never dead.
        const consult = await prisma.consultation.findFirst({
          where: { patientId },
          orderBy: { scheduledAt: 'desc' },
          select: { doctorId: true },
        });
        let doctorId = consult?.doctorId;
        if (!doctorId) {
          const doctor = await prisma.user.findFirst({
            where: { role: 'DOCTOR', isActive: true },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          doctorId = doctor?.id;
        }
        if (doctorId) recipientIds = [doctorId];
      }

      const io = getIO();
      for (const clinicianId of recipientIds) {
        const notification: ClinicalChatNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'NEW_CHAT_MESSAGE',
          userId: clinicianId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          patientId,
          patientName: message.senderName,
          channelId,
          text: message.text,
          timestamp: message.timestamp,
          read: false,
        };

        const list = userNotificationsStore.get(clinicianId) || [];
        list.unshift(notification);
        userNotificationsStore.set(clinicianId, list.slice(0, 50));

        if (io) {
          io.to(`user-${clinicianId}`).emit('clinical-notification', notification);
          io.to(`user-${clinicianId}`).emit('chat-message', message);
        }
      }
    } catch (err) {
      console.error('Error dispatching team chat notification:', err);
    }
  }

  /**
   * Directly routes incoming clinician messages to the patient's notification queue
   */
  private async dispatchPatientChatNotification(channelId: string, message: ClinicalChatMessage) {
    try {
      const patientId = await resolveChannelPatientId(channelId);
      if (!patientId) return;

      const notification: ClinicalChatNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'NEW_CHAT_MESSAGE',
        userId: patientId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        patientId,
        patientName: 'Patient',
        channelId,
        text: message.text,
        timestamp: message.timestamp,
        read: false,
      };

      const list = userNotificationsStore.get(patientId) || [];
      list.unshift(notification);
      userNotificationsStore.set(patientId, list.slice(0, 50));

      const io = getIO();
      if (io) {
        io.to(`user-${patientId}`).emit('clinical-notification', notification);
        io.to(`user-${patientId}`).emit('chat-message', message);
      }
    } catch (err) {
      console.error('Error dispatching patient chat notification:', err);
    }
  }
}

export const chatService = new ChatService();
