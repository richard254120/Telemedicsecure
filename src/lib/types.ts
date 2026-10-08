// Users
export type Role = 'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

// Clinical Data
export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  startTime: Date;
  endTime?: Date;
  notes: string;
}

export interface Prescription {
  id: string;
  consultationId: string;
  doctorId: string;
  patientId: string;
  digitalSignature: string; // Cryptographic signature
  items: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
}

// Security & Forensics / Audit Events
export type AuditEventType = 'COMPLIANCE_VIOLATION' | 'INTEGRITY_VERIFICATION' | 'SECURITY_ALERT' | 'ACCESS_LOG';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  eventType: AuditEventType;
  action: string;
  status: 'SUCCESS' | 'FAILED';
  hash: string; // Blockchain/Cryptographic anchor
}

// Incident Management
export interface Incident {
  id: string;
  title: string;
  auditEventIds: string[];
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  timeline: IncidentTimelineItem[];
  evidence: IncidentEvidence[];
  findings: string;
}

export interface IncidentTimelineItem {
  id: string;
  timestamp: string;
  description: string;
}

export interface IncidentEvidence {
  id: string;
  type: 'LOG' | 'SIGNATURE_MISMATCH' | 'VIDEO_TAMPERING';
  data: string;
}

export interface ForensicReport {
  id: string;
  incidentId: string;
  generatedBy: string;
  generatedAt: string;
  reportData: string;
  hashVerification: string; // Verifies the integrity of the report
}
