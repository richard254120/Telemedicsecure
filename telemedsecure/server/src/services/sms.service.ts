import { PrismaClient } from '@prisma/client';
import { createChainedAuditEvent } from './audit.service';

const prisma = new PrismaClient();

export interface SMSMessageRequest {
  to: string;
  message: string;
  purpose: 'APPOINTMENT_REMINDER' | 'DIRECT_JOIN_LINK' | 'PRESCRIPTION_READY' | 'EMERGENCY_VITALS' | 'STAFF_INVITE' | 'GENERAL';
  referenceId?: string;
  userId?: string;
}

export interface SMSLogEntry {
  id: string;
  to: string;
  message: string;
  purpose: string;
  referenceId?: string;
  userId?: string;
  status: 'DELIVERED' | 'SENT' | 'SIMULATED' | 'FAILED';
  provider: 'twilio' | 'africastalking' | 'simulated';
  carrierResponse?: any;
  sentAt: string;
}

// In-memory ring buffer for recent SMS deliveries for dashboard inspection & auditing
const recentSMSLogs: SMSLogEntry[] = [];
const MAX_LOGS = 100;

class SMSService {
  private getProvider(): 'twilio' | 'africastalking' | 'simulated' {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      return 'twilio';
    }
    if (process.env.AT_API_KEY && process.env.AT_USERNAME) {
      return 'africastalking';
    }
    return 'simulated';
  }

  public getStatus() {
    const provider = this.getProvider();
    return {
      activeProvider: provider,
      isLiveConfigured: provider !== 'simulated',
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER),
      africasTalkingConfigured: Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME),
      totalDispatched: recentSMSLogs.length,
      defaultSenderNumber: process.env.TWILIO_PHONE_NUMBER || process.env.AT_SENDER_ID || '+1 (555) 019-TELEMED',
    };
  }

  public getLogs(limit: number = 50): SMSLogEntry[] {
    return recentSMSLogs.slice(0, limit);
  }

  public async sendSMS(req: SMSMessageRequest): Promise<SMSLogEntry> {
    const { to, message, purpose, referenceId, userId } = req;
    const provider = this.getProvider();
    const logId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    let deliveryStatus: 'DELIVERED' | 'SENT' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
    let carrierResponse: any = null;

    try {
      if (provider === 'twilio') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID!;
        const authToken = process.env.TWILIO_AUTH_TOKEN!;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const formParams = new URLSearchParams();
        formParams.append('To', to);
        formParams.append('From', fromNumber);
        formParams.append('Body', message);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formParams.toString(),
        });

        carrierResponse = await response.json();
        if (response.ok) {
          deliveryStatus = 'DELIVERED';
        } else {
          deliveryStatus = 'FAILED';
          console.error('[SMS Service] Twilio Error:', carrierResponse);
        }
      } else if (provider === 'africastalking') {
        const username = process.env.AT_USERNAME!;
        const apiKey = process.env.AT_API_KEY!;
        const endpoint = 'https://api.africastalking.com/version1/messaging';

        const formParams = new URLSearchParams();
        formParams.append('username', username);
        formParams.append('to', to);
        formParams.append('message', message);
        if (process.env.AT_SENDER_ID) {
          formParams.append('from', process.env.AT_SENDER_ID);
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apiKey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: formParams.toString(),
        });

        carrierResponse = await response.json();
        deliveryStatus = response.ok ? 'DELIVERED' : 'FAILED';
      } else {
        // Simulated mode for development & evaluation
        deliveryStatus = 'SIMULATED';
        carrierResponse = {
          sid: `SIM_${Date.now()}`,
          status: 'simulated_delivered',
          channel: 'GSM_SMS_GATEWAY',
          note: 'Delivered in local development mode',
        };
        console.log(`\n======================================================`);
        console.log(`[SMS DISPATCHED (${deliveryStatus})]`);
        console.log(`To:        ${to}`);
        console.log(`Purpose:   ${purpose}`);
        console.log(`Ref ID:    ${referenceId || 'N/A'}`);
        console.log(`Message:\n${message}`);
        console.log(`======================================================\n`);
      }

      // Log into tamper-evident Audit Event Chain
      await createChainedAuditEvent({
        action: 'SMS_NOTIFICATION_DISPATCHED',
        resource: `SMS:${purpose}:${to.slice(-4).padStart(to.length, '*')}`,
        userId: userId || null,
        ipAddress: 'SYSTEM_SMS_GATEWAY',
        userAgent: `SMS_SERVICE/${provider}`,
      });
    } catch (err: any) {
      console.error('[SMS Service] Dispatch error:', err);
      deliveryStatus = 'FAILED';
      carrierResponse = { error: err.message };
    }

    const logEntry: SMSLogEntry = {
      id: logId,
      to,
      message,
      purpose,
      referenceId,
      userId,
      status: deliveryStatus,
      provider,
      carrierResponse,
      sentAt: nowIso,
    };

    recentSMSLogs.unshift(logEntry);
    if (recentSMSLogs.length > MAX_LOGS) {
      recentSMSLogs.pop();
    }

    return logEntry;
  }

  // Specialized Clinical SMS Dispatchers

  public async sendAppointmentInviteSMS(params: {
    to: string;
    patientName: string;
    doctorName: string;
    scheduledAt: string;
    consultationId: string;
    frontendUrl?: string;
  }) {
    const origin = params.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    const joinUrl = `${origin}/call/${params.consultationId}`;
    const dateFormatted = new Date(params.scheduledAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const msg = `TeleMedSecure: Hello ${params.patientName}, your consultation with Dr. ${params.doctorName} is confirmed for ${dateFormatted}. Connect securely via E2EE video at: ${joinUrl}`;

    return this.sendSMS({
      to: params.to,
      message: msg,
      purpose: 'APPOINTMENT_REMINDER',
      referenceId: params.consultationId,
    });
  }

  public async sendDoctorReadySMS(params: {
    to: string;
    patientName: string;
    doctorName: string;
    consultationId: string;
    frontendUrl?: string;
  }) {
    const origin = params.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    const joinUrl = `${origin}/call/${params.consultationId}`;

    const msg = `TeleMedSecure ALERT: Dr. ${params.doctorName} has entered your consultation room and is waiting for you. Tap here to join now: ${joinUrl}`;

    return this.sendSMS({
      to: params.to,
      message: msg,
      purpose: 'DIRECT_JOIN_LINK',
      referenceId: params.consultationId,
    });
  }

  public async sendPrescriptionDispensedSMS(params: {
    to: string;
    patientName: string;
    rxId: string;
    medicationCount: number;
    pharmacyName?: string;
  }) {
    const pharmacy = params.pharmacyName || 'TeleMedSecure Clinical Pharmacy';
    const msg = `TeleMedSecure Rx: Hello ${params.patientName}, your prescription #${params.rxId.slice(0, 8).toUpperCase()} (${params.medicationCount} item${params.medicationCount > 1 ? 's' : ''}) has been verified and dispensed by ${pharmacy}. Please follow all dosage instructions.`;

    return this.sendSMS({
      to: params.to,
      message: msg,
      purpose: 'PRESCRIPTION_READY',
      referenceId: params.rxId,
    });
  }

  public async sendCriticalVitalsAlertSMS(params: {
    to: string;
    doctorName?: string;
    patientName: string;
    metric: string;
    value: string;
    consultationId?: string;
  }) {
    const msg = `CRITICAL ALERT - TeleMedSecure: Patient ${params.patientName} has recorded abnormal vitals [${params.metric}: ${params.value}]. Immediate clinical triage review required.`;

    return this.sendSMS({
      to: params.to,
      message: msg,
      purpose: 'EMERGENCY_VITALS',
      referenceId: params.consultationId,
    });
  }

  public async sendStaffInvitationSMS(params: {
    to: string;
    role: string;
    inviteUrl: string;
  }) {
    const msg = `TeleMedSecure: You have been provisioned as a ${params.role} at the hospital. Complete your secure cryptographic onboarding here: ${params.inviteUrl}`;

    return this.sendSMS({
      to: params.to,
      message: msg,
      purpose: 'STAFF_INVITE',
    });
  }
}

export const smsService = new SMSService();
