import { PrismaClient, Severity, ViolationType, ComplianceViolation, SecurityAlert } from '@prisma/client';
import { broadcastAlertToAdmins } from '../socket';
import { createChainedAuditEvent } from './audit.service';

const prisma = new PrismaClient();

export type RuleId =
  | 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT'
  | 'BULK_RECORD_ACCESS'
  | 'OFF_HOURS_ACCESS'
  | 'REPEATED_FAILED_LOGINS'
  | 'PRESCRIPTION_EDITED_AFTER_SIGNING'
  | 'UNENCRYPTED_PHI_DETECTED'
  | 'CONSENT_MISSING'
  | 'DATA_EXPORT_WITHOUT_JUSTIFICATION'
  | 'AUDIT_CHAIN_BREAK';

export interface RuleDefinition {
  ruleId: RuleId;
  name: string;
  defaultSeverity: Severity;
  violationType: ViolationType;
  hipaaClause: string;
  gdprClause: string;
  description: string;
}

export const RULE_DEFINITIONS: Record<RuleId, RuleDefinition> = {
  ACCESS_OUTSIDE_ROLE_ASSIGNMENT: {
    ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
    name: 'Access Outside Role or Assignment',
    defaultSeverity: Severity.HIGH,
    violationType: ViolationType.UNAUTHORIZED_ACCESS,
    hipaaClause: 'HIPAA §164.312(a)(1) Access Control - Unique User Identification and Emergency Access',
    gdprClause: 'GDPR Art. 5(1)(f) Integrity and Confidentiality (Unauthorized Processing)',
    description: 'User attempted to access clinical record, consultation, or vitals without doctor-patient assignment or clinical role authorization.',
  },
  BULK_RECORD_ACCESS: {
    ruleId: 'BULK_RECORD_ACCESS',
    name: 'Suspicious Bulk Record Access',
    defaultSeverity: Severity.MEDIUM,
    violationType: ViolationType.POLICY_VIOLATION,
    hipaaClause: 'HIPAA §164.312(b) Audit Controls - Mechanisms to Examine Activity in Systems Containing EPHI',
    gdprClause: 'GDPR Art. 32(1)(d) Security of Processing - Regular Testing and Assessment',
    description: 'Anomalous bulk query or export of multiple patient health records exceeding threshold limits.',
  },
  OFF_HOURS_ACCESS: {
    ruleId: 'OFF_HOURS_ACCESS',
    name: 'Off-Hours Sensitive Health Data Access',
    defaultSeverity: Severity.MEDIUM,
    violationType: ViolationType.POLICY_VIOLATION,
    hipaaClause: 'HIPAA §164.308(a)(1)(ii)(D) Information System Activity Review',
    gdprClause: 'GDPR Art. 32 Security of Processing - Incident Detection & Confidentiality',
    description: 'Protected Health Information accessed outside standard operating clinic hours (07:00 - 20:00 M-F).',
  },
  REPEATED_FAILED_LOGINS: {
    ruleId: 'REPEATED_FAILED_LOGINS',
    name: 'Repeated Failed Authentication Attempts',
    defaultSeverity: Severity.HIGH,
    violationType: ViolationType.POLICY_VIOLATION,
    hipaaClause: 'HIPAA §164.308(a)(5)(ii)(C) Log-in Monitoring Procedures',
    gdprClause: 'GDPR Art. 32(1)(b) Security of Processing - Confidentiality and Resilience',
    description: 'Multiple consecutive failed login attempts detected, triggering account monitoring and rate limits.',
  },
  PRESCRIPTION_EDITED_AFTER_SIGNING: {
    ruleId: 'PRESCRIPTION_EDITED_AFTER_SIGNING',
    name: 'Signed Digital Prescription Tampering',
    defaultSeverity: Severity.CRITICAL,
    violationType: ViolationType.TAMPERING,
    hipaaClause: 'HIPAA §164.312(c)(1) Integrity - Protection Against Unauthorized Alteration or Destruction',
    gdprClause: 'GDPR Art. 5(1)(f) & Art. 32 - Accuracy, Integrity, and Non-repudiation of Health Records',
    description: 'Attempted modification of a prescription or prescription items after Ed25519 digital signature was created.',
  },
  UNENCRYPTED_PHI_DETECTED: {
    ruleId: 'UNENCRYPTED_PHI_DETECTED',
    name: 'Unencrypted Protected Health Information (PHI) Detected',
    defaultSeverity: Severity.CRITICAL,
    violationType: ViolationType.DATA_LEAK,
    hipaaClause: 'HIPAA §164.312(a)(2)(iv) Encryption and Decryption of Electronic Protected Health Information',
    gdprClause: 'GDPR Art. 32(1)(a) Security of Processing - Pseudonymisation and Encryption of Personal Data',
    description: 'Plaintext medical diagnosis, Social Security Number, or unencrypted clinical payload detected where envelope ciphertext was required.',
  },
  CONSENT_MISSING: {
    ruleId: 'CONSENT_MISSING',
    name: 'Missing or Revoked GDPR Consent for Health Processing',
    defaultSeverity: Severity.HIGH,
    violationType: ViolationType.CONSENT_VIOLATION,
    hipaaClause: 'HIPAA §164.508 Uses and Disclosures Requiring Patient Authorization',
    gdprClause: 'GDPR Art. 6(1)(a) & Art. 9(2)(a) Explicit Consent for Processing Special Category Health Data',
    description: 'Patient health data processing or telemedicine access performed without active, valid GDPR consent.',
  },
  DATA_EXPORT_WITHOUT_JUSTIFICATION: {
    ruleId: 'DATA_EXPORT_WITHOUT_JUSTIFICATION',
    name: 'Data Portability Export Without Justification',
    defaultSeverity: Severity.HIGH,
    violationType: ViolationType.POLICY_VIOLATION,
    hipaaClause: 'HIPAA §164.524 Access of Individuals to Protected Health Information',
    gdprClause: 'GDPR Art. 20 Right to Data Portability & Art. 15 Right of Access',
    description: 'Patient health data export requested without specifying a verifiable clinical, legal, or portability justification.',
  },
  AUDIT_CHAIN_BREAK: {
    ruleId: 'AUDIT_CHAIN_BREAK',
    name: 'Cryptographic Audit Hash Chain Break Detected',
    defaultSeverity: Severity.CRITICAL,
    violationType: ViolationType.INTEGRITY_VIOLATION,
    hipaaClause: 'HIPAA §164.312(c)(2) Integrity Controls - Mechanism to Corroborate EPHI Has Not Been Altered',
    gdprClause: 'GDPR Art. 32(1)(b) Security of Processing - Ongoing Integrity and Authenticity of Records',
    description: 'Audit event hash mismatch, corrupted prevHash pointer, or Merkle root discrepancy detected against blockchain anchor.',
  },
};

export interface TriggerViolationParams {
  ruleId: RuleId;
  description?: string;
  severity?: Severity;
  userId?: string | null;
  resource?: string;
  sourceIp?: string;
  metadata?: any;
}

export class RulesEngineService {
  private static instance: RulesEngineService;

  // In-memory sliding window trackers for failed logins and bulk access
  private failedLoginsByTarget: Map<string, { count: number; lastAttempt: number }> = new Map();
  private userAccessHistory: Map<string, number[]> = new Map();

  public static getInstance(): RulesEngineService {
    if (!RulesEngineService.instance) {
      RulesEngineService.instance = new RulesEngineService();
    }
    return RulesEngineService.instance;
  }

  /**
   * Main detection execution: Records ComplianceViolation, SecurityAlert,
   * emits live via Socket.IO, and chains an immutable AuditEvent.
   */
  public async triggerViolation(params: TriggerViolationParams): Promise<{
    violation: ComplianceViolation;
    alert: SecurityAlert;
  }> {
    const rule = RULE_DEFINITIONS[params.ruleId];
    if (!rule) {
      throw new Error(`Unknown ruleId: ${params.ruleId}`);
    }

    const severity = params.severity || rule.defaultSeverity;
    const description = params.description || rule.description;
    const metadataString = params.metadata ? JSON.stringify(params.metadata) : null;

    // 1. Create ComplianceViolation record
    const violation = await prisma.complianceViolation.create({
      data: {
        type: rule.violationType,
        ruleId: rule.ruleId,
        severity,
        description,
        hipaaClause: rule.hipaaClause,
        gdprClause: rule.gdprClause,
        userId: params.userId || null,
        resource: params.resource || null,
        metadata: metadataString,
      },
    });

    // 2. Create SecurityAlert record
    const alert = await prisma.securityAlert.create({
      data: {
        severity,
        ruleId: rule.ruleId,
        title: rule.name,
        description,
        sourceIp: params.sourceIp || 'unknown',
        userId: params.userId || null,
      },
    });

    // 3. Push live via Socket.IO to admins
    try {
      broadcastAlertToAdmins(alert, violation);
    } catch (sockErr) {
      console.error('[RulesEngine] Socket push warning:', sockErr);
    }

    // 4. Log chained AuditEvent for the detection
    try {
      await createChainedAuditEvent({
        action: `COMPLIANCE_VIOLATION_${rule.ruleId}`,
        resource: params.resource || `Violation:${violation.id}`,
        userId: params.userId || null,
        ipAddress: params.sourceIp || 'system',
        details: {
          violationId: violation.id,
          alertId: alert.id,
          severity,
          hipaaClause: rule.hipaaClause,
          gdprClause: rule.gdprClause,
        },
      });
    } catch (auditErr) {
      console.error('[RulesEngine] Audit log warning:', auditErr);
    }

    console.warn(`[RulesEngine] VIOLATION TRIGGERED [${rule.ruleId}] - Severity: ${severity} - Alert ID: ${alert.id}`);

    return { violation, alert };
  }

  /**
   * PHI Pattern Detector: Checks for cleartext SSN and sensitive clinical conditions
   */
  public detectUnencryptedPhi(payload: any): {
    detected: boolean;
    snippets: string[];
    patternMatched?: string;
  } {
    if (!payload) return { detected: false, snippets: [] };

    const stringified = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // 1. Social Security Number regex: XXX-XX-XXXX
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssnMatches = stringified.match(ssnRegex);
    if (ssnMatches && ssnMatches.length > 0) {
      return {
        detected: true,
        snippets: ssnMatches.map(s => s.replace(/\d/g, '*')),
        patternMatched: 'Social Security Number (SSN)',
      };
    }

    // 2. Diagnostic PHI keywords (e.g. cancer, diabetes, HIV, depression, covid-19)
    const phiRegex = /\b(diabetes|hypertension|cancer|hiv|aids|depression|covid-19|schizophrenia|bipolar|cardiac arrest|leukemia|biopsy|malignant|chemotherapy|stage iv|heart disease)\b/gi;
    const phiMatches = stringified.match(phiRegex);
    if (phiMatches && phiMatches.length > 0) {
      return {
        detected: true,
        snippets: Array.from(new Set(phiMatches.map(m => m.toLowerCase()))),
        patternMatched: 'Plaintext Medical Diagnosis / Condition',
      };
    }

    return { detected: false, snippets: [] };
  }

  /**
   * Off-Hours Access Checker: Standard clinic operating window is 07:00 - 20:00 M-F
   */
  public isOffHours(date: Date = new Date()): boolean {
    const day = date.getDay(); // 0 is Sunday, 6 is Saturday
    const hours = date.getHours();

    // Weekend
    if (day === 0 || day === 6) return true;

    // Outside 07:00 - 20:00
    if (hours < 7 || hours >= 20) return true;

    return false;
  }

  /**
   * Tracks failed login attempts and triggers violation if >= 3
   */
  public async recordFailedLogin(identifier: string, ipAddress: string, userId?: string | null): Promise<number> {
    const now = Date.now();
    const entry = this.failedLoginsByTarget.get(identifier) || { count: 0, lastAttempt: now };

    // Reset if last attempt was > 15 minutes ago
    if (now - entry.lastAttempt > 15 * 60 * 1000) {
      entry.count = 1;
    } else {
      entry.count += 1;
    }
    entry.lastAttempt = now;
    this.failedLoginsByTarget.set(identifier, entry);

    if (entry.count >= 3) {
      await this.triggerViolation({
        ruleId: 'REPEATED_FAILED_LOGINS',
        description: `Failed login threshold exceeded (${entry.count} attempts) for identifier: ${identifier}`,
        userId: userId || null,
        sourceIp: ipAddress,
        resource: `UserAuth:${identifier}`,
        metadata: { attempts: entry.count, identifier },
      });
    }

    return entry.count;
  }

  public resetFailedLogins(identifier: string) {
    this.failedLoginsByTarget.delete(identifier);
  }

  /**
   * Tracks record queries and triggers BULK_RECORD_ACCESS if > 5 in single request or > 10 in 60s
   */
  public async trackRecordAccess(userId: string, count: number, ipAddress: string, resource: string = 'MedicalRecords'): Promise<boolean> {
    if (count > 5) {
      await this.triggerViolation({
        ruleId: 'BULK_RECORD_ACCESS',
        description: `High-volume bulk query: ${count} patient records requested in a single operation.`,
        userId,
        sourceIp: ipAddress,
        resource,
        metadata: { batchSize: count },
      });
      return true;
    }

    const now = Date.now();
    const history = this.userAccessHistory.get(userId) || [];
    // Keep timestamps within last 60 seconds
    const recent = history.filter(ts => now - ts < 60000);
    recent.push(now);
    this.userAccessHistory.set(userId, recent);

    if (recent.length > 10) {
      await this.triggerViolation({
        ruleId: 'BULK_RECORD_ACCESS',
        description: `Rapid access frequency exceeded: ${recent.length} clinical record operations within 60 seconds.`,
        userId,
        sourceIp: ipAddress,
        resource,
        metadata: { frequencyCount: recent.length, windowSec: 60 },
      });
      return true;
    }

    return false;
  }
}

export const rulesEngine = RulesEngineService.getInstance();
