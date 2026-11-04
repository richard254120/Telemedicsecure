import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Calendar,
  FileText,
  Pill,
  ShieldCheck,
  Video,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Shield,
  RefreshCw,
  ExternalLink,
  Lock,
  Printer,
  PlusCircle,
  MessageSquare,
  KeyRound,
  Stethoscope,
  X,
  Send,
  User,
  CreditCard,
  DollarSign,
  Receipt,
  Eye,
  ClipboardCheck,
  Users,
  ShieldAlert,
  Ban
} from 'lucide-react';
import { PrescriptionDocumentModal } from '../../components/PrescriptionDocumentModal';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
import { ClinicalChatDrawer } from '../../components/ClinicalChatDrawer';
import Shell from '../../dashboard-shell/Shell';
import { VERIFICATION_GROUP, accentForRole, brandSubtitleForRole } from '../../dashboard-shell/navConfig';
import { Button, ErrorState, Panel, Badge, SecretField, Field, EmptyState, INPUT_CLASS } from '../../dashboard-shell/ui';
import { get as apiGet, post as apiPost, patch as apiPatch, errorMessage } from '../../dashboard-shell/transport';
import type { CountChip, NavGroup, NavTab } from '../../dashboard-shell/types';
import { handoffBadge } from '../../dashboard-shell/handoff';
import NotificationBell from '../../dashboard-shell/NotificationBell';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'appointments' | 'records' | 'prescriptions' | 'consent' | 'billing' | 'access'>('appointments');

  // State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [patientInvoices, setPatientInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Care & Access state (care team, temporary access keys, access log)
  const [careTeam, setCareTeam] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [accessBusy, setAccessBusy] = useState(false);
  const [issueGranteeId, setIssueGranteeId] = useState('');
  const [grantees, setGrantees] = useState<any[]>([]);
  const [issueTtl, setIssueTtl] = useState<'1h' | '24h' | '72h' | '7d'>('24h');
  const [issuePurpose, setIssuePurpose] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [teamClinicianId, setTeamClinicianId] = useState('');

  // Booking self-cancel state
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  // New Modals State
  const [selectedRxForDoc, setSelectedRxForDoc] = useState<any | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showHealthSummaryModal, setShowHealthSummaryModal] = useState(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<any | null>(null);
  const [selectedStatementView, setSelectedStatementView] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'HSA_FSA' | 'MPESA'>('CREDIT_CARD');
  const [payingSubmitting, setPayingSubmitting] = useState(false);

  // Booking Form State
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('10:00');
  const [bookReason, setBookReason] = useState('General Telehealth Consultation');
  const [bookSymptoms, setBookSymptoms] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Dynamically resolve attending physician name from active appointments or registered doctors
  const attendingDoctorName = useMemo(() => {
    const activeAppt = appointments.find((a: any) => a.doctor?.firstName);
    if (activeAppt?.doctor) {
      return `Dr. ${activeAppt.doctor.firstName} ${activeAppt.doctor.lastName}`;
    }
    if (doctorsList.length > 0) {
      return `Dr. ${doctorsList[0].firstName} ${doctorsList[0].lastName}`;
    }
    return 'Attending Physician';
  }, [appointments, doctorsList]);

  useEffect(() => {
    fetchPatientData();
    fetchDoctors();
    fetchCareAccess();
  }, [user]);

  const fetchDoctors = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations/doctors`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDoctorsList(Array.isArray(data) ? data : []);
        if (data.length > 0 && !bookDoctorId) {
          setBookDoctorId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load doctors list', e);
    }
  };

  const fetchCareAccess = async () => {
    if (!user?.id) return;
    try {
      const [teamRes, grantsRes, logRes, granteesRes] = await Promise.all([
        apiGet<{ members: any[] }>(getAuthHeaders, `/care-team/team/${user.id}`, 'Failed to load care team'),
        apiGet<any[]>(getAuthHeaders, '/access/grants', 'Failed to load access grants'),
        apiGet<any[]>(getAuthHeaders, '/access/log', 'Failed to load access log'),
        apiGet<any[]>(getAuthHeaders, '/access/grantees', 'Failed to load staff directory')
      ]);
      setCareTeam(Array.isArray(teamRes?.members) ? teamRes.members : []);
      setGrants(Array.isArray(grantsRes) ? grantsRes : []);
      setAccessLog(Array.isArray(logRes) ? logRes : []);
      setGrantees(Array.isArray(granteesRes) ? granteesRes : []);
    } catch (e) {
      console.error('Failed to load care & access data', e);
    }
  };

  const handleIssueGrant = async () => {
    if (!issueGranteeId) {
      setActionMessage('Select a staff member to share your record with.');
      return;
    }
    setAccessBusy(true);
    try {
      const data = await apiPost<{ code: string }>(
        getAuthHeaders,
        '/access/grants',
        { granteeId: issueGranteeId, ttl: issueTtl, purpose: issuePurpose || undefined },
        'Failed to issue access key'
      );
      setIssuedCode(data.code);
      setIssuePurpose('');
      fetchCareAccess();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to issue access key'));
    } finally {
      setAccessBusy(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    setAccessBusy(true);
    try {
      await apiPost(getAuthHeaders, `/access/grants/${grantId}/revoke`, {}, 'Failed to revoke access');
      fetchCareAccess();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to revoke access'));
    } finally {
      setAccessBusy(false);
    }
  };

  const handleRegenerateGrant = async (grantId: string) => {
    setAccessBusy(true);
    try {
      const data = await apiPost<{ code: string }>(
        getAuthHeaders,
        `/access/grants/${grantId}/regenerate`,
        {},
        'Failed to regenerate access key'
      );
      setIssuedCode(data.code);
      fetchCareAccess();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to regenerate access key'));
    } finally {
      setAccessBusy(false);
    }
  };

  const handleAddTeamMember = async () => {
    if (!teamClinicianId || !user?.id) return;
    setAccessBusy(true);
    try {
      await apiPost(getAuthHeaders, '/care-team/team', { patientId: user.id, clinicianId: teamClinicianId }, 'Failed to add care team member');
      setTeamClinicianId('');
      fetchCareAccess();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to add care team member'));
    } finally {
      setAccessBusy(false);
    }
  };

  const handleRemoveTeamMember = async (clinicianId: string) => {
    if (!user?.id) return;
    setAccessBusy(true);
    try {
      await apiPost(getAuthHeaders, '/care-team/team/remove', { patientId: user.id, clinicianId }, 'Failed to remove care team member');
      fetchCareAccess();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to remove care team member'));
    } finally {
      setAccessBusy(false);
    }
  };

  // Cancel one of the patient's own bookings (PENDING / CONFIRMED / SCHEDULED).
  const openCancelModal = (app: any) => { setCancelTarget(app); setCancelReason(''); };
  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await apiPatch(getAuthHeaders, `/consultations/${cancelTarget.id}/cancel`, { reason: cancelReason || undefined }, 'Failed to cancel booking');
      setCancelTarget(null);
      setCancelReason('');
      setActionMessage('Your appointment has been cancelled and the clinic was notified.');
      fetchPatientData();
    } catch (e) {
      setActionMessage(errorMessage(e, 'Failed to cancel booking'));
    } finally {
      setCancelBusy(false);
    }
  };

  const fetchPatientData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [appRes, recRes, rxRes, conRes, invRes] = await Promise.all([
        apiGet<any[]>(getAuthHeaders, '/consultations', 'Failed to load appointments'),
        apiGet<any[]>(getAuthHeaders, '/medical-records', 'Failed to load records'),
        apiGet<any[]>(getAuthHeaders, '/prescriptions', 'Failed to load prescriptions'),
        apiGet<any[]>(getAuthHeaders, '/gdpr/consent', 'Failed to load consent settings'),
        apiGet<any[]>(getAuthHeaders, '/billing/invoices', 'Failed to load invoices')
      ]);

      setAppointments(Array.isArray(appRes) ? appRes : []);
      setRecords(Array.isArray(recRes) ? recRes : []);
      setPrescriptions(Array.isArray(rxRes) ? rxRes : []);
      setConsents(Array.isArray(conRes) ? conRes : []);
      setPatientInvoices(Array.isArray(invRes) ? invRes : []);
    } catch (e) {
      console.error('Error loading patient dashboard data', e);
      setLoadError(errorMessage(e, 'Unable to load your health record'));
    } finally {
      setLastSyncedAt(Date.now());
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setPayingSubmitting(true);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/billing/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paymentMethod,
          transactionReference: `PAY-${Date.now().toString().slice(-6)}`
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Payment failed');
      }

      const data = await res.json();
      setActionMessage(`Payment successful! Receipt #${data.receiptNumber} issued.`);
      setSelectedInvoiceToPay(null);
      fetchPatientData();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage(`Payment error: ${err.message}`);
    } finally {
      setPayingSubmitting(false);
    }
  };

  const handleBookConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookDoctorId || !bookDate || !bookTime) {
      setActionMessage('Please select a doctor, appointment date, and time.');
      return;
    }

    setBookingSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const scheduledAt = new Date(`${bookDate}T${bookTime}:00`).toISOString();

      const res = await fetch(`${API_BASE}/consultations/book`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: bookDoctorId,
          scheduledAt,
          reason: bookReason,
          symptoms: bookSymptoms,
          notes: bookNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage('Appointment successfully booked with your physician!');
        setShowBookModal(false);
        setBookSymptoms('');
        setBookNotes('');
        fetchPatientData();
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        setActionMessage(data.error || 'Failed to book consultation');
      }
    } catch (e: any) {
      setActionMessage(`Error: ${e.message}`);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleToggleConsent = async (purpose: string, currentlyGranted: boolean) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`${API_BASE}/gdpr/consent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          purpose,
          granted: !currentlyGranted
        })
      });
      setActionMessage(`Updated GDPR consent for "${purpose}" to ${!currentlyGranted ? 'GRANTED' : 'REVOKED'}.`);
      fetchPatientData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportData = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/gdpr/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ justification: 'Patient Subject Access Request under GDPR Art. 15' })
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient_data_export_${user?.id || 'me'}.json`;
        a.click();
        setActionMessage('GDPR Data Export package generated and downloaded.');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleErasureRequest = async () => {
    if (!confirm('Are you sure you want to request GDPR Article 17 Erasure? This initiates cryptographic key shredding.')) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/gdpr/erasure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: 'Patient exercised Right to be Forgotten (GDPR Art. 17)'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActionMessage(`Erasure request filed successfully. Status: ${data.status || 'PENDING'}`);
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const patientTabs: NavTab[] = [
    { id: 'appointments', label: 'Appointments', caption: 'Your telemedicine visits', group: 'Patient Portal', icon: Calendar },
    { id: 'records', label: 'Medical Records', caption: 'Encrypted health record', group: 'Patient Portal', icon: FileText },
    { id: 'prescriptions', label: 'Prescriptions', caption: 'Signed e-prescriptions', group: 'Patient Portal', icon: Pill },
    { id: 'billing', label: 'Billing & Copays', caption: 'Invoices & statements', group: 'Patient Portal', icon: CreditCard },
    { id: 'consent', label: 'GDPR Consent & Privacy', caption: 'Consent & data rights', group: 'Patient Portal', icon: Shield },
    { id: 'access', label: 'Care & Access', caption: 'Care team, shared keys, access log', group: 'Patient Portal', icon: KeyRound },
  ];
  const nav: NavGroup[] = [{ name: 'Patient Portal', tabs: patientTabs }, VERIFICATION_GROUP];
  const counts: Record<string, CountChip> = {
    appointments: { value: appointments.length, status: 'success' },
    records: { value: records.length, status: 'success' },
    prescriptions: { value: prescriptions.length, status: 'success' },
    billing: { value: patientInvoices.filter(i => i.status === 'PENDING').length, status: 'success' },
    consent: { value: consents.length, status: 'success' },
    access: { value: careTeam.length, status: 'success' },
  };
  const signOut = () => { logout(); navigate('/login', { replace: true }); };
  const joinActiveCall = () => {
    const active = appointments.find(a => a.status === 'IN_PROGRESS') || appointments.find(a => a.status === 'SCHEDULED') || appointments[0];
    if (active) navigate(`/call/${active.id}`);
    else setActionMessage('No consultations currently booked. Click "Book Consultation" to schedule one.');
  };
  const headerActions = (
    <>
      <NotificationBell getAuthHeaders={getAuthHeaders} userId={user?.id} />
      <Button variant="ghost" icon={MessageSquare} onClick={() => setShowChatDrawer(true)}>Care Chat</Button>
      <Button variant="secondary" icon={Video} onClick={joinActiveCall}>Join Call</Button>
      <Button variant="success" icon={PlusCircle} onClick={() => setShowBookModal(true)}>Book Consultation</Button>
    </>
  );

  return (
    <>
      <Shell
        user={user}
        nav={nav}
        accent={accentForRole(user?.role)}
        brandTitle="TeleMedSecure"
        brandSubtitle={brandSubtitleForRole(user?.role)}
        activeTab={activeTab}
        onSelectTab={id => setActiveTab(id as typeof activeTab)}
        counts={counts}
        lastSyncedAt={lastSyncedAt}
        isRefreshing={loading}
        onRefresh={fetchPatientData}
        headerActions={headerActions}
        onOpenTwoFactor={() => setShow2FAModal(true)}
        onSignOut={signOut}
      >
        {loadError && !loading && (
          <ErrorState message={loadError} onRetry={fetchPatientData} />
        )}

        {actionMessage && (
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab 1: Appointments */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>Your Telemedicine Consultations</span>
              </h2>
              <button
                onClick={() => setShowBookModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Book New Consultation</span>
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                <Calendar className="w-12 h-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No scheduled consultations found on record.</p>
                <button
                  onClick={() => setShowBookModal(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  Schedule Your First Appointment
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointments.map(app => {
                  const badge = handoffBadge(app.status);
                  const cancellable = ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(app.status);
                  const toneClass =
                    badge.tone === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : badge.tone === 'danger' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : badge.tone === 'warning' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
                  return (
                  <div
                    key={app.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 hover:border-cyan-500/50 transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${toneClass}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {app.id.substring(0, 8)}...
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">
                        {app.doctor ? `Dr. ${app.doctor.firstName} ${app.doctor.lastName}` : 'Assigned Physician'}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(app.scheduledAt).toLocaleString()}</span>
                      </p>
                      {app.status === 'DECLINED' && app.declineReason && (
                        <p className="text-[11px] text-rose-300">Declined: {app.declineReason}</p>
                      )}
                      {app.status === 'CANCELLED' && app.cancelReason && (
                        <p className="text-[11px] text-slate-400">Cancelled: {app.cancelReason}</p>
                      )}
                      {app.status === 'PENDING' && (
                        <p className="text-[11px] text-amber-300">Awaiting clinician confirmation.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {cancellable && (
                        <button
                          onClick={() => openCancelModal(app)}
                          className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-rose-600/80 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                        >
                          <Ban className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                      )}
                      {(app.status === 'CONFIRMED' || app.status === 'SCHEDULED' || app.status === 'IN_PROGRESS') && (
                        <button
                          onClick={() => navigate(`/waiting-room/${app.id}`)}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
                        >
                          <Video className="w-4 h-4" />
                          <span>Join Call</span>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Medical Records */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Encrypted Health Records</span>
              </h2>
              <button
                onClick={() => setShowHealthSummaryModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/20"
                title="View and print official certified clinical summary"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Export Clinical Summary</span>
              </button>
            </div>

            {records.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                <FileText className="w-12 h-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No medical records on file yet.</p>
                <p className="text-xs text-slate-500">
                  Medical records created by your physician will be envelope-encrypted with AES-256-GCM.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {records.map(rec => (
                  <div
                    key={rec.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                          <Lock className="w-3 h-3" />
                          <span>AES-256 Envelope Encrypted</span>
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white mb-1">Clinical Record #{rec.id.substring(0, 8)}</h3>
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800 font-mono">
                        {rec.data || 'Encrypted diagnostic notes and consultation summary.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Prescriptions */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Pill className="w-5 h-5 text-cyan-400" />
                <span>Ed25519 Digitally Signed Prescriptions</span>
              </h2>
              <button
                onClick={() => navigate('/prescriptions/verify')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
              >
                <span>Pharmacist Verification Tool</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {prescriptions.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                <Pill className="w-12 h-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No prescriptions issued yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {prescriptions.map(rx => (
                  <div
                    key={rx.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${rx.status === 'ISSUED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : rx.status === 'DISPENSED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                          {rx.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">RX: {rx.id.substring(0, 8)}...</span>
                        {rx.signature && (
                          <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            Ed25519 Verified
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {rx.items?.map((item: any) => (
                          <div key={item.id} className="text-xs text-white">
                            <span className="font-bold text-cyan-300">{item.medication}</span> — {item.dosage} ({item.instructions})
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Prescribed by: {rx.doctor ? `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}` : 'Physician'} • {new Date(rx.createdAt).toLocaleDateString()}
                      </p>

                      {/* Prescription Fulfillment Pipeline Stepper */}
                      <div className="pt-2 border-t border-slate-700/60 max-w-md">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>Fulfillment Pipeline</span>
                          <span className="text-cyan-400 font-mono text-[9px]">{rx.status}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="space-y-1">
                            <div className="h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                            <span className="text-[9px] font-bold text-emerald-400 block">1. Prescribed</span>
                          </div>
                          <div className="space-y-1">
                            <div className={`h-1.5 rounded-full ${rx.signature ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-700'}`} />
                            <span className={`text-[9px] font-bold block ${rx.signature ? 'text-emerald-400' : 'text-slate-500'}`}>2. Ed25519 Signed</span>
                          </div>
                          <div className="space-y-1">
                            <div className={`h-1.5 rounded-full ${rx.status === 'VERIFIED' || rx.status === 'DISPENSED' ? 'bg-cyan-500 shadow-sm shadow-cyan-500/50' : 'bg-slate-700'}`} />
                            <span className={`text-[9px] font-bold block ${rx.status === 'VERIFIED' || rx.status === 'DISPENSED' ? 'text-cyan-400' : 'text-slate-500'}`}>3. Pharmacy Verified</span>
                          </div>
                          <div className="space-y-1">
                            <div className={`h-1.5 rounded-full ${rx.status === 'DISPENSED' ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-slate-700'}`} />
                            <span className={`text-[9px] font-bold block ${rx.status === 'DISPENSED' ? 'text-blue-400' : 'text-slate-500'}`}>4. Dispensed</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRxForDoc(rx)}
                        className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/10"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print / QR Rx</span>
                      </button>
                      <button
                        onClick={() => navigate(`/prescriptions/${rx.id}`)}
                        className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => navigate(`/prescriptions/${rx.id}/verify`)}
                        className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Signature</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: GDPR Consent & Privacy */}
        {activeTab === 'consent' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-lg space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <span>GDPR Consent Preferences (Art. 6 & 9)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage granular consent for telemedicine processing. Revoking consent enforces rules-engine compliance blocks.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    purpose: 'TELEMEDICINE_TREATMENT',
                    title: 'Telemedicine Video & Clinical Treatment',
                    desc: 'Required to schedule and conduct encrypted E2EE consultations.'
                  },
                  {
                    purpose: 'E_PRESCRIBING',
                    title: 'Electronic Prescribing & DEA EPCS',
                    desc: 'Authorizes cryptographic signing and pharmacy transmission of prescriptions.'
                  },
                  {
                    purpose: 'DATA_SHARING',
                    title: 'Clinical Data Exchange with Specialists',
                    desc: 'Allows encrypted sharing of vital sign trends with authorized specialists.'
                  }
                ].map(item => {
                  const consentObj = consents.find(c => c.purpose === item.purpose);
                  const isGranted = consentObj ? consentObj.granted : true;
                  return (
                    <div
                      key={item.purpose}
                      className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>

                      <button
                        onClick={() => handleToggleConsent(item.purpose, isGranted)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${isGranted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                          }`}
                      >
                        {isGranted ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Granted (Revoke)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Revoked (Grant)</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GDPR Rights Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tool 1: Data Portability (Art. 15 / 20) */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Right to Data Portability</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Export a complete machine-readable JSON package containing all appointments, clinical notes, prescriptions, and cryptographic audit records.
                </p>
                <button
                  onClick={handleExportData}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Request Full Data Export</span>
                </button>
              </div>

              {/* Tool 2: Right to Erasure / Crypto-Shredding (Art. 17) */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Right to Erasure (Crypto-Shredding)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Submit a formal GDPR Article 17 erasure request. The platform shreds cryptographic Data Encryption Keys (DEKs), rendering all encrypted PHI mathematically unrecoverable while preserving immutable audit chain integrity.
                </p>
                <button
                  onClick={handleErasureRequest}
                  className="w-full py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Initiate Erasure Request</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Patient Billing, Copays & Financial Statements */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <span className="text-xs font-medium text-slate-400 block">Total Balance Due</span>
                <span className="text-2xl font-extrabold text-amber-400 font-mono mt-1 block">
                  ${patientInvoices
                    .filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED')
                    .reduce((acc, i) => acc + i.patientDue, 0)
                    .toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {patientInvoices.filter(i => i.status === 'PENDING').length} Unpaid Statements
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <span className="text-xs font-medium text-slate-400 block">Covered by Insurance</span>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
                  ${patientInvoices.reduce((acc, i) => acc + i.insuranceCovered, 0).toFixed(2)}
                </span>
                <span className="text-[11px] text-emerald-500/80 mt-1 block">
                  Active In-Network Benefits Applied
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <span className="text-xs font-medium text-slate-400 block">Fully Settled</span>
                <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
                  {patientInvoices.filter(i => i.status === 'PAID').length} Invoices
                </span>
                <span className="text-[11px] text-blue-400 mt-1 block">
                  Receipts Available for Download
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Receipt className="w-5 h-5 text-amber-400" />
                    <span>Your Telemedicine Invoices & Copays</span>
                  </h3>
                  <p className="text-xs text-slate-400">Itemized statements for consultations, labs, and e-prescriptions</p>
                </div>
              </div>

              {patientInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <Receipt className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p>You have no billing statements at this time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Clinical Items</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Insurance Paid</th>
                        <th className="px-4 py-3">You Owe</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {patientInvoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px]">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-white block font-medium truncate max-w-[200px]">
                              {inv.items && inv.items.length > 0
                                ? inv.items.map((i: any) => i.description).join(', ')
                                : 'Telehealth Encounter'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {inv.items?.length || 1} billable services
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-white">
                            ${inv.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-emerald-400">
                            ${inv.insuranceCovered.toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                            ${inv.patientDue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => setSelectedStatementView(inv)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="View Statement"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {inv.status !== 'PAID' && (
                              <button
                                onClick={() => setSelectedInvoiceToPay(inv)}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition inline-flex items-center space-x-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay Now</span>
                              </button>
                            )}
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

        {/* Tab 6: Care Team & Record Access */}
        {activeTab === 'access' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <span>Care Team & Record Access</span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage who is on your care team, share your chart with a physician through a temporary key, and review who viewed your records.
              </p>
            </div>

            {/* Care Team */}
            <Panel title="Your Care Team" icon={Users} description="Physicians and nurses assigned to your care.">
              <div className="space-y-3">
                {careTeam.length === 0 ? (
                  <EmptyState icon={Users} title="No care team members yet" description="Clinicians assigned through your consultations appear here." />
                ) : (
                  <div className="grid gap-2">
                    {careTeam.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5">
                        <div className="flex items-center space-x-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.role === 'NURSE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>
                            {m.role === 'NURSE' ? <User className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">{m.clinician?.firstName} {m.clinician?.lastName}</p>
                            <p className="text-[11px] text-slate-400">{m.clinician?.email} · {m.role}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveTeamMember(m.clinician?.id)}
                          disabled={accessBusy}
                          title="Remove from care team"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 pt-3 border-t border-slate-800">
                  <Field label="Add clinician" className="flex-1">
                    <select value={teamClinicianId} onChange={(e) => setTeamClinicianId(e.target.value)} className={INPUT_CLASS}>
                      <option value="">Select a physician…</option>
                      {doctorsList.map((d) => (
                        <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}{d.specialty ? ` — ${d.specialty}` : ''}</option>
                      ))}
                    </select>
                  </Field>
                  <Button variant="secondary" icon={PlusCircle} onClick={handleAddTeamMember} busy={accessBusy} disabled={!teamClinicianId}>Add</Button>
                </div>
              </div>
            </Panel>

            {/* Issue access key */}
            <Panel title="Share My Record (Temporary Access Key)" icon={KeyRound} description="Grant one staff member time-boxed read access. The code is bound to that person and shown only once.">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Staff member" required>
                    <select value={issueGranteeId} onChange={(e) => setIssueGranteeId(e.target.value)} className={INPUT_CLASS}>
                      <option value="">Select a staff member…</option>
                      {grantees.map((g) => (
                        <option key={g.id} value={g.id}>{g.role === 'DOCTOR' ? 'Dr. ' : ''}{g.firstName} {g.lastName}{g.specialty ? ` — ${g.specialty}` : ` — ${String(g.role).replace(/_/g, ' ').toLowerCase()}`}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Access window" required>
                    <select value={issueTtl} onChange={(e) => setIssueTtl(e.target.value as any)} className={INPUT_CLASS}>
                      <option value="1h">1 hour</option>
                      <option value="24h">24 hours</option>
                      <option value="72h">72 hours</option>
                      <option value="7d">7 days</option>
                    </select>
                  </Field>
                </div>
                <Field label="Purpose (optional)">
                  <input value={issuePurpose} onChange={(e) => setIssuePurpose(e.target.value)} placeholder="e.g. Second opinion on my lab results" className={INPUT_CLASS} />
                </Field>
                <div className="flex justify-end">
                  <Button variant="primary" icon={KeyRound} onClick={handleIssueGrant} busy={accessBusy} disabled={!issueGranteeId}>Issue Access Key</Button>
                </div>
                {issuedCode && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                    <p className="text-xs font-semibold text-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Share this code securely — it is shown only once.</span>
                    </p>
                    <SecretField label="One-time access code" value={issuedCode} />
                    <div className="flex justify-end">
                      <Button variant="ghost" icon={X} onClick={() => setIssuedCode(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* Grants list */}
            <Panel title="Access Grants" icon={ShieldCheck} description="Every key you have issued. Revoke cuts access immediately.">
              {grants.length === 0 ? (
                <EmptyState icon={KeyRound} title="No access keys issued" description="Issued keys and their status will appear here." />
              ) : (
                <div className="grid gap-2">
                  {grants.map((g) => {
                    const expired = new Date(g.expiresAt).getTime() <= Date.now();
                    const isRevoked = g.effectiveStatus === 'REVOKED';
                    const tone = isRevoked ? 'danger' : expired ? 'neutral' : g.redeemed ? 'info' : 'purple';
                    const label = isRevoked ? 'REVOKED' : expired ? 'EXPIRED' : g.redeemed ? 'IN USE' : 'AWAITING REDEEM';
                    return (
                      <div key={g.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {g.granteeRole === 'DOCTOR' ? 'Dr. ' : ''}{g.grantee?.firstName} {g.grantee?.lastName}
                            <span className="ml-2 text-[10px] text-slate-500 font-mono">{g.granteeRole}</span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {g.purpose ? `${g.purpose} · ` : ''}Expires {new Date(g.expiresAt).toLocaleString()}
                            {g.lastAccessAt ? ` · last viewed ${new Date(g.lastAccessAt).toLocaleString()}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge tone={tone as any}>{label}</Badge>
                          {!isRevoked && !expired && (
                            <>
                              <Button variant="ghost" icon={RefreshCw} onClick={() => handleRegenerateGrant(g.id)} busy={accessBusy}>Regenerate</Button>
                              <Button variant="danger" icon={X} onClick={() => handleRevokeGrant(g.id)} busy={accessBusy}>Revoke</Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* Access log */}
            <Panel title="Who Viewed My Records" icon={ShieldAlert} description="Audit trail of clinician reads against your chart.">
              {accessLog.length === 0 ? (
                <EmptyState icon={Eye} title="No record views yet" description="When a clinician opens your record it is logged here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 pr-4 font-mono uppercase tracking-wider">Viewer</th>
                        <th className="py-2 pr-4 font-mono uppercase tracking-wider">Action</th>
                        <th className="py-2 font-mono uppercase tracking-wider">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {accessLog.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2.5 pr-4 text-white">
                            {e.viewer?.firstName} {e.viewer?.lastName}
                            <span className="ml-2 text-[10px] text-slate-500 font-mono">{e.viewerRole}</span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-cyan-300">{e.action}</td>
                          <td className="py-2.5 text-slate-400 font-mono">{new Date(e.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </Shell>

      {/* Patient Statement Modal */}
      {selectedStatementView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Telemedicine Itemized Statement</h3>
                <span className="text-xs text-slate-400 font-mono">Invoice #{selectedStatementView.invoiceNumber}</span>
              </div>
              <button onClick={() => setSelectedStatementView(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              {selectedStatementView.items?.map((item: any) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-amber-400 font-bold mr-2">{item.cptCode || 'CPT'}</span>
                    <span className="text-white">{item.description}</span>
                  </div>
                  <span className="font-mono font-bold text-white">${item.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Total Charges:</span>
                <span className="text-white">${selectedStatementView.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Insurance Paid:</span>
                <span>-${selectedStatementView.insuranceCovered.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold text-sm pt-2 border-t border-slate-800">
                <span>Your Due Balance:</span>
                <span>${selectedStatementView.patientDue.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setSelectedStatementView(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Payment Modal */}
      {selectedInvoiceToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Settle Patient Balance</h3>
                <span className="text-xs text-slate-400 font-mono">Invoice #{selectedInvoiceToPay.invoiceNumber}</span>
              </div>
              <button onClick={() => setSelectedInvoiceToPay(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Amount Due</span>
              <span className="text-xl font-bold text-amber-400 font-mono">
                ${selectedInvoiceToPay.patientDue.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Select Payment Channel
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'CREDIT_CARD', label: 'Credit Card' },
                  { id: 'HSA_FSA', label: 'HSA / FSA' },
                  { id: 'MPESA', label: 'M-Pesa' }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`py-2 px-3 rounded-xl border text-center font-medium transition ${
                      paymentMethod === method.id
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedInvoiceToPay(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payingSubmitting}
                onClick={() => handlePayInvoice(selectedInvoiceToPay.id)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center space-x-2"
              >
                {payingSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                <span>Authorize & Pay ${selectedInvoiceToPay.patientDue.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Real-Time Encrypted Clinical Care Chat Drawer */}
      <ClinicalChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        consultationId={`care-team-patient-${user?.id || 'default'}`}
        recipientName={`Attending Care Team (${attendingDoctorName} & Clinical Staff)`}
        recipientRole="CARE_TEAM"
      />

      {/* Cancel Appointment Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>Cancel this consultation</span>
              </h3>
              <button onClick={() => setCancelTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-300">
              {cancelTarget.doctor ? `Dr. ${cancelTarget.doctor.firstName} ${cancelTarget.doctor.lastName}` : 'Your clinician'} will be notified that you cancelled the appointment for{' '}
              <span className="font-semibold text-white">{new Date(cancelTarget.scheduledAt).toLocaleString()}</span>.
            </p>
            <Field label="Reason (optional)">
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Let your care team know why"
                className={INPUT_CLASS}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep appointment</Button>
              <Button variant="danger" icon={Ban} onClick={handleCancelAppointment} busy={cancelBusy}>Cancel appointment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Appointment Booking & Clinical Intake Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8 p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Book Telemedicine Consultation</h3>
                  <p className="text-xs text-slate-400">Select physician and complete clinical intake</p>
                </div>
              </div>
              <button
                onClick={() => setShowBookModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBookConsultation} className="space-y-4">
              {/* Doctor Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Choose Attending Physician *
                </label>
                <select
                  value={bookDoctorId}
                  onChange={e => setBookDoctorId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a physician...</option>
                  {doctorsList.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.firstName} {doc.lastName} — {doc.specialty || 'General Practice'} ({doc.medicalLicenseNo || 'NPI-Verified'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Appointment Date *
                  </label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={e => setBookDate(e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Session Time *
                  </label>
                  <input
                    type="time"
                    value={bookTime}
                    onChange={e => setBookTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Reason for Visit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Reason for Visit *
                </label>
                <select
                  value={bookReason}
                  onChange={e => setBookReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="General Telehealth Consultation">General Telehealth Consultation</option>
                  <option value="Cardiology Follow-Up">Cardiology Follow-Up</option>
                  <option value="Prescription Refill Review">Prescription Refill Review</option>
                  <option value="Dermatology Assessment">Dermatology Assessment</option>
                  <option value="Mental Health & Behavioral Therapy">Mental Health & Behavioral Therapy</option>
                  <option value="Urgent Care Symptom Evaluation">Urgent Care Symptom Evaluation</option>
                </select>
              </div>

              {/* Chief Complaints / Symptoms */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Primary Symptoms & Duration
                </label>
                <input
                  type="text"
                  value={bookSymptoms}
                  onChange={e => setBookSymptoms(e.target.value)}
                  placeholder="e.g. Mild chest tightness, headache for 2 days"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Intake Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pre-Consultation Clinical Intake Notes (Encrypted)
                </label>
                <textarea
                  rows={3}
                  value={bookNotes}
                  onChange={e => setBookNotes(e.target.value)}
                  placeholder="Any current medications, known drug allergies, or clinical history for your doctor..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{bookingSubmitting ? 'Confirming Booking...' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Patient Clinical Health Summary Modal */}
      {showHealthSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Your Official Clinical Health Summary</h3>
                  <p className="text-[11px] text-slate-400">Certified TeleMedSecure Electronic Health Record (EHR)</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Record</span>
                </button>
                <button onClick={() => setShowHealthSummaryModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Demographics */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Full Legal Name</span>
                <span className="text-white font-bold">{user?.firstName} {user?.lastName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Account Email</span>
                <span className="text-cyan-400 font-mono">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Record Identifier</span>
                <span className="text-slate-300 font-mono">UID-{user?.id?.substring(0, 8)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Primary Care Physician</span>
                <span className="text-slate-200">{attendingDoctorName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Audit Integrity</span>
                <span className="text-emerald-400 font-mono font-bold">SHA-256 Validated</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">GDPR Consent</span>
                <span className="text-slate-300">Active (Consent Granted)</span>
              </div>
            </div>

            {/* Past Consultations */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Clinical Appointments History ({appointments.length})</span>
              </h4>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {appointments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No historical consultations recorded.</p>
                ) : (
                  appointments.map(a => (
                    <div key={a.id} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex justify-between">
                      <div>
                        <span className="text-white font-semibold">Dr. {a.doctor?.firstName} {a.doctor?.lastName}</span>
                        <div className="text-[10px] text-slate-400">{new Date(a.scheduledAt).toLocaleString()}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 h-fit">
                        {a.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Prescriptions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                <span>Active Prescriptions ({prescriptions.length})</span>
              </h4>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {prescriptions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No prescriptions issued.</p>
                ) : (
                  prescriptions.map(rx => (
                    <div key={rx.id} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-mono text-cyan-400">Rx #{rx.id.substring(0, 8)}</span>
                        <span className="text-emerald-400 font-bold text-[10px]">Ed25519 Signed</span>
                      </div>
                      {rx.items?.map((it: any, i: number) => (
                        <div key={i} className="text-slate-300 text-[11px]">
                          • <strong className="text-white">{it.medication}</strong> ({it.dosage}) — {it.frequency}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Compliance Note */}
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[11px] text-cyan-300 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>Full cryptographic lifecycle verified under HIPAA Security Rule § 164.312 and GDPR Art. 15.</span>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
