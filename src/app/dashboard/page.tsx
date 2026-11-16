'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AuditEvent, Incident, ForensicReport } from '@/lib/types';

const SEVERITY_COLOR: Record<string, string> = {
  LOW:      'rgba(16, 185, 129, 0.15)',
  MEDIUM:   'rgba(245, 158, 11, 0.15)',
  HIGH:     'rgba(239, 68, 68, 0.15)',
  CRITICAL: 'rgba(139, 0, 255, 0.15)',
};
const SEVERITY_TEXT: Record<string, string> = {
  LOW:      '#10b981',
  MEDIUM:   '#f59e0b',
  HIGH:     '#ef4444',
  CRITICAL: '#a855f7',
};
const STATUS_COLOR: Record<string, string> = {
  OPEN:          '#ef4444',
  INVESTIGATING: '#f59e0b',
  CLOSED:        '#10b981',
};
const ACTION_COLOR: Record<string, string> = {
  COMPLIANCE_VIOLATION:         '#ef4444',
  SECURITY_ALERT:               '#f59e0b',
  INCIDENT_OPENED:              '#778da9',
  INTEGRITY_VERIFICATION:       '#10b981',
  EVIDENCE_ATTACHED:            '#415a77',
  FORENSIC_REPORT_GENERATED:    '#38bdf8',
};

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

export default function Dashboard() {
  const [data, setData] = useState<{
    auditEvents: AuditEvent[];
    incidents: Incident[];
    reports: ForensicReport[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('Overview');

  useEffect(() => {
    fetch('/api/forensics')
      .then(res => res.json())
      .then(json => { setData(json.data); setLoading(false); })
      .catch(err => { console.error('Failed to fetch forensics data:', err); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--background-main)', color: 'var(--text-secondary)' }}>
        Loading Forensic Data…
      </div>
    );
  }

  const navItems = ['Overview', 'Audit Trail', 'Incident Casework', 'Forensic Reports'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background-main)' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: '240px', backgroundColor: 'var(--surface-main)', borderRight: '1px solid var(--surface-border)', padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ paddingLeft: '1rem', marginBottom: '2rem' }}>
          <h2 className="title-glow" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>TeleMedSecure</h2>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Forensic & Compliance Hub</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(item => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.85rem',
                backgroundColor: activeNav === item ? 'var(--accent-color)' : 'transparent',
                color: activeNav === item ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeNav === item ? 600 : 400,
                transition: 'background 0.2s',
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>Forensic & Compliance Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Real-time incident casework, cryptographic audit trail, and anchored forensic reports.
            </p>
          </div>
          <span style={{ padding: '6px 14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '20px', border: '1px solid var(--success-color)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            System Secure
          </span>
        </header>

        {/* ── Overview metrics ── */}
        {(activeNav === 'Overview' || activeNav === 'Incident Casework') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total Cases',    value: data?.incidents.length ?? 0,                                              color: 'var(--highlight-color)' },
              { label: 'Open',           value: data?.incidents.filter(i => i.status === 'OPEN').length ?? 0,             color: '#ef4444' },
              { label: 'Investigating',  value: data?.incidents.filter(i => i.status === 'INVESTIGATING').length ?? 0,    color: '#f59e0b' },
              { label: 'Closed',         value: data?.incidents.filter(i => i.status === 'CLOSED').length ?? 0,           color: '#10b981' },
              { label: 'Evidence Items', value: data?.incidents.reduce((s, i) => s + i.evidence.length, 0) ?? 0,          color: 'var(--accent-color)' },
              { label: 'Anchored Reports', value: data?.reports.filter(r => r.txHash).length ?? 0,                       color: '#38bdf8' },
            ].map(m => (
              <div key={m.label} className="glass-panel" style={{ padding: '1rem 1.2rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>{m.label}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 700, color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Incident Casework ── */}
        {(activeNav === 'Overview' || activeNav === 'Incident Casework') && (
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--error-color)' }}>Active Incident Casework</h2>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {data?.incidents.map(inc => (
                <div key={inc.id} style={{ border: '1px solid var(--surface-border)', borderRadius: '10px', overflow: 'hidden' }}>
                  {/* Case header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(119,141,169,0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                          CASE-{inc.id}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: SEVERITY_COLOR[inc.severity] ?? 'transparent', color: SEVERITY_TEXT[inc.severity] ?? 'inherit', textTransform: 'uppercase' }}>
                          {inc.severity}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLOR[inc.status] ?? 'var(--text-secondary)' }}>
                          {inc.status}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{inc.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{inc.description}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.4rem' }}>
                        Opened {formatTs(inc.createdAt)} · Investigator: {inc.openedBy ?? '—'}
                        {inc.targetUserId ? ` · Subject: ${inc.targetUserId}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Counters row */}
                  <div style={{ display: 'flex', gap: '1.5rem', padding: '0.6rem 1.25rem', borderTop: '1px solid var(--surface-border)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>📋 <strong>{inc.timeline.length}</strong> Timeline events</span>
                    <span>🔎 <strong>{inc.evidence.length}</strong> Evidence findings</span>
                    <span>📄 <strong>{inc.reports.length}</strong> Forensic reports</span>
                  </div>

                  {/* Timeline */}
                  {inc.timeline.length > 0 && (
                    <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--surface-border)' }}>
                      <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Reconstructed Timeline</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {inc.timeline.map(tl => (
                          <div key={tl.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', paddingTop: '1px' }}>
                              {formatTs(tl.timestamp)}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{tl.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence */}
                  {inc.evidence.length > 0 && (
                    <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--surface-border)' }}>
                      <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Evidence Findings</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {inc.evidence.map(ev => (
                          <div key={ev.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.description}</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>{ev.evidenceType}</span>
                            </div>
                            <p style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>SHA-256: {ev.hashValue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Audit Trail ── */}
        {(activeNav === 'Overview' || activeNav === 'Audit Trail') && (
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--highlight-color)' }}>Cryptographic Audit Trail</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                    {['Event ID', 'Timestamp (UTC)', 'Actor', 'Action', 'Resource', 'SHA-256 Chain Hash'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.auditEvents.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(119, 141, 169, 0.1)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{log.id}</td>
                      <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{formatTs(log.timestamp)}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }}>{log.userId ?? <em style={{ color: 'var(--text-secondary)' }}>system</em>}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{ padding: '3px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: `${ACTION_COLOR[log.action] ?? 'var(--accent-color)'}22`, color: ACTION_COLOR[log.action] ?? 'var(--accent-color)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{log.resource}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-secondary)' }} title={log.hash}>{log.hash.slice(0, 24)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Forensic Reports ── */}
        {(activeNav === 'Overview' || activeNav === 'Forensic Reports') && (
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--accent-color)' }}>Anchored Forensic Reports</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {data?.reports.map(rep => (
                <div key={rep.id} style={{ border: '1px solid var(--surface-border)', padding: '1rem 1.25rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Report {rep.id} · Case {rep.incidentId}</p>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem' }}>{rep.title}</h3>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        SHA-256: {rep.reportHash}
                      </p>
                      {rep.txHash && (
                        <p style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                          On-chain · Block #{rep.blockNumber} · Tx: {rep.txHash.slice(0, 32)}…
                        </p>
                      )}
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: rep.txHash ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: rep.txHash ? 'var(--success-color)' : 'var(--error-color)', border: `1px solid ${rep.txHash ? 'var(--success-color)' : 'var(--error-color)'}`, whiteSpace: 'nowrap' }}>
                      {rep.txHash ? '✓ ANCHORED ON-CHAIN' : 'PENDING ANCHOR'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.5rem' }}>Generated {formatTs(rep.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
