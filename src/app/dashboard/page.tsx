'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuditEvent, Incident, ForensicReport } from '@/lib/types';

export default function Dashboard() {
  const [data, setData] = useState<{ auditEvents: AuditEvent[], incidents: Incident[], reports: ForensicReport[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/forensics')
      .then(res => res.json())
      .then(json => {
        setData(json.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch forensics data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading Forensic Data...</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background-main)' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: 'var(--surface-main)', borderRight: '1px solid var(--surface-border)', padding: '2rem 1rem' }}>
        <h2 className="title-glow" style={{ fontSize: '1.5rem', marginBottom: '2rem', paddingLeft: '1rem' }}>TeleMedSecure</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['Overview', 'Audit Trail', 'Incident Management', 'Forensic Reports'].map((item, idx) => (
            <Link 
              key={idx} 
              href="#" 
              style={{ 
                padding: '10px 16px', 
                borderRadius: '8px', 
                backgroundColor: idx === 0 ? 'var(--accent-color)' : 'transparent',
                color: idx === 0 ? '#fff' : 'var(--text-secondary)',
                fontWeight: idx === 0 ? 600 : 400
              }}
            >
              {item}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Forensic & Compliance Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Monitoring structural entities defined in the System ERD.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ padding: '8px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '20px', border: '1px solid var(--success-color)', fontSize: '0.9rem', fontWeight: 600 }}>
              System Secure
            </span>
          </div>
        </header>

        {/* Incidents Section */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--error-color)' }}>Active Incidents</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data?.incidents.map(inc => (
              <div key={inc.id} style={{ border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{inc.id} - {inc.title}</h3>
                  <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>{inc.status}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Findings: {inc.findings}</p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--highlight-color)' }}>
                  <strong>Timeline:</strong> {inc.timeline.length} events | <strong>Evidence:</strong> {inc.evidence.length} items
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Events Section */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem' }}>Cryptographic Audit Trail</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem 0.5rem' }}>Type</th>
                <th style={{ padding: '1rem 0.5rem' }}>Actor</th>
                <th style={{ padding: '1rem 0.5rem' }}>Resource</th>
                <th style={{ padding: '1rem 0.5rem' }}>Status</th>
                <th style={{ padding: '1rem 0.5rem' }}>Hash Anchor</th>
              </tr>
            </thead>
            <tbody>
              {data?.auditEvents.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(119, 141, 169, 0.1)' }}>
                  <td style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>{log.eventType}</td>
                  <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{log.actorId}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{log.resourceType} ({log.resourceId})</td>
                  <td style={{ padding: '1rem 0.5rem' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.8rem',
                      backgroundColor: log.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: log.status === 'SUCCESS' ? 'var(--success-color)' : 'var(--error-color)'
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{log.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Forensic Reports Section */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>Generated Forensic Reports</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data?.reports.map(rep => (
              <div key={rep.id} style={{ border: '1px solid var(--surface-border)', padding: '1rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Report for {rep.incidentId}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Generated By: {rep.generatedBy}</p>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{rep.reportData}</p>
                <div style={{ color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  Signature: {rep.hashVerification}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
