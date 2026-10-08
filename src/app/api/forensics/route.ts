import { NextResponse } from 'next/server';
import { AuditEvent, Incident, ForensicReport } from '@/lib/types';

export async function GET() {
  // Mock Backend Data based on the ERD
  const auditEvents: AuditEvent[] = [
    { id: 'AE-001', timestamp: new Date().toISOString(), actorId: 'DOC-102', resourceType: 'Prescription', resourceId: 'RX-99', eventType: 'INTEGRITY_VERIFICATION', action: 'Digital Signature Applied', status: 'SUCCESS', hash: '0xabc123...' },
    { id: 'AE-002', timestamp: new Date(Date.now() - 3600000).toISOString(), actorId: 'UNKNOWN', resourceType: 'Consultation', resourceId: 'CONS-40', eventType: 'SECURITY_ALERT', action: 'Unauthorized E2E Key Request', status: 'FAILED', hash: '0xdef456...' },
    { id: 'AE-003', timestamp: new Date(Date.now() - 7200000).toISOString(), actorId: 'NURSE-05', resourceType: 'Record', resourceId: 'REC-11', eventType: 'COMPLIANCE_VIOLATION', action: 'Access outside allowed hours', status: 'SUCCESS', hash: '0xghi789...' },
  ];

  const activeIncidents: Incident[] = [
    {
      id: 'INC-991',
      title: 'Suspicious Access to Patient Records',
      auditEventIds: ['AE-003'],
      status: 'INVESTIGATING',
      timeline: [
        { id: 'TL-1', timestamp: new Date(Date.now() - 7200000).toISOString(), description: 'Nurse accessed record out of shift.' },
        { id: 'TL-2', timestamp: new Date(Date.now() - 3600000).toISOString(), description: 'System flagged as Compliance Violation.' }
      ],
      evidence: [
        { id: 'EV-1', type: 'LOG', data: 'Raw access log dump...' }
      ],
      findings: 'Pending admin review.'
    }
  ];

  const reports: ForensicReport[] = [
    {
      id: 'FR-100',
      incidentId: 'INC-990',
      generatedBy: 'System Auto-Forensics',
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
      reportData: 'Investigation complete. No data exfiltration detected.',
      hashVerification: 'VERIFIED_0x999...'
    }
  ];

  return NextResponse.json({
    success: true,
    data: {
      auditEvents,
      incidents: activeIncidents,
      reports
    }
  });
}
