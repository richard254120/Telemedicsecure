import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE, WS_URL, BACKEND_URL } from '../config';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  FileCheck2,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Flame,
  Radio,
  FileWarning,
  EyeOff,
  UserX,
  ExternalLink,
  Info
} from 'lucide-react';

interface SecurityAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ruleId: string;
  title: string;
  description: string;
  sourceIp: string;
  createdAt: string;
}

interface ComplianceViolation {
  id: string;
  type: string;
  ruleId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  hipaaClause: string | null;
  gdprClause: string | null;
  userId: string | null;
  resource: string | null;
  reportedAt: string;
  resolved: boolean;
}

interface RuleDefinition {
  ruleId: string;
  name: string;
  defaultSeverity: string;
  violationType: string;
  hipaaClause: string;
  gdprClause: string;
  description: string;
}

interface ConsentRecord {
  id: string;
  purpose: string;
  granted: boolean;
  version: string;
  grantedAt: string;
  revokedAt: string | null;
}

export default function ComplianceDashboard() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules' | 'gdpr'>('alerts');

  // Rule Simulation Form State
  const [selectedSimRule, setSelectedSimRule] = useState<string>('UNENCRYPTED_PHI_DETECTED');
  const [simDescription, setSimDescription] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  // GDPR Export & Erasure States
  const [exportJustification, setExportJustification] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [erasureLoading, setErasureLoading] = useState(false);
  const [erasureResult, setErasureResult] = useState<any>(null);
  const [erasureConfirm, setErasureConfirm] = useState(false);

  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Demo patient & auth token
  const token = localStorage.getItem('token') || '';

  const fetchData = async () => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [vRes, aRes, rRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/compliance/violations`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/compliance/alerts`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/compliance/rules`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/gdpr/consent`, { headers }).then(r => r.json()),
      ]);

      if (Array.isArray(vRes)) setViolations(vRes);
      if (Array.isArray(aRes)) setAlerts(aRes);
      if (Array.isArray(rRes)) setRules(rRes);
      if (cRes?.consents) setConsents(cRes.consents);
    } catch (e) {
      console.error('Fetch compliance data error:', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.IO subscription to admin live alerts
    const s = io(WS_URL);
    socketRef.current = s;

    s.on('connect', () => {
      setSocketConnected(true);
      s.emit('join-admin', { role: 'ADMIN', userId: 'admin-dashboard' });
    });

    s.on('disconnect', () => {
      setSocketConnected(false);
    });

    s.on('security-alert', (payload: { alert: SecurityAlert; violation?: ComplianceViolation }) => {
      console.log('Incoming real-time SecurityAlert:', payload);
      setAlerts(prev => [payload.alert, ...prev]);
      if (payload.violation) {
        setViolations(prev => [payload.violation!, ...prev]);
      }
    });

    s.on('live-security-alert', (payload: { alert: SecurityAlert }) => {
      setAlerts(prev => {
        if (prev.find(a => a.id === payload.alert.id)) return prev;
        return [payload.alert, ...prev];
      });
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleSimulateRule = async () => {
    setIsSimulating(true);
    setSimMessage(null);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/compliance/simulate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ruleId: selectedSimRule,
          customDescription: simDescription || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSimMessage(`Success: ${selectedSimRule} detected & pushed live via Socket.IO!`);
        fetchData();
      } else {
        setSimMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setSimMessage(`Failed to trigger: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResolveViolation = async (id: string) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE}/compliance/violations/${id}/resolve`, {
        method: 'POST',
        headers,
      });

      setViolations(prev => prev.map(v => (v.id === id ? { ...v, resolved: true } : v)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleConsent = async (purpose: string, grant: boolean) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endpoint = grant ? '/api/v1/gdpr/consent' : '/api/v1/gdpr/consent/revoke';
      await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ purpose }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDataExport = async () => {
    setExportLoading(true);
    setExportError(null);
    setExportResult(null);

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/gdpr/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          justification: exportJustification,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExportError(data.error);
        fetchData(); // Will show new DATA_EXPORT_WITHOUT_JUSTIFICATION violation!
      } else {
        setExportResult(data);
      }
    } catch (e: any) {
      setExportError(e.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCryptoShredding = async () => {
    if (!erasureConfirm) return;
    setErasureLoading(true);

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/gdpr/erasure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: 'Patient exercised GDPR Art. 17 Right to Erasure',
          confirmShred: true,
        }),
      });

      const data = await res.json();
      setErasureResult(data);
      fetchData();
    } catch (e: any) {
      alert(`Erasure failed: ${e.message}`);
    } finally {
      setErasureLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Compliance Rules Engine & Security Operations
                </h1>
                <p className="text-sm text-slate-400">
                  Real-time detection of 9 HIPAA & GDPR violations with live Socket.IO push and GDPR endpoints
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <Radio className={`w-3.5 h-3.5 ${socketConnected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
              <span className="text-slate-300">
                Socket.IO: <strong className={socketConnected ? 'text-emerald-400' : 'text-red-400'}>
                  {socketConnected ? 'ADMIN PUSH LIVE' : 'DISCONNECTED'}
                </strong>
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'alerts'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Live Alerts & Violations ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'rules'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            The 9 Detection Rules & Tester
          </button>
          <button
            onClick={() => setActiveTab('gdpr')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'gdpr'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            GDPR Portal (Consent, Export, Erasure)
          </button>
        </div>

        {/* TAB 1: LIVE ALERTS & VIOLATIONS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Security Alerts</div>
                <div className="text-3xl font-bold text-white mt-1">{alerts.length}</div>
                <div className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> Live streaming
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Critical Violations</div>
                <div className="text-3xl font-bold text-red-400 mt-1">
                  {violations.filter(v => v.severity === 'CRITICAL').length}
                </div>
                <div className="text-xs text-slate-500 mt-1">Immediate intervention required</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">HIPAA / GDPR Violations</div>
                <div className="text-3xl font-bold text-amber-400 mt-1">{violations.length}</div>
                <div className="text-xs text-slate-500 mt-1">Mapped to regulatory clauses</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Resolved Cases</div>
                <div className="text-3xl font-bold text-emerald-400 mt-1">
                  {violations.filter(v => v.resolved).length}
                </div>
                <div className="text-xs text-emerald-500 mt-1">Audit verified</div>
              </div>
            </div>

            {/* Live Security Alerts Stream */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" /> Live Security Alert Stream (Socket.IO Admin Broadcast)
              </h2>

              {alerts.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">
                  No active security alerts. Platform integrity is nominal.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {alerts.slice(0, 8).map(alert => (
                    <div
                      key={alert.id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between space-x-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs font-semibold text-white">{alert.title}</span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{alert.description}</p>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Source: {alert.sourceIp} • {new Date(alert.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Violations Table */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-amber-400" /> Regulatory Compliance Violations (HIPAA / GDPR Clauses)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-xs text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Rule / Severity</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">HIPAA Clause</th>
                      <th className="py-3 px-4">GDPR Clause</th>
                      <th className="py-3 px-4">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {violations.slice(0, 15).map(v => (
                      <tr key={v.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-xs text-white">{v.ruleId}</div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(v.severity)}`}>
                            {v.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs text-xs text-slate-300">
                          {v.description}
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(v.reportedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-cyan-300/90 max-w-xs">
                          {v.hipaaClause || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-indigo-300/90 max-w-xs">
                          {v.gdprClause || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {v.resolved ? (
                            <span className="inline-flex items-center text-emerald-400 font-semibold gap-1 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                            </span>
                          ) : (
                            <button
                              onClick={() => handleResolveViolation(v.id)}
                              className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-xs transition"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: THE 9 DETECTION RULES & INTERACTIVE TESTER */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Interactive Simulation Panel */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" /> Interactive Rule Violation Simulator
              </h2>
              <p className="text-xs text-slate-400">
                Trigger any of the 9 required compliance detection rules on-demand. This tests rule logic, creates DB records, and broadcasts alerts live across Socket.IO.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Select Detection Rule:</label>
                  <select
                    value={selectedSimRule}
                    onChange={e => setSelectedSimRule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACCESS_OUTSIDE_ROLE_ASSIGNMENT">1. Access outside role/assignment</option>
                    <option value="BULK_RECORD_ACCESS">2. Bulk record access</option>
                    <option value="OFF_HOURS_ACCESS">3. Off-hours access</option>
                    <option value="REPEATED_FAILED_LOGINS">4. Repeated failed logins</option>
                    <option value="PRESCRIPTION_EDITED_AFTER_SIGNING">5. Prescription edited after signing</option>
                    <option value="UNENCRYPTED_PHI_DETECTED">6. Unencrypted PHI detected</option>
                    <option value="CONSENT_MISSING">7. Consent missing (GDPR)</option>
                    <option value="DATA_EXPORT_WITHOUT_JUSTIFICATION">8. Data export without justification</option>
                    <option value="AUDIT_CHAIN_BREAK">9. Audit chain break</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Custom Description / Payload (Optional):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={simDescription}
                      onChange={e => setSimDescription(e.target.value)}
                      placeholder="e.g. Plaintext SSN 000-12-3456 detected in doctor draft note"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleSimulateRule}
                      disabled={isSimulating}
                      className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-medium rounded-lg text-xs transition flex items-center gap-1.5 shadow-md shadow-red-500/20 disabled:opacity-50"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      {isSimulating ? 'Triggering...' : 'Trigger Violation'}
                    </button>
                  </div>
                </div>
              </div>

              {simMessage && (
                <div className={`p-3 rounded-lg text-xs font-mono ${simMessage.startsWith('Success') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
                  {simMessage}
                </div>
              )}
            </div>

            {/* Catalog of 9 Rules with Clauses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rules.map((rule, idx) => (
                <div key={rule.ruleId} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-slate-400">Rule #{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(rule.defaultSeverity)}`}>
                      {rule.defaultSeverity}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rule.description}</p>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-500">HIPAA: </span>
                      <span className="text-cyan-400">{rule.hipaaClause}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">GDPR: </span>
                      <span className="text-indigo-400">{rule.gdprClause}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GDPR PORTAL (CONSENT, EXPORT, RIGHT-TO-ERASURE) */}
        {activeTab === 'gdpr' && (
          <div className="space-y-8">
            {/* 1. Consent Tracking */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" /> GDPR Consent Tracking (Art. 6 & 9)
              </h2>
              <p className="text-xs text-slate-400">
                Active explicit consent is required before health data processing, consultation scheduling, or medical record generation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { purpose: 'TELEMEDICINE_TREATMENT', label: 'Telemedicine Treatment' },
                  { purpose: 'DATA_PROCESSING', label: 'EPHI Data Processing' },
                  { purpose: 'PRESCRIPTION_DISPENSING', label: 'Prescription Dispensing' },
                  { purpose: 'CLINICAL_AUDIT_LOGGING', label: 'Audit Hash Chaining' },
                ].map(item => {
                  const active = consents.find(c => c.purpose === item.purpose && c.granted && !c.revokedAt);
                  return (
                    <div key={item.purpose} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{item.label}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>
                          {active ? 'GRANTED' : 'REVOKED'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Purpose: {item.purpose}</div>
                      <button
                        onClick={() => handleToggleConsent(item.purpose, !active)}
                        className={`w-full py-1.5 rounded text-xs font-medium transition ${
                          active
                            ? 'bg-red-600/20 text-red-300 hover:bg-red-600/40 border border-red-500/30'
                            : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30'
                        }`}
                      >
                        {active ? 'Revoke Consent' : 'Grant Consent'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Data Portability Export (GDPR Art. 20) */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-cyan-400" /> GDPR Art. 20 Data Portability Export
              </h2>
              <p className="text-xs text-slate-400">
                Exports complete canonical record set with SHA-256 integrity checksum. <strong className="text-amber-400">Enforces mandatory justification</strong> (rule flags violation if missing).
              </p>

              <div className="space-y-3 max-w-xl">
                <label className="text-xs text-slate-300 font-medium">Export Justification (Required):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exportJustification}
                    onChange={e => setExportJustification(e.target.value)}
                    placeholder="e.g. Patient transfer to specialist clinic (Portability request)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleDataExport}
                    disabled={exportLoading}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportLoading ? 'Exporting...' : 'Request Export'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  Tip: Leaving this empty tests the <strong>DATA_EXPORT_WITHOUT_JUSTIFICATION</strong> rule!
                </div>
              </div>

              {exportError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 font-mono">
                  Export Blocked: {exportError} (Violation recorded & alert dispatched)
                </div>
              )}

              {exportResult && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>Export Generated Successfully</span>
                    <span className="font-mono text-[10px] text-slate-400">SHA-256: {exportResult.checksumSha256?.slice(0, 16)}...</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto max-h-48">
                    {JSON.stringify(exportResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* 3. Right-to-Erasure via Crypto-Shredding (GDPR Art. 17) */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-900 border border-red-900/30 space-y-4">
              <div className="flex items-center space-x-3 text-red-400">
                <Trash2 className="w-6 h-6" />
                <h2 className="text-lg font-semibold text-white">
                  GDPR Art. 17 Right to Erasure (Crypto-Shredding of Keys)
                </h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Executes mathematical <strong>crypto-shredding</strong>: permanently zeroes and overwrites the per-record AES-256 Data Encryption Keys (DEKs) for all medical records, consultation notes, and vitals. Since envelope encryption is used, obliterating the DEK renders the ciphertext mathematically unrecoverable for eternity.
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-red-950/40 space-y-3 max-w-xl">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={erasureConfirm}
                    onChange={e => setErasureConfirm(e.target.checked)}
                    className="rounded border-slate-800 text-red-600 focus:ring-0"
                  />
                  <span>I confirm permanent crypto-shredding of all encryption keys for this patient.</span>
                </label>

                <button
                  onClick={handleCryptoShredding}
                  disabled={!erasureConfirm || erasureLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs transition flex items-center gap-1.5 shadow-md shadow-red-600/30 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {erasureLoading ? 'Shredding Keys...' : 'Execute Crypto-Shredding'}
                </button>
              </div>

              {erasureResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono space-y-1">
                  <div>✓ {erasureResult.message}</div>
                  <div>Records Shredded: {erasureResult.recordsShredded} | Consultations Shredded: {erasureResult.consultationsShredded}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
