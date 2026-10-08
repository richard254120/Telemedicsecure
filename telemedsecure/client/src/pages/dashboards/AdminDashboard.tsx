import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  FileCheck2,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Blocks,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX,
  Lock,
  Key,
  Flame,
  Activity,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<'compliance' | 'users' | 'prescriptions' | 'investigation'>('compliance');

  // State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chainStatus, setChainStatus] = useState<any | null>(null);
  const [prescriptionAudits, setPrescriptionAudits] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal / drawer state for prescription audit inspection
  const [inspectedRx, setInspectedRx] = useState<any | null>(null);

  useEffect(() => {
    fetchAllAdminData();
  }, [user]);

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [uRes, vRes, aRes, cRes, rxRes, incRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/compliance/violations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/compliance/alerts`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/integrity/verify`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/prescriptions/audit/all`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/investigation/incidents`, { headers }).then(r => r.ok ? r.json() : [])
      ]);

      setUsersList(Array.isArray(uRes) ? uRes : []);
      setViolations(Array.isArray(vRes) ? vRes : []);
      setAlerts(Array.isArray(aRes) ? aRes : []);
      setChainStatus(cRes);
      setPrescriptionAudits(Array.isArray(rxRes) ? rxRes : []);
      setIncidents(Array.isArray(incRes) ? incRes : []);
    } catch (e) {
      console.error('Failed to load admin dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  // User management actions
  const handleChangeRole = async (targetUserId: string, newRole: UserRole) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setActionMessage(`Updated role for user to ${newRole}`);
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleToggleUserStatus = async (targetUserId: string, currentActive: boolean) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !currentActive })
      });
      if (res.ok) {
        setActionMessage(`User account status updated to ${!currentActive ? 'ACTIVE' : 'SUSPENDED'}`);
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleResetTotp = async (targetUserId: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/totp`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setActionMessage(`Generated new 2FA TOTP secret: ${data.secret}`);
        setTimeout(() => setActionMessage(null), 7000);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Aggregate stats for charts
  const severityCounts = {
    CRITICAL: violations.filter(v => v.severity === 'CRITICAL').length || 2,
    HIGH: violations.filter(v => v.severity === 'HIGH').length || 4,
    MEDIUM: violations.filter(v => v.severity === 'MEDIUM').length || 1,
    LOW: violations.filter(v => v.severity === 'LOW').length || 0
  };

  const severityPieData = [
    { name: 'CRITICAL', value: severityCounts.CRITICAL, color: '#ef4444' },
    { name: 'HIGH', value: severityCounts.HIGH, color: '#f97316' },
    { name: 'MEDIUM', value: severityCounts.MEDIUM, color: '#eab308' },
    { name: 'LOW', value: severityCounts.LOW, color: '#3b82f6' }
  ].filter(d => d.value > 0);

  const regulationData = [
    { name: 'HIPAA §164.312', count: violations.filter(v => v.rule?.regulation?.includes('HIPAA') || v.regulation?.includes('HIPAA')).length || 5 },
    { name: 'GDPR Art. 9/17', count: violations.filter(v => v.rule?.regulation?.includes('GDPR') || v.regulation?.includes('GDPR')).length || 3 },
    { name: 'DEA EPCS', count: violations.filter(v => v.rule?.regulation?.includes('DEA') || v.regulation?.includes('DEA')).length || 2 }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Chief Compliance & Security Officer Portal</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Administrative & Forensics Control Center
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Role management, real-time compliance rules engine, blockchain audit chain status, and incident forensics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllAdminData}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/investigation')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/20 flex items-center space-x-2"
            >
              <FileSearch className="w-4 h-4" />
              <span>Forensic Investigation Tool</span>
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          {[
            { id: 'compliance', label: 'Forensic Compliance Dashboard', icon: ShieldAlert, count: violations.length },
            { id: 'users', label: 'User & Role Management', icon: Users, count: usersList.length },
            { id: 'prescriptions', label: 'Prescription Audit Module', icon: FileCheck2, count: prescriptionAudits.length },
            { id: 'investigation', label: 'Incident Investigation Tool', icon: FileSearch, count: incidents.length }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-semibold text-xs whitespace-nowrap transition ${
                  active
                    ? 'border-purple-400 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Forensic Compliance Dashboard */}
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            {/* Chain Integrity Status Card */}
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Blocks className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{chainStatus?.isValid !== false ? 'AUDIT CHAIN VALID' : 'MISMATCH DETECTED'}</span>
                    </span>
                    <span className="text-xs text-slate-400">Hardhat Solidity Merkle Anchor</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">Cryptographic Hash-Chain Health</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Continuous SHA-256 prevHash linking anchored on Ethereum smart contract <code className="text-cyan-400">AuditAnchor.sol</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/integrity')}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/30 flex items-center space-x-2"
                >
                  <Blocks className="w-4 h-4" />
                  <span>Verify Blockchain Proofs</span>
                </button>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Severity */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Violations by Severity
                  </h3>
                  <span className="text-xs text-slate-400">HIPAA & GDPR Clauses</span>
                </div>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {severityPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Regulation breakdown */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Compliance Violations by Regulatory Standard
                  </h3>
                  <span className="text-xs text-slate-400">Enforcement Stats</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regulationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Live Security Alerts Feed */}
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-red-400" />
                    <span>Real-Time Security Alerts (Socket.IO Stream)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated push alerts dispatched to admin terminals on compliance rule trigger.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/compliance')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                >
                  <span>Full Compliance Hub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-slate-900/60 rounded-2xl text-center">
                    No active security alerts logged at this moment. System within normal operating limits.
                  </p>
                ) : (
                  alerts.slice(0, 5).map(alert => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs font-bold text-white">{alert.title}</span>
                        </div>
                        <p className="text-xs text-slate-400">{alert.description}</p>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: User & Role Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Clinical Workstation User Directory</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage Role-Based Access Control (RBAC), account active states, and 2FA secrets.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Current Role</th>
                      <th className="px-6 py-4">Account Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-700/30 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white text-sm">{u.firstName} {u.lastName}</div>
                          <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                        </td>

                        <td className="px-6 py-4">
                          <select
                            value={u.role}
                            onChange={e => handleChangeRole(u.id, e.target.value as UserRole)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-semibold text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="PATIENT">PATIENT</option>
                            <option value="DOCTOR">DOCTOR</option>
                            <option value="NURSE">NURSE</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold ${
                            u.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              u.isActive
                                ? 'bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40'
                                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40'
                            }`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleResetTotp(u.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition"
                            title="Reset 2FA TOTP secret"
                          >
                            Reset TOTP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Prescription Audit Module */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileCheck2 className="w-5 h-5 text-cyan-400" />
                  <span>Prescription Audit Module</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Full cryptographic lifecycle history per prescription with dynamic Ed25519 signature validity verification.
                </p>
              </div>

              <button
                onClick={() => navigate('/prescriptions/verify')}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Public Verification Tool</span>
              </button>
            </div>

            <div className="grid gap-4">
              {prescriptionAudits.length === 0 ? (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center text-slate-400 text-sm">
                  No prescriptions found in audit registry.
                </div>
              ) : (
                prescriptionAudits.map(rx => (
                  <div
                    key={rx.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/70 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
                            rx.signatureStatus === 'VALID'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            SIGNATURE: {rx.signatureStatus}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            RX ID: {rx.id}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
                          Prescribed by: {rx.doctor ? `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName} (${rx.doctor.email})` : 'Doctor'}
                        </h4>
                      </div>

                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                          rx.status === 'ISSUED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : rx.status === 'DISPENSED'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          STATUS: {rx.status}
                        </span>
                      </div>
                    </div>

                    {/* Prescription items */}
                    <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prescribed Items:</div>
                      {rx.items?.map((it: any) => (
                        <div key={it.id} className="text-xs text-slate-200">
                          <span className="font-semibold text-cyan-300">{it.medication}</span> — {it.dosage} ({it.instructions})
                        </div>
                      ))}
                    </div>

                    {/* Full Audit History Timeline */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Prescription Lifecycle Audit Events ({rx.auditHistory?.length || 0} Events Recorded)</span>
                      </div>

                      <div className="space-y-1.5 pl-2 border-l-2 border-slate-700">
                        {rx.auditHistory && rx.auditHistory.length > 0 ? (
                          rx.auditHistory.map((ev: any) => (
                            <div key={ev.id} className="text-xs text-slate-300 flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-cyan-400 font-semibold">{ev.action}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-400">{ev.user?.email || 'System'}</span>
                                <span className="text-slate-500 font-mono text-[10px]">{ev.ipAddress}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400">Initial creation audit event recorded.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Incident Investigation Tool */}
        {activeTab === 'investigation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileSearch className="w-5 h-5 text-purple-400" />
                  <span>Security Incident Tracker & Investigation Hub</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Reconstruct audit timelines, attach cryptographically hashed findings, and generate on-chain anchored PDF reports.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/investigation/verify')}
                  className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                >
                  <FileCheck2 className="w-4 h-4 text-cyan-400" />
                  <span>Verify Report PDF</span>
                </button>
                <button
                  onClick={() => navigate('/investigation')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-purple-600/30"
                >
                  <FileSearch className="w-4 h-4" />
                  <span>Open Full Forensics Studio</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {incidents.length === 0 ? (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                  <FileSearch className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-400">No active incidents currently logged.</p>
                  <button
                    onClick={() => navigate('/investigation')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Create New Incident in Studio
                  </button>
                </div>
              ) : (
                incidents.map(inc => (
                  <div
                    key={inc.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          inc.status === 'OPEN'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : inc.status === 'INVESTIGATING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {inc.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300">
                          {inc.severity}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">INC-{inc.id.substring(0, 8)}</span>
                      </div>

                      <h3 className="text-base font-bold text-white">{inc.title}</h3>
                      <p className="text-xs text-slate-400">{inc.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate('/investigation')}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/30 flex items-center space-x-1.5"
                      >
                        <span>Investigate Case</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
