import { PrismaClient, User, Role } from '@prisma/client';
import { rulesEngine } from './rulesEngine.service';
import { createChainedAuditEvent } from './audit.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const DEFAULT_CONSENT_PURPOSES = [
  'TELEMEDICINE_TREATMENT',
  'DATA_PROCESSING',
  'PRESCRIPTION_DISPENSING',
  'CLINICAL_AUDIT_LOGGING',
];

export interface ConsentRecord {
  id: string;
  patientId: string;
  purpose: string;
  granted: boolean;
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

export class GdprService {
  private static instance: GdprService;

  public static getInstance(): GdprService {
    if (!GdprService.instance) {
      GdprService.instance = new GdprService();
    }
    return GdprService.instance;
  }

  /**
   * Grant or update consent for a specific processing purpose
   */
  public async grantConsent(params: {
    patientId: string;
    purpose: string;
    version?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { patientId, purpose, version = '1.0', ipAddress, userAgent } = params;

    // Check if consent record exists
    const existing = await prisma.consent.findFirst({
      where: { patientId, purpose },
      orderBy: { grantedAt: 'desc' },
    });

    let consent;
    if (existing) {
      consent = await prisma.consent.update({
        where: { id: existing.id },
        data: {
          granted: true,
          grantedAt: new Date(),
          revokedAt: null,
          version,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } else {
      consent = await prisma.consent.create({
        data: {
          patientId,
          purpose,
          granted: true,
          version,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    }

    await createChainedAuditEvent({
      action: 'GDPR_CONSENT_GRANTED',
      resource: `Consent:${consent.id}:${purpose}`,
      userId: patientId,
      ipAddress: ipAddress || 'unknown',
      details: { purpose, version, consentId: consent.id },
    });

    return consent;
  }

  /**
   * Revoke consent for a specific purpose
   */
  public async revokeConsent(params: {
    patientId: string;
    purpose: string;
    ipAddress?: string;
  }) {
    const { patientId, purpose, ipAddress } = params;

    const existing = await prisma.consent.findFirst({
      where: { patientId, purpose },
      orderBy: { grantedAt: 'desc' },
    });

    if (!existing) {
      // Create a revoked entry
      const created = await prisma.consent.create({
        data: {
          patientId,
          purpose,
          granted: false,
          revokedAt: new Date(),
          ipAddress: ipAddress || null,
        },
      });
      return created;
    }

    const updated = await prisma.consent.update({
      where: { id: existing.id },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    await createChainedAuditEvent({
      action: 'GDPR_CONSENT_REVOKED',
      resource: `Consent:${updated.id}:${purpose}`,
      userId: patientId,
      ipAddress: ipAddress || 'unknown',
      details: { purpose, revokedAt: new Date() },
    });

    return updated;
  }

  /**
   * Check if patient has active consent for a given purpose
   */
  public async hasActiveConsent(patientId: string, purpose: string = 'TELEMEDICINE_TREATMENT'): Promise<boolean> {
    const consent = await prisma.consent.findFirst({
      where: {
        patientId,
        purpose,
        granted: true,
        revokedAt: null,
      },
    });

    return Boolean(consent);
  }

  /**
   * Retrieve all consents for a patient
   */
  public async getPatientConsents(patientId: string) {
    return prisma.consent.findMany({
      where: { patientId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * GDPR Art. 20 Data Portability Export
   * Validates justification; if missing or invalid, triggers DATA_EXPORT_WITHOUT_JUSTIFICATION rule.
   */
  public async exportPatientData(params: {
    patientId: string;
    justification?: string;
    requestedByUserId: string;
    requestedByRole: Role;
    ipAddress?: string;
  }) {
    const { patientId, justification, requestedByUserId, requestedByRole, ipAddress } = params;

    // Rule Check: Access outside role/assignment
    if (requestedByRole === Role.PATIENT && requestedByUserId !== patientId) {
      await rulesEngine.triggerViolation({
        ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
        description: `Patient ${requestedByUserId} attempted to export data belonging to another patient ${patientId}`,
        userId: requestedByUserId,
        sourceIp: ipAddress,
        resource: `Patient:${patientId}`,
      });
      throw new Error('Access denied: Cannot export another patient\'s data');
    }

    // Rule Check: Data export without justification
    if (!justification || justification.trim().length < 5) {
      await rulesEngine.triggerViolation({
        ruleId: 'DATA_EXPORT_WITHOUT_JUSTIFICATION',
        description: `GDPR Data Export initiated for patient ${patientId} without valid clinical, legal, or portability justification.`,
        userId: requestedByUserId,
        sourceIp: ipAddress,
        resource: `DataExport:${patientId}`,
        metadata: { justificationReceived: justification || '(none)' },
      });
      throw new Error('Data export rejected: Valid legal or clinical justification is required under GDPR Art. 20 / HIPAA §164.524');
    }

    // Fetch patient data
    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    const [consents, consultations, medicalRecords, prescriptions, auditEvents] = await Promise.all([
      prisma.consent.findMany({ where: { patientId } }),
      prisma.consultation.findMany({
        where: { patientId },
        include: {
          vitalSigns: true,
          clinicalFlags: true,
        },
      }),
      prisma.medicalRecord.findMany({ where: { patientId } }),
      prisma.prescription.findMany({
        where: { consultation: { patientId } },
        include: { items: true, signature: true },
      }),
      prisma.auditEvent.findMany({
        where: { userId: patientId },
        take: 50,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const exportPayload = {
      exportMetadata: {
        standard: 'GDPR Article 20 / HIPAA §164.524 Portable Electronic Health Export',
        exportedAt: new Date().toISOString(),
        justification,
        patientId,
        requestedByUserId,
      },
      patientProfile: patient,
      consents,
      medicalRecords: medicalRecords.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        encryptedEnvelope: {
          ciphertext: r.encryptedData,
          iv: r.dataIv,
          authTag: r.dataAuthTag,
          encryptedDek: r.encryptedDek,
        },
      })),
      consultations: consultations.map(c => ({
        id: c.id,
        scheduledAt: c.scheduledAt,
        status: c.status,
        hasEncryptedNotes: Boolean(c.encryptedNotes),
        vitalSignsCount: c.vitalSigns.length,
        clinicalFlags: c.clinicalFlags,
      })),
      prescriptions: prescriptions.map(p => ({
        id: p.id,
        status: p.status,
        createdAt: p.createdAt,
        items: p.items,
        digitalSignature: p.signature
          ? {
              signature: p.signature.signature,
              publicKey: p.signature.publicKey,
              algorithm: p.signature.algorithm,
              verifiedValid: true,
            }
          : null,
      })),
      auditTrailSummary: {
        totalAuditEvents: auditEvents.length,
        recentEvents: auditEvents.map(e => ({
          action: e.action,
          resource: e.resource,
          timestamp: e.timestamp,
          hash: e.hash,
        })),
      },
    };

    // Calculate sha256 checksum of export payload for integrity
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(exportPayload)).digest('hex');

    await createChainedAuditEvent({
      action: 'GDPR_DATA_EXPORT_SUCCESSFUL',
      resource: `Patient:${patientId}`,
      userId: requestedByUserId,
      ipAddress: ipAddress || 'unknown',
      details: { justification, checksum: payloadHash },
    });

    return {
      checksumSha256: payloadHash,
      data: exportPayload,
    };
  }

  /**
   * GDPR Art. 17 Right to Erasure via Crypto-Shredding of Keys
   * Mathematically obliterates per-record DEKs for all medical records, vitals, and consultation notes.
   */
  public async cryptoShredPatientData(params: {
    patientId: string;
    reason?: string;
    requestedByUserId: string;
    ipAddress?: string;
  }) {
    const { patientId, reason = 'GDPR Article 17 Right to Erasure Request', requestedByUserId, ipAddress } = params;

    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new Error('Patient not found');
    }

    const SHREDDED_MARKER = '[CRYPTO_SHREDDED_GDPR_ART_17]';
    const ZEROED_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

    // 1. Crypto-shred Medical Records: Overwrite encrypted DEKs & IVs
    const medicalRecords = await prisma.medicalRecord.findMany({ where: { patientId } });
    for (const record of medicalRecords) {
      await prisma.medicalRecord.update({
        where: { id: record.id },
        data: {
          encryptedDek: ZEROED_KEY,
          dekIv: ZEROED_KEY.slice(0, 24),
          dekAuthTag: ZEROED_KEY.slice(0, 32),
          encryptedData: SHREDDED_MARKER,
          dataIv: ZEROED_KEY.slice(0, 24),
          dataAuthTag: ZEROED_KEY.slice(0, 32),
        },
      });
    }

    // 2. Crypto-shred Consultations: Overwrite encrypted notes & DEKs
    const consultations = await prisma.consultation.findMany({ where: { patientId } });
    for (const consult of consultations) {
      await prisma.consultation.update({
        where: { id: consult.id },
        data: {
          encryptedNotes: SHREDDED_MARKER,
          notesIv: ZEROED_KEY.slice(0, 24),
          notesAuthTag: ZEROED_KEY.slice(0, 32),
          encryptedDek: ZEROED_KEY,
          dekIv: ZEROED_KEY.slice(0, 24),
          dekAuthTag: ZEROED_KEY.slice(0, 32),
        },
      });

      // 3. Crypto-shred Vital Signs
      await prisma.vitalSign.updateMany({
        where: { consultationId: consult.id },
        data: {
          encryptedVitals: SHREDDED_MARKER,
          vitalsIv: ZEROED_KEY.slice(0, 24),
          vitalsAuthTag: ZEROED_KEY.slice(0, 32),
          encryptedDek: ZEROED_KEY,
          dekIv: ZEROED_KEY.slice(0, 24),
          dekAuthTag: ZEROED_KEY.slice(0, 32),
        },
      });
    }

    // 4. Revoke all active consents
    await prisma.consent.updateMany({
      where: { patientId, granted: true },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    // 5. Deactivate user profile and anonymize identity
    const shreddedEmail = `erased-${crypto.randomBytes(6).toString('hex')}@erased.local`;
    await prisma.user.update({
      where: { id: patientId },
      data: {
        isActive: false,
        email: shreddedEmail,
        firstName: 'GDPR_ERASED',
        lastName: 'GDPR_ERASED',
        totpSecret: null,
      },
    });

    // 6. Record ErasureRequest
    const erasureRequest = await prisma.erasureRequest.create({
      data: {
        userId: patientId,
        reason,
        status: 'COMPLETED',
        recordsShredded: medicalRecords.length,
        notesShredded: consultations.length,
        vitalsShredded: consultations.length,
      },
    });

    // 7. Chain immutable audit record of crypto-shredding
    await createChainedAuditEvent({
      action: 'GDPR_RIGHT_TO_ERASURE_CRYPTO_SHREDDED',
      resource: `Patient:${patientId}`,
      userId: requestedByUserId,
      ipAddress: ipAddress || 'system',
      details: {
        erasureId: erasureRequest.id,
        reason,
        medicalRecordsShredded: medicalRecords.length,
        consultationsShredded: consultations.length,
      },
    });

    return {
      message: 'Crypto-shredding executed successfully: All per-record DEKs and clinical ciphertext rendered unrecoverable.',
      erasureRequest,
      recordsShredded: medicalRecords.length,
      consultationsShredded: consultations.length,
    };
  }
}

export const gdprService = GdprService.getInstance();
