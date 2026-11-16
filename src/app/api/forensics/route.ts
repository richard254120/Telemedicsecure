import { NextResponse } from 'next/server';
import type { AuditEvent, Incident, ForensicReport } from '@/lib/types';
import crypto from 'crypto';

/** Deterministic SHA-256 so hashes are stable across reloads */
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

const BASE = Date.now();
const T = (offsetMs: number) => new Date(BASE - offsetMs).toISOString();

// ─── Audit Events ─────────────────────────────────────────────────────────────
// Each hash chains onto the previous one (hash_n = SHA-256(hash_{n-1} + payload))
const auditEvents: AuditEvent[] = (() => {
  const genesis = sha256('genesis-telemedsecure-chain');

  const e1Hash = sha256(genesis + 'AE-2026-001|INCIDENT_OPENED|Incident:INC-2026-001|admin@telemed.com');
  const e2Hash = sha256(e1Hash  + 'AE-2026-002|SECURITY_ALERT|Consultation:CONS-2026-040|SYSTEM');
  const e3Hash = sha256(e2Hash  + 'AE-2026-003|COMPLIANCE_VIOLATION|MedicalRecord:REC-2026-011|nurse1@telemed.com');
  const e4Hash = sha256(e3Hash  + 'AE-2026-004|INTEGRITY_VERIFICATION|Prescription:RX-2026-099|doctor1@telemed.com');
  const e5Hash = sha256(e4Hash  + 'AE-2026-005|EVIDENCE_ATTACHED|Incident:INC-2026-001|admin@telemed.com');
  const e6Hash = sha256(e5Hash  + 'AE-2026-006|FORENSIC_REPORT_GENERATED|Incident:INC-2026-001|admin@telemed.com');

  return [
    {
      id: 'AE-2026-001',
      timestamp: T(14_400_000),
      userId: 'admin@telemed.com',
      action: 'INCIDENT_OPENED',
      resource: 'Incident:INC-2026-001',
      details: { title: 'Unauthorised After-Hours Record Access', severity: 'HIGH' },
      ipAddress: '192.168.1.10',
      hash: e1Hash,
    },
    {
      id: 'AE-2026-002',
      timestamp: T(10_800_000),
      userId: null,
      action: 'SECURITY_ALERT',
      resource: 'Consultation:CONS-2026-040',
      details: { ruleId: 'RULE-E2E-KEY-REQ', description: 'Unauthorised E2E encryption key request detected' },
      ipAddress: null,
      hash: e2Hash,
    },
    {
      id: 'AE-2026-003',
      timestamp: T(7_200_000),
      userId: 'nurse1@telemed.com',
      action: 'COMPLIANCE_VIOLATION',
      resource: 'MedicalRecord:REC-2026-011',
      details: { description: 'Record accessed outside authorised shift hours (02:14 UTC)', patientId: 'patient1@telemed.com' },
      ipAddress: '10.0.0.47',
      hash: e3Hash,
    },
    {
      id: 'AE-2026-004',
      timestamp: T(3_600_000),
      userId: 'doctor1@telemed.com',
      action: 'INTEGRITY_VERIFICATION',
      resource: 'Prescription:RX-2026-099',
      details: { result: 'PASS', algorithm: 'Ed25519', prescriptionId: 'RX-2026-099' },
      ipAddress: '192.168.1.22',
      hash: e4Hash,
    },
    {
      id: 'AE-2026-005',
      timestamp: T(1_800_000),
      userId: 'admin@telemed.com',
      action: 'EVIDENCE_ATTACHED',
      resource: 'Incident:INC-2026-001',
      details: { evidenceType: 'LOG_EXTRACT', findingId: 'EV-2026-001' },
      ipAddress: '192.168.1.10',
      hash: e5Hash,
    },
    {
      id: 'AE-2026-006',
      timestamp: T(900_000),
      userId: 'admin@telemed.com',
      action: 'FORENSIC_REPORT_GENERATED',
      resource: 'Incident:INC-2026-001',
      details: { reportId: 'FR-2026-001', investigator: 'Chief Security Officer' },
      ipAddress: '192.168.1.10',
      hash: e6Hash,
    },
  ] satisfies AuditEvent[];
})();

// ─── Forensic Reports ─────────────────────────────────────────────────────────
const reportPayload = JSON.stringify({
  incidentId: 'INC-2026-001',
  title: 'Forensic Investigation Report — After-Hours Record Access',
  investigator: 'Chief Security Officer',
  closedAt: T(900_000),
});
const reportHash = sha256(reportPayload);
const txHash = sha256('hardhat-anchor-block-' + reportHash);

const reports: ForensicReport[] = [
  {
    id: 'FR-2026-001',
    incidentId: 'INC-2026-001',
    title: 'Forensic Investigation Report — After-Hours Record Access',
    reportHash,
    txHash,
    blockNumber: 142_803,
    pdfPath: '/storage/reports/FR-2026-001.pdf',
    createdAt: T(900_000),
  },
];

// ─── Incidents ────────────────────────────────────────────────────────────────
const incidents: Incident[] = [
  {
    id: 'INC-2026-001',
    alertId: 'AE-2026-003',
    title: 'Unauthorised After-Hours Medical Record Access',
    description:
      'Nurse account nurse1@telemed.com accessed MedicalRecord REC-2026-011 at 02:14 UTC — ' +
      'outside the permitted 06:00–22:00 shift window. The access was flagged by HIPAA rule ' +
      'RULE-SHIFT-ACCESS and immediately escalated to forensic casework.',
    severity: 'HIGH',
    status: 'CLOSED',
    openedBy: 'Chief Security Officer',
    targetUserId: 'nurse1@telemed.com',
    targetPatientId: 'patient1@telemed.com',
    createdAt: T(14_400_000),
    timeline: [
      {
        id: 'TL-2026-001',
        timestamp: T(14_400_000),
        event: '[INCIDENT_OPENED] Case INC-2026-001 opened by Chief Security Officer',
        action: 'INCIDENT_OPENED',
        resource: 'Incident:INC-2026-001',
        userId: 'admin@telemed.com',
        hash: auditEvents[0].hash,
      },
      {
        id: 'TL-2026-002',
        timestamp: T(7_200_000),
        event: '[COMPLIANCE_VIOLATION] MedicalRecord:REC-2026-011 accessed out of shift by nurse1@telemed.com (IP: 10.0.0.47)',
        action: 'COMPLIANCE_VIOLATION',
        resource: 'MedicalRecord:REC-2026-011',
        userId: 'nurse1@telemed.com',
        hash: auditEvents[2].hash,
      },
      {
        id: 'TL-2026-003',
        timestamp: T(1_800_000),
        event: '[EVIDENCE_ATTACHED] Log extract EV-2026-001 attached to case',
        action: 'EVIDENCE_ATTACHED',
        resource: 'Incident:INC-2026-001',
        userId: 'admin@telemed.com',
        hash: auditEvents[4].hash,
      },
      {
        id: 'TL-2026-004',
        timestamp: T(900_000),
        event: '[FORENSIC_REPORT_GENERATED] Report FR-2026-001 generated and anchored on-chain (block 142803)',
        action: 'FORENSIC_REPORT_GENERATED',
        resource: 'Incident:INC-2026-001',
        userId: 'admin@telemed.com',
        hash: auditEvents[5].hash,
      },
    ],
    evidence: [
      {
        id: 'EV-2026-001',
        description: 'Raw server access log showing nurse1@telemed.com session at 02:14:07 UTC reading patient record REC-2026-011',
        evidenceType: 'LOG_EXTRACT',
        hashValue: sha256('log-extract-nurse1-02:14:07-REC-2026-011'),
        createdAt: T(1_800_000),
      },
      {
        id: 'EV-2026-002',
        description: 'HIPAA compliance rule RULE-SHIFT-ACCESS triggered — access outside permitted hours window',
        evidenceType: 'ACCESS_VIOLATION',
        hashValue: sha256('hipaa-rule-shift-access-violation-INC-2026-001'),
        createdAt: T(1_750_000),
      },
    ],
    reports,
  },
  {
    id: 'INC-2026-002',
    alertId: 'AE-2026-002',
    title: 'Unauthorised E2E Encryption Key Request — Consultation CONS-2026-040',
    description:
      'An unauthenticated request attempted to retrieve the end-to-end encryption key for ' +
      'active consultation CONS-2026-040. The request was blocked by the zero-trust gateway. ' +
      'No patient data was exposed. Case remains open pending IP geolocation and attribution.',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    openedBy: 'System (Automated — RULE-E2E-KEY-REQ)',
    targetUserId: null,
    targetPatientId: null,
    createdAt: T(10_800_000),
    timeline: [
      {
        id: 'TL-2026-005',
        timestamp: T(10_800_000),
        event: '[SECURITY_ALERT] Unauthorised E2E key request blocked by zero-trust gateway — Consultation:CONS-2026-040',
        action: 'SECURITY_ALERT',
        resource: 'Consultation:CONS-2026-040',
        userId: null,
        hash: auditEvents[1].hash,
      },
    ],
    evidence: [],
    reports: [],
  },
];

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      auditEvents,
      incidents,
      reports,
    },
  });
}
