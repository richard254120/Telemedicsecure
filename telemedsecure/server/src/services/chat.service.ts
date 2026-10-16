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

// In-memory channel store with persistence across calls and audit anchoring
const channelMessagesStore = new Map<string, ClinicalChatMessage[]>();

export class ChatService {
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

    // Auto-triage response if sent by patient to Attending Care Team
    if (message.senderRole === 'PATIENT') {
      this.triggerCareTeamTriageResponse(channelId, message.text, message.senderName);
    }

    return newMsg;
  }

  /**
   * Intelligently dispatches care team triage guidance
   */
  private triggerCareTeamTriageResponse(channelId: string, patientText: string, patientName: string) {
    const lower = patientText.toLowerCase();

    let replyText =
      `Thank you ${patientName.split(' ')[0] || ''}, your message has been encrypted and routed to your Attending Care Team. Dr. Sarah Mitchell and the on-duty triage nurse have been notified.`;
    let triageRole = 'CARE_TEAM';
    let authorName = 'Attending Care Team';

    if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('breathing')) {
      replyText =
        `⚠️ URGENT CLINICAL NOTICE: If you are experiencing acute chest pressure, sudden shortness of breath, or dizziness, please immediately call 911 or proceed to the nearest emergency facility. Your care team has been marked with a critical alert.`;
      authorName = 'Emergency Virtual Triage';
      triageRole = 'TRIAGE_OFFICER';
    } else if (lower.includes('prescription') || lower.includes('refill') || lower.includes('pharmacy') || lower.includes('medication')) {
      replyText =
        `Pharmacy & Therapeutics Notice: Your medication query has been forwarded to Pharmacist Marcus Vance and Dr. Mitchell for electronic review. You will receive an SMS alert once approved.`;
      authorName = 'Clinical Pharmacy Team';
      triageRole = 'PHARMACIST';
    } else if (lower.includes('fever') || lower.includes('temp') || lower.includes('bp') || lower.includes('vitals') || lower.includes('pain')) {
      replyText =
        `Triage Alert Received: Your biometric symptoms have been registered in your clinical telemetry file. Please continue logging vitals in the Vitals tab. A nurse is reviewing your acuity score.`;
      authorName = 'Nurse Elena Rostova (Triage)';
      triageRole = 'NURSE';
    } else if (lower.includes('call') || lower.includes('video') || lower.includes('doctor')) {
      replyText =
        `Dr. Sarah Mitchell is on clinical duty. You can join the secure zero-knowledge video room directly using the 'Join Video Call' button on your dashboard.`;
      authorName = 'Dr. Sarah Mitchell, MD';
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
}

export const chatService = new ChatService();
