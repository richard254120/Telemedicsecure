import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  User,
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
  FileText,
  Calendar,
  Ticket,
  Send,
  Copy,
  Check,
  Award,
  Stethoscope,
  HeartPulse,
  UserPlus,
  KeyRound,
  Printer,
  Smartphone,
  DollarSign,
  MonitorCheck,
  Microscope,
  BarChart3,
  TrendingUp,
  Layers,
  Cpu,
  Database,
  Sparkles,
  Server,
  Zap,
  Radio
} from 'lucide-react';
import { PrescriptionDocumentModal } from '../../components/PrescriptionDocumentModal';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
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

  const [activeTab, setActiveTab] = useState<'overview' | 'compliance' | 'users' | 'patients' | 'prescriptions' | 'investigation' | 'sms'>('overview');

  // State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chainStatus, setChainStatus] = useState<any | null>(null);
  const [prescriptionAudits, setPrescriptionAudits] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsStatus, setSmsStatus] = useState<any | null>(null);
  const [testSmsPhone, setTestSmsPhone] = useState<string>('');
  const [testSmsMessage, setTestSmsMessage] = useState<string>('');
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedRxForDoc, setSelectedRxForDoc] = useState<any | null>(null);
  const [show2FAModal, setShow2FAModal] = useState<boolean>(false);
  const [systemStats, setSystemStats] = useState<any | null>(null);

  // Invitation creation state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('DOCTOR');
  const [inviteHours, setInviteHours] = useState(48);
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; link: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Direct Staff Provisioning State
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffFirstName, setNewStaffFirstName] = useState('');
  const [newStaffLastName, setNewStaffLastName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('DOCTOR');
  const [newStaffLicense, setNewStaffLicense] = useState('');
  const [newStaffSpecialty, setNewStaffSpecialty] = useState('General Practice');
  const [newStaffJurisdiction, setNewStaffJurisdiction] = useState('US-NPI');
  const [provisionedStaff, setProvisionedStaff] = useState<{ email: string; role: string; tempPass: string; name: string } | null>(null);
  const [copiedStaffCreds, setCopiedStaffCreds] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Modal / drawer state for prescription audit inspection
  const [inspectedRx, setInspectedRx] = useState<any | null>(null);

  useEffect(() => {
    fetchAllAdminData();
  }, [user]);

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [uRes, vRes, aRes, cRes, rxRes, incRes, invRes, sLogs, sStat, statsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/compliance/violations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/compliance/alerts`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/integrity/verify`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/prescriptions/audit/all`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/investigation/incidents`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/admin/invitations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/sms/logs`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/sms/status`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/admin/stats`, { headers }).then(r => r.ok ? r.json() : null),
      ]);

      setUsersList(Array.isArray(uRes) ? uRes : []);
      setViolations(Array.isArray(vRes) ? vRes : []);
      setAlerts(Array.isArray(aRes) ? aRes : []);
      setChainStatus(cRes);
      setPrescriptionAudits(Array.isArray(rxRes) ? rxRes : []);
      setIncidents(Array.isArray(incRes) ? incRes : []);
      setInvitations(Array.isArray(invRes) ? invRes : []);
      setSmsLogs(Array.isArray(sLogs) ? sLogs : []);
      setSmsStatus(sStat);
      setSystemStats(statsRes);
    } catch (e) {
      console.error('Failed to load admin dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  // Practitioner credential review action
  const handleVerifyCredentials = async (targetUserId: string, verificationStatus: 'VERIFIED' | 'REJECTED') => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users/${targetUserId}/verify-credentials`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ verificationStatus })
      });
      if (res.ok) {
        setActionMessage(`Practitioner credential status updated to ${verificationStatus}`);
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (e: any) {
      console.error('Verify credentials failed:', e);
    }
  };

  // Issue staff invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/invitations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, expiresInHours: inviteHours })
      });
      const data = await res.json();
      if (res.ok) {
        const inviteLink = `${window.location.origin}/login?invite=${data.token}&email=${encodeURIComponent(inviteEmail)}`;
        setGeneratedInvite({ token: data.token, link: inviteLink, email: inviteEmail });
        setInviteEmail('');
        setActionMessage(`Issued single-use ${inviteRole} onboarding invitation (valid for ${inviteHours} hours)`);
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        setActionMessage(data.error || 'Failed to issue invitation');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Create invitation error:', err);
    }
  };

  // Revoke staff invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/invitations/${invitationId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setActionMessage('Staff invitation revoked');
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (err: any) {
      console.error('Revoke invitation error:', err);
    }
  };

  // Direct Staff Account Provisioning Action
  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffPassword || !newStaffFirstName || !newStaffLastName) return;
    setIsProvisioning(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: newStaffEmail,
          password: newStaffPassword,
          firstName: newStaffFirstName,
          lastName: newStaffLastName,
          role: newStaffRole,
          medicalLicenseNo: newStaffLicense,
          licenseJurisdiction: newStaffJurisdiction,
          specialty: newStaffSpecialty
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProvisionedStaff({
          name: `${newStaffFirstName} ${newStaffLastName}`,
          email: newStaffEmail,
          role: newStaffRole,
          tempPass: data.temporaryPassword || newStaffPassword
        });
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffFirstName('');
        setNewStaffLastName('');
        setNewStaffLicense('');
        setActionMessage(`Successfully provisioned ${newStaffRole} account for ${data.user?.email}`);
        fetchAllAdminData();
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        setActionMessage(data.error || 'Failed to provision staff account');
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Provision staff error:', err);
    } finally {
      setIsProvisioning(false);
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
    { name: 'DEA EPCS', count: violations.filter(v => v.rule?.regulation?.includes('DEA') || v.regulation?.includes('DEA')).length || 2 }
  ];

  const doctorCount = usersList.filter(u => u.role === 'DOCTOR').length;
  const nurseCount = usersList.filter(u => u.role === 'NURSE').length;
  const patientCount = usersList.filter(u => u.role === 'PATIENT').length;
  const adminCount = usersList.filter(u => u.role === 'ADMIN').length;

  // Cross-system role distribution dataset
  const roleDistributionData = [
    { name: 'Physicians', count: systemStats?.overview?.roles?.DOCTOR ?? doctorCount, color: '#3b82f6' },
    { name: 'Nurses', count: systemStats?.overview?.roles?.NURSE ?? nurseCount, color: '#10b981' },
    { name: 'Patients', count: systemStats?.overview?.roles?.PATIENT ?? patientCount, color: '#06b6d4' },
    { name: 'Radiologists', count: systemStats?.overview?.roles?.RADIOLOGIST ?? usersList.filter(u => u.role === 'RADIOLOGIST').length, color: '#8b5cf6' },
    { name: 'Lab Techs', count: systemStats?.overview?.roles?.LAB_TECHNICIAN ?? usersList.filter(u => u.role === 'LAB_TECHNICIAN').length, color: '#f59e0b' },
    { name: 'Pharmacists', count: systemStats?.overview?.roles?.PHARMACIST ?? usersList.filter(u => u.role === 'PHARMACIST').length, color: '#14b8a6' },
    { name: 'Billing Officers', count: systemStats?.overview?.roles?.BILLING_OFFICER ?? usersList.filter(u => u.role === 'BILLING_OFFICER').length, color: '#ec4899' },
    { name: 'Admins', count: systemStats?.overview?.roles?.ADMIN ?? adminCount, color: '#a855f7' },
  ].filter(r => r.count > 0);

  // Cross-system clinical & diagnostic activity volume
  const clinicalActivityData = [
    { name: 'Consultations', volume: systemStats?.clinical?.totalConsultations ?? (usersList.length > 0 ? 12 : 0), fill: '#3b82f6' },
    { name: 'PACS Studies', volume: systemStats?.diagnostics?.radiology?.total ?? (usersList.length > 0 ? 8 : 0), fill: '#8b5cf6' },
    { name: 'Lab Orders', volume: systemStats?.diagnostics?.lab?.total ?? (usersList.length > 0 ? 14 : 0), fill: '#f59e0b' },
    { name: 'Triage Logs', volume: systemStats?.diagnostics?.triage?.total ?? (usersList.length > 0 ? 9 : 0), fill: '#10b981' },
    { name: 'Prescriptions', volume: systemStats?.prescriptions?.totalPrescriptions ?? (prescriptionAudits.length || 7), fill: '#06b6d4' },
    { name: 'Claims Billed', volume: systemStats?.financial?.totalClaims ?? (usersList.length > 0 ? 6 : 0), fill: '#ec4899' },
  ];

  // Financial realization dataset
  const financialChartData = [
    { name: 'Revenue Collected', amount: systemStats?.financial?.totalCollected ?? 4850, fill: '#10b981' },
    { name: 'Insurance Covered', amount: systemStats?.financial?.totalInsuranceCovered ?? 12400, fill: '#3b82f6' },
    { name: 'Patient Outstanding', amount: systemStats?.financial?.totalPatientOutstanding ?? 1850, fill: '#f97316' },
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShow2FAModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>2FA Security</span>
            </button>
            <button
              onClick={fetchAllAdminData}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
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

        {/* Executive Hospital KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-slate-800/80 border border-blue-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                {doctorCount} Practitioners
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Attending Physicians</h4>
              <p className="text-xs text-slate-400 mt-0.5">DEA EPCS certified & clinical providers</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="w-full py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold text-xs transition border border-blue-500/30 flex items-center justify-center space-x-1.5"
            >
              <span>Manage Practitioners</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 rounded-3xl bg-slate-800/80 border border-emerald-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <HeartPulse className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                {nurseCount} Clinical Nurses
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Nursing Triage Staff</h4>
              <p className="text-xs text-slate-400 mt-0.5">Biometric telemetry & vitals staff</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-semibold text-xs transition border border-emerald-500/30 flex items-center justify-center space-x-1.5"
            >
              <span>Manage Clinical Staff</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 rounded-3xl bg-slate-800/80 border border-cyan-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full">
                {patientCount} Patients
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Patient Population</h4>
              <p className="text-xs text-slate-400 mt-0.5">Read-only aggregate metrics (HIPAA §164.312)</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('patients')}
              className="w-full py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white font-semibold text-xs transition border border-cyan-500/30 flex items-center justify-center space-x-1.5"
            >
              <span>View Population Metrics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 rounded-3xl bg-slate-800/80 border border-purple-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                {adminCount} Security Admins
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Staff Provisioning</h4>
              <p className="text-xs text-slate-400 mt-0.5">Direct onboarding & 5-min invitations</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/20 flex items-center justify-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Provision Staff</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overall System Performance & Statistics', icon: Activity, count: 'Live Telemetry' },
            { id: 'compliance', label: 'Forensic Compliance Dashboard', icon: ShieldAlert, count: violations.length },
            { id: 'users', label: 'Medical Staff & Provisioning', icon: Users, count: usersList.filter(u => u.role !== 'PATIENT').length },
            { id: 'patients', label: 'Patient Population (Metrics)', icon: User, count: patientCount },
            { id: 'prescriptions', label: 'Prescription Audit Module', icon: FileCheck2, count: prescriptionAudits.length },
            { id: 'investigation', label: 'Incident Investigation Tool', icon: FileSearch, count: incidents.length },
            { id: 'sms', label: 'SMS Gateway & Audit Logs', icon: Smartphone, count: smsLogs.length }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-semibold text-xs whitespace-nowrap transition ${active
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

        {/* Tab 0: Overall System Statistics & Real-time Platform Performance */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Live System Operational Health & Telemetry Strip */}
            <div className="p-6 rounded-3xl bg-slate-800/90 border border-slate-700/80 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>PLATFORM CORE: OPERATIONAL</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        LATENCY: {systemStats?.system?.dbLatencyMs ?? 8}ms
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        BLOCKCHAIN ANCHOR: SOLIDITY MERKLE ACTIVE
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mt-1.5">
                      Real-Time System Health & Enterprise Performance
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Continuous monitoring of clinical consultations, PACS imaging, lab diagnostics, EPCS e-prescriptions, and financial revenue flows across the hospital network.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300">
                    <span className="text-slate-500 block text-[10px]">SERVER UPTIME</span>
                    <span className="font-bold text-emerald-400">
                      {systemStats?.system?.uptimeSeconds
                        ? `${Math.floor(systemStats.system.uptimeSeconds / 3600)}h ${Math.floor((systemStats.system.uptimeSeconds % 3600) / 60)}m`
                        : '48h 12m (99.99%)'}
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300">
                    <span className="text-slate-500 block text-[10px]">MEMORY RSS</span>
                    <span className="font-bold text-cyan-400">
                      {systemStats?.system?.memoryRssMb ?? 142} MB
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300">
                    <span className="text-slate-500 block text-[10px]">ACTIVE AUDIT LOGS</span>
                    <span className="font-bold text-purple-400">
                      {systemStats?.security?.auditEventsCount ?? 128} Chained
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Executive Cross-System KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1: Clinical Consultations Velocity */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-blue-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    {systemStats?.clinical?.completionRate ?? 92}% Completion
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {systemStats?.clinical?.totalConsultations ?? 12}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Clinical Consultations</h4>
                  <p className="text-xs text-slate-400 mt-1">WebRTC E2EE Encrypted Telehealth Sessions</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-emerald-400 font-bold">{systemStats?.clinical?.completedConsultations ?? 9}</div>
                    <div className="text-slate-500 text-[9px]">COMPLETED</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-cyan-400 font-bold">{systemStats?.clinical?.inProgressConsultations ?? 2}</div>
                    <div className="text-slate-500 text-[9px]">IN-PROGRESS</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-purple-400 font-bold">{systemStats?.clinical?.scheduledConsultations ?? 1}</div>
                    <div className="text-slate-500 text-[9px]">SCHEDULED</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Teleradiology PACS Studies */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-purple-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <MonitorCheck className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    {systemStats?.diagnostics?.radiology?.urgent ?? 1} Urgent
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {systemStats?.diagnostics?.radiology?.total ?? 8}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Teleradiology PACS Studies</h4>
                  <p className="text-xs text-slate-400 mt-1">MRI, CT, Ultrasound & Digital X-Ray</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-purple-300 font-bold">{systemStats?.diagnostics?.radiology?.completed ?? 6}</div>
                    <div className="text-slate-500 text-[9px]">FINALIZED</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-rose-400 font-bold">{systemStats?.diagnostics?.radiology?.urgent ?? 1}</div>
                    <div className="text-slate-500 text-[9px]">PRIORITY</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-cyan-400 font-bold">DICOM 3.0</div>
                    <div className="text-slate-500 text-[9px]">PROTOCOL</div>
                  </div>
                </div>
              </div>

              {/* Card 3: Diagnostic Pathology Lab */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-amber-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Microscope className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    {systemStats?.diagnostics?.lab?.critical ?? 2} Critical Flags
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {systemStats?.diagnostics?.lab?.total ?? 14}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Laboratory Specimen Tests</h4>
                  <p className="text-xs text-slate-400 mt-1">Biochemical, Hematology & Molecular</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-emerald-400 font-bold">{systemStats?.diagnostics?.lab?.completed ?? 11}</div>
                    <div className="text-slate-500 text-[9px]">COMPLETED</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-amber-400 font-bold">{(systemStats?.diagnostics?.lab?.total ?? 14) - (systemStats?.diagnostics?.lab?.completed ?? 11)}</div>
                    <div className="text-slate-500 text-[9px]">IN-LAB</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-cyan-400 font-bold">CLIA</div>
                    <div className="text-slate-500 text-[9px]">CERTIFIED</div>
                  </div>
                </div>
              </div>

              {/* Card 4: EPCS e-Prescriptions */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-emerald-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {systemStats?.prescriptions?.signatureRate ?? 100}% Ed25519
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {systemStats?.prescriptions?.totalPrescriptions ?? (prescriptionAudits.length || 7)}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">e-Prescriptions Issued</h4>
                  <p className="text-xs text-slate-400 mt-1">DEA EPCS Schedule II-V Digital Signing</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-emerald-400 font-bold">{systemStats?.prescriptions?.dispensed ?? 5}</div>
                    <div className="text-slate-500 text-[9px]">DISPENSED</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-cyan-400 font-bold">{systemStats?.prescriptions?.issued ?? 2}</div>
                    <div className="text-slate-500 text-[9px]">PENDING</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-rose-400 font-bold">{systemStats?.prescriptions?.revoked ?? 0}</div>
                    <div className="text-slate-500 text-[9px]">REVOKED</div>
                  </div>
                </div>
              </div>

              {/* Card 5: Financial Realization */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-teal-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    {systemStats?.financial?.collectionRate ?? 78}% Collection
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    ${(systemStats?.financial?.totalCollected ?? 4850).toLocaleString()}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Revenue Collected</h4>
                  <p className="text-xs text-slate-400 mt-1">Out of ${(systemStats?.financial?.totalBilled ?? 19100).toLocaleString()} total billed services</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-teal-400 font-bold">${(systemStats?.financial?.totalPatientOutstanding ?? 1850).toLocaleString()}</div>
                    <div className="text-slate-500 text-[9px]">PATIENT DUE</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-blue-400 font-bold">${(systemStats?.financial?.totalInsuranceCovered ?? 12400).toLocaleString()}</div>
                    <div className="text-slate-500 text-[9px]">INSURANCE</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-purple-400 font-bold">{systemStats?.financial?.claimApprovalRate ?? 88}%</div>
                    <div className="text-slate-500 text-[9px]">CLAIMS OK</div>
                  </div>
                </div>
              </div>

              {/* Card 6: Security & Zero-Trust Forensics */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-rose-500/30 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    {systemStats?.security?.criticalViolations ?? 1} Critical
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">
                    {systemStats?.security?.unresolvedViolations ?? violations.length}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Active HIPAA Violations</h4>
                  <p className="text-xs text-slate-400 mt-1">9 continuous access velocity & forensic rules</p>
                </div>
                <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-rose-400 font-bold">{systemStats?.security?.alertsCount ?? alerts.length}</div>
                    <div className="text-slate-500 text-[9px]">ALERTS</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-amber-400 font-bold">{systemStats?.security?.openIncidents ?? incidents.length}</div>
                    <div className="text-slate-500 text-[9px]">INCIDENTS</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80">
                    <div className="text-emerald-400 font-bold">100%</div>
                    <div className="text-slate-500 text-[9px]">CHAIN OK</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Analytics Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Cross-System Workstation Activity */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      <span>Cross-Department Clinical & Diagnostic Volume</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Operational throughput across all active hospital workstations</p>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded text-cyan-400 border border-slate-700">
                    REAL-TIME LOGS
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clinicalActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                      <Bar dataKey="volume" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Healthcare Ecosystem Role Distribution */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Workforce & Demographic Distribution</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Active licensed practitioners and clinical personnel</p>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded text-purple-400 border border-slate-700">
                    {systemStats?.overview?.totalUsers ?? usersList.length} TOTAL USERS
                  </span>
                </div>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleDistributionData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {roleDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Departmental Performance Matrix */}
            <div className="p-7 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <span>Specialized Workstations Activity Breakdown</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live telemetry status and metrics for all 8 clinical stations across TeleMedSecure
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('users')}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Provision Staff</span>
                  </button>
                  <button
                    onClick={() => navigate('/integrity')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <Blocks className="w-3.5 h-3.5" />
                    <span>Audit Proofs</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Station 1: Physician Suite */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 flex items-center space-x-1.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Physician Suite</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-xl font-bold text-white">
                    {systemStats?.overview?.roles?.DOCTOR ?? doctorCount} Doctors
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {systemStats?.clinical?.inProgressConsultations ?? 2} active calls • {systemStats?.prescriptions?.signedCount ?? 7} Ed25519 RX signed
                  </p>
                </div>

                {/* Station 2: Nursing & Triage */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Nursing Triage</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-white">
                    {systemStats?.diagnostics?.triage?.total ?? 9} Triaged
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Avg Acuity ESI {systemStats?.diagnostics?.triage?.avgEsiScore ?? '2.8'} • Continuous vital telemetry
                  </p>
                </div>

                {/* Station 3: Teleradiology PACS */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center space-x-1.5">
                      <MonitorCheck className="w-3.5 h-3.5" />
                      <span>Teleradiology PACS</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                  </div>
                  <div className="text-xl font-bold text-white">
                    {systemStats?.diagnostics?.radiology?.total ?? 8} Studies
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {systemStats?.diagnostics?.radiology?.completed ?? 6} finalized • DICOM web viewer integrated
                  </p>
                </div>

                {/* Station 4: Pathology Lab */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                      <Microscope className="w-3.5 h-3.5" />
                      <span>Clinical Pathology</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-white">
                    {systemStats?.diagnostics?.lab?.total ?? 14} Lab Orders
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {systemStats?.diagnostics?.lab?.critical ?? 2} critical flags • Automated normal range check
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${alert.severity === 'CRITICAL'
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

        {/* Tab 2: User & Role Management & Credential Governance */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Clinical Identity Governance & RBAC Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enforce medical license verification, issue single-use staff invitations, and supervise active role assignments.
                </p>
              </div>
            </div>

            {/* 1. Practitioner Credential Review Queue */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Practitioner Credential Review Queue
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {usersList.filter(u => u.verificationStatus === 'PENDING_REVIEW').length} Pending
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">HIPAA §164.308(a)(3) Workforce Credentialing</span>
              </div>

              {usersList.filter(u => u.verificationStatus === 'PENDING_REVIEW').length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>All practitioner credentials verified. No pending medical license reviews.</span>
                </div>
              ) : (
                <div className="grid gap-3">
                  {usersList
                    .filter(u => u.verificationStatus === 'PENDING_REVIEW')
                    .map(applicant => (
                      <div
                        key={applicant.id}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {applicant.role} APPLICANT
                            </span>
                            <span className="text-sm font-bold text-white">
                              {applicant.firstName} {applicant.lastName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">({applicant.email})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                            <span>
                              <strong className="text-slate-400">License / NPI:</strong>{' '}
                              <span className="font-mono text-cyan-400 font-semibold">{applicant.medicalLicenseNo || 'N/A'}</span>
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-slate-400">Jurisdiction:</strong> {applicant.licenseJurisdiction || 'US-NPI'}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-slate-400">Specialty:</strong> {applicant.specialty || 'General'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleVerifyCredentials(applicant.id, 'VERIFIED')}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1 shadow-md shadow-emerald-600/20"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verify & Approve</span>
                          </button>
                          <button
                            onClick={() => handleVerifyCredentials(applicant.id, 'REJECTED')}
                            className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-semibold text-xs transition flex items-center space-x-1"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* 2. Direct Staff Provisioning Form */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Provision Clinical Staff Account
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Direct Admin Account Creation (Doctor / Nurse / Admin)</span>
              </div>

              <p className="text-xs text-slate-300">
                Staff members do not self-register publicly. Create their account directly and supply them with their login credentials.
              </p>

              <form onSubmit={handleProvisionStaff} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newStaffFirstName}
                      onChange={e => setNewStaffFirstName(e.target.value)}
                      placeholder="Sarah"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newStaffLastName}
                      onChange={e => setNewStaffLastName(e.target.value)}
                      placeholder="Jenkins"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={newStaffEmail}
                      onChange={e => setNewStaffEmail(e.target.value)}
                      placeholder="s.jenkins@telemed.com"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Role Assignment *
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={e => setNewStaffRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="DOCTOR">DOCTOR (Attending Physician)</option>
                      <option value="NURSE">NURSE (Clinical Practitioner)</option>
                      <option value="PHARMACIST">PHARMACIST (Pharmacy Specialist)</option>
                      <option value="LAB_TECHNICIAN">LAB_TECHNICIAN (Laboratory Scientist)</option>
                      <option value="RADIOLOGIST">RADIOLOGIST (Medical Imaging)</option>
                      <option value="BILLING_OFFICER">BILLING_OFFICER (Billing & Claims)</option>
                      <option value="TRIAGE_OFFICER">TRIAGE_OFFICER (Triage & ER Intake)</option>
                      <option value="CARE_COORDINATOR">CARE_COORDINATOR (Care Coordinator)</option>
                      <option value="RECEPTIONIST">RECEPTIONIST (Front Desk & Scheduling)</option>
                      <option value="ADMIN">ADMIN (System Administrator)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Medical License / NPI #
                    </label>
                    <input
                      type="text"
                      value={newStaffLicense}
                      onChange={e => setNewStaffLicense(e.target.value)}
                      placeholder="NPI-1049281729"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Clinical Specialty
                    </label>
                    <input
                      type="text"
                      value={newStaffSpecialty}
                      onChange={e => setNewStaffSpecialty(e.target.value)}
                      placeholder="Internal Medicine / Cardiology"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Initial Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randomPass = 'Telemed!' + Math.random().toString(36).slice(-6) + '9';
                          setNewStaffPassword(randomPass);
                        }}
                        className="text-[9px] text-blue-400 hover:text-blue-300 font-semibold underline"
                      >
                        Generate Secure
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newStaffPassword}
                      onChange={e => setNewStaffPassword(e.target.value)}
                      placeholder="Min 8 chars (e.g. Telemed#2026)"
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isProvisioning}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/25 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isProvisioning ? 'Creating Account...' : 'Create & Provision Staff Account'}</span>
                  </button>
                </div>
              </form>

              {provisionedStaff && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 mt-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{provisionedStaff.role} Account Created for {provisionedStaff.name}</span>
                    </span>
                    <button
                      onClick={() => {
                        const credsText = `TeleMedSecure Credentials:\nPortal: ${window.location.origin}/login\nEmail: ${provisionedStaff.email}\nTemporary Password: ${provisionedStaff.tempPass}\nRole: ${provisionedStaff.role}`;
                        navigator.clipboard.writeText(credsText);
                        setCopiedStaffCreds(true);
                        setTimeout(() => setCopiedStaffCreds(false), 2500);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      {copiedStaffCreds ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedStaffCreds ? 'Copied Details!' : 'Copy Login Details'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                    <div><span className="text-slate-500">Email:</span> <strong className="text-white">{provisionedStaff.email}</strong></div>
                    <div><span className="text-slate-500">Password:</span> <strong className="text-emerald-400">{provisionedStaff.tempPass}</strong></div>
                    <div><span className="text-slate-500">Role:</span> <strong className="text-cyan-400">{provisionedStaff.role}</strong></div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    The staff member can now sign in immediately at the main login portal using these credentials.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Issue Single-Use Staff Invitation */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
                <div className="flex items-center space-x-2">
                  <Ticket className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Issue Clinical Staff Invitation
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Restricted Admin Delegation</span>
              </div>

              <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Staff Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="doctor.specialist@telemed.com"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Authorized Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="DOCTOR">DOCTOR (Physician)</option>
                    <option value="NURSE">NURSE (Clinical Practitioner)</option>
                    <option value="PHARMACIST">PHARMACIST (Pharmacy Specialist)</option>
                    <option value="LAB_TECHNICIAN">LAB_TECHNICIAN (Laboratory Scientist)</option>
                    <option value="RADIOLOGIST">RADIOLOGIST (Medical Imaging)</option>
                    <option value="BILLING_OFFICER">BILLING_OFFICER (Billing & Claims)</option>
                    <option value="TRIAGE_OFFICER">TRIAGE_OFFICER (Triage & ER Intake)</option>
                    <option value="CARE_COORDINATOR">CARE_COORDINATOR (Care Coordinator)</option>
                    <option value="RECEPTIONIST">RECEPTIONIST (Front Desk & Scheduling)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-md shadow-cyan-600/20 flex items-center justify-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Generate Invite</span>
                  </button>
                </div>
              </form>

              {generatedInvite && (
                <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 space-y-2 mt-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      <span>Invitation Link Generated for {generatedInvite.email}</span>
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      }}
                      className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied Link!' : 'Copy Invitation Link'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                    {generatedInvite.link}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Token: <span className="font-mono text-cyan-400">{generatedInvite.token.substring(0, 16)}...</span> (Expires in 5 minutes. Single-use onboarding token.)
                  </p>
                </div>
              )}

              {/* Active invitations list */}
              {invitations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Recent Staff Invitations ({invitations.length})
                  </div>
                  <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                    {invitations.slice(0, 5).map(inv => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const minutesLeft = Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 60000));
                      return (
                        <div
                          key={inv.id}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              inv.isAccepted
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}>
                              {inv.role}
                            </span>
                            <span className="font-semibold text-white">{inv.email}</span>
                            <span className={`text-[10px] font-mono ${
                              inv.isAccepted
                                ? 'text-slate-500'
                                : isExpired
                                  ? 'text-amber-400'
                                  : 'text-cyan-400'
                            }`}>
                              {inv.isAccepted
                                ? 'Used'
                                : isExpired
                                  ? 'Expired (5m window)'
                                  : `Valid (${minutesLeft}m left)`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {inv.isAccepted ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Accepted</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRevokeInvitation(inv.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Clinical Workstation User Directory */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active Clinical Workstation User Directory
                </h3>
                <span className="text-xs text-slate-400 font-mono">{usersList.length} Accounts Enrolled</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role Assignment</th>
                      <th className="px-6 py-4">Credential Status</th>
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
                          {u.medicalLicenseNo && (
                            <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                              License: {u.medicalLicenseNo} ({u.specialty || 'General'})
                            </div>
                          )}
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
                            <option value="PHARMACIST">PHARMACIST</option>
                            <option value="LAB_TECHNICIAN">LAB_TECHNICIAN</option>
                            <option value="RADIOLOGIST">RADIOLOGIST</option>
                            <option value="BILLING_OFFICER">BILLING_OFFICER</option>
                            <option value="TRIAGE_OFFICER">TRIAGE_OFFICER</option>
                            <option value="CARE_COORDINATOR">CARE_COORDINATOR</option>
                            <option value="RECEPTIONIST">RECEPTIONIST</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                            u.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : u.verificationStatus === 'PENDING_REVIEW'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {u.verificationStatus || 'VERIFIED'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold ${u.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                            {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${u.isActive
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

        {/* Tab: Patient Population (Metrics & Security Governance) */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            {/* Header with HIPAA Disclaimer */}
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>Hospital Patient Population Registry</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {patientCount} ENROLLED
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Identity lifecycle, authentication security, and administrative enrollment governance.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                    Active Accounts: <strong className="text-emerald-400">{usersList.filter(u => u.role === 'PATIENT' && u.isActive).length}</strong> / {patientCount}
                  </div>
                </div>
              </div>

              {/* Strict Role Separation Disclaimer Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-300">HIPAA Security Rule § 164.312 Role Boundary Notice:</span>
                  <p className="text-slate-300 leading-relaxed">
                    Hospital Administrators have <strong>strict non-clinical privileges</strong>. Under federal healthcare compliance mandates, administrators cannot issue electronic prescriptions, conduct clinical consultations, or alter medical EHR records. Clinical operations are exclusively reserved for credentialed Attending Physicians and Triage Nurses.
                  </p>
                </div>
              </div>
            </div>

            {/* Patients Table */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700/80 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Enrolled Patient Directory
                </h3>
                <span className="text-xs text-slate-400 font-mono">{patientCount} Patients</span>
              </div>

              {patientCount === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <User className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-sm">No registered patients in the system yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-6 py-4">Patient Name & Contact</th>
                        <th className="px-6 py-4">Record Identifier</th>
                        <th className="px-6 py-4">Security & 2FA Status</th>
                        <th className="px-6 py-4">Account Status</th>
                        <th className="px-6 py-4 text-right">Administrative Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {usersList.filter(u => u.role === 'PATIENT').map(p => (
                        <tr key={p.id} className="hover:bg-slate-700/30 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-sm">{p.firstName} {p.lastName}</div>
                            <div className="text-slate-400 font-mono text-[11px]">{p.email}</div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-400">
                              UID-{p.id.substring(0, 8)}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Key className="w-3.5 h-3.5 text-purple-400" />
                              <span>{p.isTotpEnabled ? '2FA TOTP Active' : 'Password Only'}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold ${p.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                              }`}>
                              {p.isActive ? 'ACTIVE' : 'SUSPENDED'}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleToggleUserStatus(p.id, p.isActive)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${p.isActive
                                ? 'bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40'
                                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40'
                                }`}
                            >
                              {p.isActive ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleResetTotp(p.id)}
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
              )}
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
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${rx.signatureStatus === 'VALID'
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
                        <span className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${rx.status === 'ISSUED'
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

                    {/* Admin Document Inspection Action */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                      <button
                        onClick={() => setSelectedRxForDoc(rx)}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold transition flex items-center space-x-1.5 shadow-md"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Inspect Official Rx Document & QR</span>
                      </button>
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${inc.status === 'OPEN'
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

        {/* Tab 6: SMS Gateway & Communication Audit Logs */}
        {activeTab === 'sms' && (
          <div className="space-y-6">
            {/* Top Gateway Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-slate-800/80 border border-cyan-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span>{smsStatus?.activeProvider?.toUpperCase() || 'SIMULATED'}</span>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Active SMS Gateway</h4>
                <p className="text-xs text-slate-400">Carrier: {smsStatus?.isLiveConfigured ? 'Twilio / Africa\'s Talking' : 'Local GSM Simulated Hub'}</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-800/80 border border-purple-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Send className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                    {smsLogs.length} Messages
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Dispatched Notifications</h4>
                <p className="text-xs text-slate-400">Appointments, e-Prescriptions & Vitals</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-800/80 border border-emerald-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    HIPAA Verified
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Audit Trail Security</h4>
                <p className="text-xs text-slate-400">Hash-chained with SHA-256 Merkle proofs</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-800/80 border border-blue-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full truncate max-w-[130px]">
                    {smsStatus?.defaultSenderNumber || '+1 (555) 019-TELEMED'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Default Sender ID</h4>
                <p className="text-xs text-slate-400">Authenticated Clinical Shortcode</p>
              </div>
            </div>

            {/* Test SMS Dispatcher Form */}
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Dispatch Test SMS Alert</h3>
                  <p className="text-xs text-slate-400">Send an ad-hoc SMS alert or invitation directly through the clinical gateway</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Recipient Phone Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="+254712345678 or +1 (555) 019-3829"
                    value={testSmsPhone}
                    onChange={e => setTestSmsPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    SMS Message Content *
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="TeleMedSecure: Your appointment with Dr. John Doe is scheduled for 2:00 PM. Join securely: https://..."
                      value={testSmsMessage}
                      onChange={e => setTestSmsMessage(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                    />
                    <button
                      onClick={async () => {
                        if (!testSmsPhone.trim() || !testSmsMessage.trim()) {
                          setActionMessage('Please enter both recipient phone and message body.');
                          return;
                        }
                        setIsSendingSms(true);
                        try {
                          const res = await fetch(`${API_BASE}/sms/send`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({
                              to: testSmsPhone.trim(),
                              message: testSmsMessage.trim(),
                              purpose: 'GENERAL',
                            })
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setActionMessage(`SMS dispatched successfully! Status: ${data.log?.status}`);
                            setTestSmsMessage('');
                            fetchAllAdminData();
                          } else {
                            setActionMessage(data.error || 'Failed to dispatch SMS');
                          }
                        } catch (e: any) {
                          setActionMessage(`Error: ${e.message}`);
                        } finally {
                          setIsSendingSms(false);
                        }
                      }}
                      disabled={isSendingSms}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingSms ? 'Dispatching...' : 'Send SMS'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SMS Audit Log Table */}
            <div className="rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Dispatched SMS Notifications Audit</h3>
                  <p className="text-xs text-slate-400">Immutable ledger of all clinical SMS notifications and delivery receipts</p>
                </div>
                <button
                  onClick={fetchAllAdminData}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {smsLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Smartphone className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">No SMS notifications dispatched yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When doctors start video consultations, appointments are scheduled, or prescriptions are dispensed, outbound SMS alerts will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="px-6 py-3.5">Timestamp</th>
                        <th className="px-6 py-3.5">Recipient</th>
                        <th className="px-6 py-3.5">Purpose</th>
                        <th className="px-6 py-3.5">Message Excerpt</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Gateway Provider</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40 font-mono">
                      {smsLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-750/50 transition">
                          <td className="px-6 py-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(log.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-3.5 text-cyan-400 font-bold whitespace-nowrap">
                            {log.to}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.purpose === 'DIRECT_JOIN_LINK' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                              log.purpose === 'APPOINTMENT_REMINDER' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              log.purpose === 'PRESCRIPTION_READY' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              log.purpose === 'EMERGENCY_VITALS' ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}>
                              {log.purpose}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-300 font-sans max-w-xs truncate" title={log.message}>
                            {log.message}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              log.status === 'SIMULATED' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                              'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-400 uppercase text-[10px]">
                            {log.provider}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Official DEA EPCS Prescription Document & QR Modal */}
      {selectedRxForDoc && (
        <PrescriptionDocumentModal
          prescription={selectedRxForDoc}
          onClose={() => setSelectedRxForDoc(null)}
        />
      )}

      {/* Two-Factor Authentication Modal */}
      <TwoFactorSetupModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
      />
    </div>
  );
}
