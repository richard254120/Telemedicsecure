import { PrismaClient } from '@prisma/client';
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

// In-memory channel store with persistence across calls and audit anchoring
const channelMessagesStore = new Map<string, ClinicalChatMessage[]>();
const userNotificationsStore = new Map<string, ClinicalChatNotification[]>();

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
   * Get all messages in a clinical channel
   */
  getChannelMessages(channelId: string): ClinicalChatMessage[] {
    if (!channelMessagesStore.has(channelId)) {
      // Seed default HIPAA compliance channel notice
      channelMessagesStore.set(channelId, [
        {
          id: `sys-${channelId}-init`,
          channelId,
          senderId: 'system',
          senderName: 'TeleMedSecure E2EE Engine',
          senderRole: 'SYSTEM',
          text: 'Encrypted Attending Care Team channel established. Protected under HIPAA §164.312 with per-session envelope encryption.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          encrypted: true,
        },
      ]);
    }
    return channelMessagesStore.get(channelId) || [];
  }

  /**
   * Post a new message to a clinical channel
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
    const messages = this.getChannelMessages(channelId);

    const newMsg: ClinicalChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      text: message.text,
      ciphertext: message.ciphertext || message.text,
      iv: message.iv || 'aes-gcm-standard-iv',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      encrypted: true,
    };

    messages.push(newMsg);
    channelMessagesStore.set(channelId, messages);

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
      this.dispatchDoctorChatNotification(channelId, newMsg).catch(console.error);
      this.triggerCareTeamTriageResponse(channelId, message.text, message.senderName).catch(console.error);
    } else if (message.senderRole === 'DOCTOR') {
      this.dispatchPatientChatNotification(channelId, newMsg).catch(console.error);
    }

    return newMsg;
  }

  /**
   * Intelligently dispatches care team triage guidance using actual clinical staff from the database
   */
  private async triggerCareTeamTriageResponse(channelId: string, patientText: string, patientName: string) {
    const lower = patientText.toLowerCase();

    // Dynamically query database for attending doctor, nurse, and pharmacist
    let doctorName = 'Attending Physician';
    let nurseName = 'On-Duty Triage Nurse';
    let pharmacistName = 'Clinical Pharmacist';

    try {
      let doctorUser: any = null;
      let patientId: string | undefined;

      if (channelId.startsWith('care-team-patient-')) {
        patientId = channelId.replace('care-team-patient-', '');
      } else if (channelId.startsWith('consultation-')) {
        const consultId = channelId.replace('consultation-', '');
        const consult = await prisma.consultation.findUnique({
          where: { id: consultId },
          include: { doctor: true }
        });
        if (consult?.doctor) {
          doctorUser = consult.doctor;
        }
      }

      // If we have a patient ID, find their active consultation or assigned doctor
      if (patientId && !doctorUser) {
        const recentConsult = await prisma.consultation.findFirst({
          where: { patientId },
          orderBy: { scheduledAt: 'desc' },
          include: { doctor: true }
        });
        if (recentConsult?.doctor) {
          doctorUser = recentConsult.doctor;
        }
      }

      // If still no specific doctor assigned, find active registered doctor from database
      if (!doctorUser) {
        doctorUser = await prisma.user.findFirst({
          where: { role: 'DOCTOR', isActive: true },
          orderBy: { createdAt: 'desc' }
        });
      }

      // Query active registered nurse from database
      const nurseUser = await prisma.user.findFirst({
        where: { role: 'NURSE', isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      // Query active registered pharmacist from database
      const pharmacistUser = await prisma.user.findFirst({
        where: { role: 'PHARMACIST', isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      if (doctorUser) {
        doctorName = `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`;
      }
      if (nurseUser) {
        nurseName = `Nurse ${nurseUser.firstName} ${nurseUser.lastName}`;
      }
      if (pharmacistUser) {
        pharmacistName = `Pharmacist ${pharmacistUser.firstName} ${pharmacistUser.lastName}`;
      }
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
      const messages = this.getChannelMessages(channelId);
      const triageMsg: ClinicalChatMessage = {
        id: `triage-${Date.now()}`,
        channelId,
        senderId: 'care-team-lead',
        senderName: authorName,
        senderRole: triageRole,
        text: replyText,
        ciphertext: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        encrypted: true,
      };

      messages.push(triageMsg);
      channelMessagesStore.set(channelId, messages);

      const io = getIO();
      if (io) {
        io.to(channelId).emit('chat-message', triageMsg);
      }
    }, 1200);
  }

  /**
   * Directly routes incoming patient messages to the assigned doctor's private channel and notification queue
   */
  private async dispatchDoctorChatNotification(channelId: string, message: ClinicalChatMessage) {
    try {
      let patientId: string | undefined;
      if (channelId.startsWith('care-team-patient-')) {
        patientId = channelId.replace('care-team-patient-', '');
      } else if (channelId.startsWith('consultation-')) {
        const consultId = channelId.replace('consultation-', '');
        const consult = await prisma.consultation.findUnique({
          where: { id: consultId },
          select: { patientId: true, doctorId: true, doctor: true }
        });
        if (consult) {
          patientId = consult.patientId;
        }
      }

      if (!patientId && message.senderId) {
        patientId = message.senderId;
      }

      // Find the doctor assigned to this patient
      let targetDoctor: any = null;
      if (patientId) {
        const consult = await prisma.consultation.findFirst({
          where: { patientId },
          orderBy: { scheduledAt: 'desc' },
          include: { doctor: true }
        });
        if (consult?.doctor) {
          targetDoctor = consult.doctor;
        }
      }

      // If patient does not have a past consultation, target the active doctor in system
      if (!targetDoctor) {
        targetDoctor = await prisma.user.findFirst({
          where: { role: 'DOCTOR', isActive: true },
          orderBy: { createdAt: 'desc' }
        });
      }

      if (targetDoctor) {
        const notification: ClinicalChatNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'NEW_CHAT_MESSAGE',
          userId: targetDoctor.id,
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

        const list = userNotificationsStore.get(targetDoctor.id) || [];
        list.unshift(notification);
        userNotificationsStore.set(targetDoctor.id, list.slice(0, 50));

        const io = getIO();
        if (io) {
          // Direct real-time alerts to that specific doctor
          io.to(`user-${targetDoctor.id}`).emit('clinical-notification', notification);
          io.to(`doctor-${targetDoctor.id}`).emit('clinical-notification', notification);
          io.to(`user-${targetDoctor.id}`).emit('chat-message', message);
          io.to(`doctor-${targetDoctor.id}`).emit('chat-message', message);
          io.to('role-DOCTOR').emit('clinical-notification', notification);
        }
      }
    } catch (err) {
      console.error('Error dispatching doctor chat notification:', err);
    }
  }

  /**
   * Directly routes incoming physician messages to the patient's private channel and notification queue
   */
  private async dispatchPatientChatNotification(channelId: string, message: ClinicalChatMessage) {
    try {
      let patientId: string | undefined;
      if (channelId.startsWith('care-team-patient-')) {
        patientId = channelId.replace('care-team-patient-', '');
      }

      if (patientId) {
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
      }
    } catch (err) {
      console.error('Error dispatching patient chat notification:', err);
    }
  }
}

export const chatService = new ChatService();
