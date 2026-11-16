// ─── Users ───────────────────────────────────────────────────────────────────
export type Role = 'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN'
  | 'PHARMACIST' | 'RECEPTIONIST' | 'LAB_TECHNICIAN'
  | 'RADIOLOGIST' | 'BILLING_OFFICER' | 'TRIAGE_OFFICER' | 'CARE_COORDINATOR';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  email: string;
}

// ─── Clinical Data ────────────────────────────────────────────────────────────
export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
}

export interface Prescription {
  id: string;
  consultationId: string;
  doctorId: string;
  patientId: string;
  digitalSignature: string;
  items: PrescriptionItem[];
}

// ─── Security & Forensics / Audit Events ─────────────────────────────────────
export type AuditEventType =
  | 'COMPLIANCE_VIOLATION'
  | 'INTEGRITY_VERIFICATION'
  | 'SECURITY_ALERT'
  | 'ACCESS_LOG'
  | 'INCIDENT_OPENED'
  | 'INCIDENT_TIMELINE_RECONSTRUCTED'
  | 'EVIDENCE_ATTACHED'
  | 'FORENSIC_REPORT_GENERATED';

export interface AuditEvent {
  id: string;
  timestamp: string;
  /** ID of the user who performed the action (null = system) */
  userId: string | null;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  /** SHA-256 chained hash linking this event to the previous one */
  hash: string;
}

// ─── Incident Management ──────────────────────────────────────────────────────
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED';

export interface IncidentTimelineItem {
  id: string;
  timestamp: string;
  event: string;
  action: string | null;
  resource: string | null;
  userId: string | null;
  hash: string | null;
}

export interface EvidenceFinding {
  id: string;
  description: string;
  evidenceType: 'LOG_EXTRACT' | 'SIGNATURE_MISMATCH' | 'ACCESS_VIOLATION' | 'HASH_DISCREPANCY' | 'VIDEO_TAMPERING' | 'OTHER';
  hashValue: string;
  createdAt: string;
}

export interface ForensicReport {
  id: string;
  incidentId: string;
  title: string;
  /** SHA-256 of the full PDF/JSON payload */
  reportHash: string;
  /** On-chain transaction hash (null if not yet anchored) */
  txHash: string | null;
  blockNumber: number | null;
  pdfPath: string | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  alertId: string | null;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  openedBy: string | null;
  targetUserId: string | null;
  targetPatientId: string | null;
  createdAt: string;
  timeline: IncidentTimelineItem[];
  evidence: EvidenceFinding[];
  reports: ForensicReport[];
}
