/**
 * Domain types for the Administrative & Forensics Control Center.
 *
 * These mirror the payloads produced by the Express admin / compliance /
 * integrity / prescription / investigation / sms routers. Replacing the
 * previous `any` graphs lets `tsc -b` catch contract drift at build time.
 */
import type { UserRole } from '../../../context/AuthContext';

/** Re-exported so panels import their vocabulary from one place. */
export type { UserRole };

export type VerificationStatus = 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * A workforce record as returned by GET /admin/users.
 *
 * The server never ships `totpSecret`; it exposes the derived boolean
 * `isTotpEnabled` instead so the UI can state 2FA truthfully.
 */
export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  lockedUntil: string | null;
  verificationStatus: VerificationStatus | null;
  medicalLicenseNo: string | null;
  licenseJurisdiction: string | null;
  specialty: string | null;
  verifiedAt: string | null;
  verifiedById: string | null;
  createdAt: string;
  isTotpEnabled: boolean;
}

export interface ComplianceViolation {
  id: string;
  type: string;
  ruleId: string;
  severity: Severity;
  description: string;
  hipaaClause: string | null;
  gdprClause: string | null;
  userId: string | null;
  resource: string | null;
  resolved: boolean;
  reportedAt: string;
  metadata?: string | null;
}

export interface SecurityAlert {
  id: string;
  title: string | null;
  description: string;
  severity: Severity;
  ruleId?: string | null;
  sourceIp?: string | null;
  createdAt: string;
}

/** GET /integrity/verify — recomputed hash-chain + on-chain Merkle report. */
export interface ChainVerificationReport {
  isValid: boolean;
  status: 'VALID' | 'TAMPERED';
  totalEvents: number;
  chainIntact: boolean;
  anchorsChecked: number;
  onChainVerified: boolean;
  verifiedAt: string;
  brokenEvent: {
    id: string;
    index: number;
    action: string;
    resource: string;
    reason: string;
  } | null;
}

export interface PrescriptionAuditEvent {
  id: string;
  action: string;
  timestamp: string;
  ipAddress: string | null;
  user?: { email?: string | null; role?: UserRole | null } | null;
}

export interface PrescriptionAudit {
  id: string;
  status: 'ISSUED' | 'DISPENSED' | 'REVOKED' | 'EXPIRED' | string;
  statusReason?: string | null;
  consultationId?: string;
  signatureStatus: 'VALID' | 'TAMPERED';
  canonicalHash?: string;
  createdAt: string;
  items?: { id: string; medication: string; dosage: string; instructions: string }[];
  signature?: { signature: string; algorithm?: string | null; signedAt?: string | null } | null;
  doctor?: { id?: string; firstName: string | null; lastName: string | null; email: string; doctorPublicKey?: string | null } | null;
  consultation?: {
    id?: string;
    patient?: { id?: string; firstName: string | null; lastName: string | null; email?: string | null } | null;
  } | null;
  auditHistory?: PrescriptionAuditEvent[];
}

export interface IncidentTimelineEntry {
  id: string;
  event: string;
  timestamp?: string;
  auditEventId?: string | null;
}

export interface EvidenceFinding {
  id: string;
  description: string;
  evidenceType: string;
  hashValue: string;
  createdAt?: string;
}

export interface ForensicReport {
  id: string;
  title: string;
  summary?: string;
  severity?: Severity;
  investigator?: string;
  reportHash: string;
  txHash?: string | null;
  blockNumber?: number | null;
  chainValid?: boolean;
  createdAt?: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'INVESTIGATING' | 'CLOSED' | string;
  severity: Severity;
  openedBy?: string | null;
  alertId?: string | null;
  targetUserId?: string | null;
  targetPatientId?: string | null;
  createdAt?: string;
  timeline?: IncidentTimelineEntry[];
  evidence?: EvidenceFinding[];
  reports?: ForensicReport[];
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  isAccepted: boolean;
  createdAt: string;
  invitedBy?: { firstName?: string | null; lastName?: string | null; email?: string } | null;
}

export interface SmsLog {
  id: string;
  to: string;
  message: string;
  purpose: string;
  status: 'DELIVERED' | 'SIMULATED' | 'FAILED' | string;
  provider: string;
  sentAt: string;
}

export interface SmsStatus {
  activeProvider: string | null;
  isLiveConfigured: boolean;
  defaultSenderNumber: string | null;
}

/** GET /admin/stats — server-aggregated platform metrics. */
export interface SystemStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    lockedUsers: number;
    roles: Partial<Record<UserRole, number>>;
  };
  clinical: {
    totalConsultations: number;
    completedConsultations: number;
    inProgressConsultations: number;
    scheduledConsultations: number;
    cancelledConsultations: number;
    completionRate: number;
  };
  prescriptions: {
    totalPrescriptions: number;
    dispensed: number;
    issued: number;
    revoked: number;
    signedCount: number;
    signatureRate: number;
  };
  diagnostics: {
    radiology: { total: number; completed: number; urgent: number };
    lab: { total: number; completed: number; critical: number };
    triage: { total: number; avgEsiScore: number };
  };
  financial: {
    totalBilled: number;
    totalCollected: number;
    totalPatientOutstanding: number;
    totalInsuranceCovered: number;
    collectionRate: number;
    totalClaims: number;
    approvedClaims: number;
    claimApprovalRate: number;
  };
  security: {
    auditEventsCount: number;
    unresolvedViolations: number;
    criticalViolations: number;
    alertsCount: number;
    openIncidents: number;
    invitationsCount: number;
    activeInvitationsCount: number;
  };
  system: {
    uptimeSeconds: number;
    dbLatencyMs: number;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    nodeVersion: string;
    environment: string;
    timestamp: string;
  };
}

/**
 * Consultation row as returned by GET /consultations (an ADMIN receives every
 * consultation platform-wide, joined to its patient, doctor, clinical flags and
 * vital-sign pointers). Only the fields the oversight panel renders are typed;
 * the lifecycle columns mirror the booking model added server-side.
 */
export interface AdminConsultation {
  id: string;
  patientId: string;
  doctorId: string;
  /** SCHEDULED | PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | DECLINED */
  status: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  confirmedAt?: string | null;
  declineReason?: string | null;
  rescheduledFrom?: string | null;
  rescheduledAt?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  patient?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  doctor?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  clinicalFlags?: { id: string; severity?: string | null; description?: string | null; resolved?: boolean }[];
  vitalSigns?: { id: string; createdAt: string }[];
}

/** GET /billing/stats — revenue-cycle aggregates for the finance panel. */
export interface BillingStats {
  summary: {
    totalInvoices: number;
    totalBilled: number;
    totalCollected: number;
    totalPatientDue: number;
    totalInsuranceCovered: number;
    pendingInvoicesCount: number;
    paidInvoicesCount: number;
  };
  claimsMetrics: {
    totalClaims: number;
    submittedClaims: number;
    approvedClaims: number;
    deniedClaims: number;
    cleanClaimRate: string;
  };
  arAging: {
    current: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
  };
}

export interface InvoiceItemRow {
  id: string;
  serviceType: string;
  cptCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoicePaymentRow {
  id: string;
  amount: number;
  method: string;
  status: string;
  transactionRef: string;
}

/** GET /billing/invoices — an ADMIN sees every invoice, fully joined. */
export interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  consultationId?: string | null;
  totalAmount: number;
  insuranceCovered: number;
  patientDue: number;
  /** PENDING | PARTIALLY_PAID | PAID | CANCELLED | REFUNDED */
  status: string;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;
  patient?: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone?: string | null } | null;
  consultation?: { id: string; scheduledAt: string; status: string; doctor?: { firstName: string | null; lastName: string | null; specialty?: string | null } | null } | null;
  items?: InvoiceItemRow[];
  claims?: { id: string; claimNumber: string; status: string; billedAmount: number; approvedAmount?: number | null }[];
  payments?: InvoicePaymentRow[];
}

/** GET /billing/claims — insurance claim ledger with the payer + invoice joined. */
export interface AdminClaim {
  id: string;
  claimNumber: string;
  invoiceId: string;
  patientId: string;
  payerName: string;
  policyNumber: string;
  groupNumber?: string | null;
  billedAmount: number;
  approvedAmount?: number | null;
  copayAmount: number;
  deductibleAmount: number;
  /** DRAFT | SCRUBBED | SUBMITTED | IN_REVIEW | APPROVED | DENIED | APPEALED | SETTLED */
  status: string;
  denialReason?: string | null;
  appealNotes?: string | null;
  submittedAt?: string | null;
  adjudicatedAt?: string | null;
  createdAt: string;
  patient?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  invoice?: { invoiceNumber: string; totalAmount: number; status: string } | null;
}

/**
 * GET /gdpr/erasure/requests — a logged Art. 17 crypto-shred. The server returns
 * the raw rows (no patient join), so the panel resolves the subject name from the
 * workforce roster it already holds.
 */
export interface ErasureRequestEntry {
  id: string;
  userId: string;
  reason?: string | null;
  status: string;
  shreddedAt: string;
  recordsShredded: number;
  notesShredded: number;
  vitalsShredded: number;
}

/** Roles that may be provisioned / invited through the admin console. */
export const PROVISIONABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'DOCTOR', label: 'Physician (Attending)' },
  { value: 'NURSE', label: 'Clinical Nurse' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'LAB_TECHNICIAN', label: 'Laboratory Scientist' },
  { value: 'RADIOLOGIST', label: 'Radiologist' },
  { value: 'BILLING_OFFICER', label: 'Billing Officer' },
  { value: 'TRIAGE_OFFICER', label: 'Triage Officer' },
  { value: 'CARE_COORDINATOR', label: 'Care Coordinator' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'ADMIN', label: 'System Administrator' },
];
