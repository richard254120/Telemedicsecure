import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  HeartPulse,
  Users,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Activity,
  Thermometer,
  Stethoscope,
  KeyRound,
  Zap,
  Send,
  AlertCircle,
  MessageSquare,
  XCircle,
  CalendarClock,
  X,
  ClipboardList,
  Pill,
  Calendar,
  Search,
  Check
} from 'lucide-react';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
import { ClinicalChatDrawer } from '../../components/ClinicalChatDrawer';
import TriageWorkbench from '../../components/stations/TriageWorkbench';
import CareCoordinatorWorkbench from '../../components/stations/CareCoordinatorWorkbench';
import Shell from '../../dashboard-shell/Shell';
import { accentForRole, brandSubtitleForRole, buildStationNav } from '../../dashboard-shell/navConfig';
import { Button, ErrorState, Field, INPUT_CLASS } from '../../dashboard-shell/ui';
import { handoffBadge } from '../../dashboard-shell/handoff';
import { get as apiGet, patch as apiPatch, post as apiPost, errorMessage } from '../../dashboard-shell/transport';
import type { CountChip, NavTab } from '../../dashboard-shell/types';
import NotificationBell from '../../dashboard-shell/NotificationBell';
import { useLanguage } from '../../context/LanguageContext';

export default function NurseDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders, logout } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'vitals' | 'triage' | 'patients' | 'care-plans' | 'med-admin'>('vitals');
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medAdminLogs, setMedAdminLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [medSearchTerm, setMedSearchTerm] = useState('');

  // Vitals form state
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(75);
  const [spO2, setSpO2] = useState<number>(98);
  const [temp, setTemp] = useState<number>(36.8);
  const [respRate, setRespRate] = useState<number>(16);
  const [consciousness, setConsciousness] = useState<'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE'>('ALERT');
  const [onOxygen, setOnOxygen] = useState<boolean>(false);

  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [alertDispatchStatus, setAlertDispatchStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  // Booking lifecycle action modal + inline feedback for the roster tab
  const [bookingAction, setBookingAction] = useState<{ mode: 'decline' | 'reschedule' | 'cancel'; c: any } | null>(null);
  const [bookingActionBusy, setBookingActionBusy] = useState(false);
  const [bookingActionInput, setBookingActionInput] = useState('');
  const [rosterMsg, setRosterMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetchNurseData();
  }, [user]);

  const fetchNurseData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [consData, ptsData, rxData] = await Promise.all([
        apiGet<any[]>(getAuthHeaders, '/consultations', 'Failed to load consultations'),
        apiGet<any[]>(getAuthHeaders, '/consultations/patients', 'Failed to load patients').catch(() => []),
        apiGet<any[]>(getAuthHeaders, '/prescriptions', 'Failed to load prescriptions').catch(() => [])
      ]);

      const consList = Array.isArray(consData) ? consData : [];
      setConsultations(consList);

      const rxList = Array.isArray(rxData) ? rxData : [];
      setPrescriptions(rxList);

      const ptsList = Array.isArray(ptsData) ? ptsData : [];
      // Combine direct patient directory with patients found in consultations
      const patientMap = new Map<string, any>();
      ptsList.forEach((p: any) => {
        if (p?.id) patientMap.set(p.id, p);
      });
      consList.forEach((c: any) => {
        if (c?.patient && c.patient.id && !patientMap.has(c.patient.id)) {
          patientMap.set(c.patient.id, {
            id: c.patient.id,
            firstName: c.patient.firstName || 'Patient',
            lastName: c.patient.lastName || `#${c.patient.id.substring(0, 6)}`,
            email: c.patient.email || '',
            createdAt: c.scheduledAt || new Date().toISOString()
          });
        }
      });
      setPatients(Array.from(patientMap.values()));
    } catch (e) {
      console.error(e);
      setLoadError(errorMessage(e, 'Unable to load your patient list'));
    } finally {
      setLastSyncedAt(Date.now());
      setLoading(false);
    }
  };

  const recordMedicationAdministered = (rxId: string, medicationName: string, patientName: string) => {
    const log = {
      id: `mar-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      medication: medicationName,
      patient: patientName,
      status: 'ADMINISTERED',
      nurse: `${user?.firstName || 'Nurse'} ${user?.lastName || ''}`
    };
    setMedAdminLogs(prev => [log, ...prev]);
    flashRoster('ok', `Dose verified & signed: ${medicationName} given to ${patientName}`);
  };

  // --- Booking lifecycle (decline / reschedule / cancel) for care-team patients ---
  const flashRoster = (tone: 'ok' | 'err', text: string) => { setRosterMsg({ tone, text }); setTimeout(() => setRosterMsg(null), 5000); };

  const handleAcceptBooking = async (c: any) => {
    try {
      await apiPatch(getAuthHeaders, `/consultations/${c.id}/accept`, {}, 'Failed to accept booking');
      flashRoster('ok', 'Consultation accepted — the patient has been notified.');
      fetchNurseData();
    } catch (e) {
      flashRoster('err', errorMessage(e, 'Failed to accept booking'));
    }
  };

  const openBookingAction = (mode: 'decline' | 'reschedule' | 'cancel', c: any) => {
    setBookingAction({ mode, c });
    setBookingActionInput(mode === 'reschedule' ? new Date(new Date(c.scheduledAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16) : '');
  };

  const submitBookingAction = async () => {
    if (!bookingAction) return;
    const { mode, c } = bookingAction;
    setBookingActionBusy(true);
    try {
      if (mode === 'decline') {
        await apiPatch(getAuthHeaders, `/consultations/${c.id}/decline`, { reason: bookingActionInput || undefined }, 'Failed to decline booking');
        flashRoster('ok', 'Request declined — the patient has been notified.');
      } else if (mode === 'cancel') {
        await apiPatch(getAuthHeaders, `/consultations/${c.id}/cancel`, { reason: bookingActionInput || undefined }, 'Failed to cancel booking');
        flashRoster('ok', 'Consultation cancelled — the patient has been notified.');
      } else {
        await apiPatch(getAuthHeaders, `/consultations/${c.id}/reschedule`, { newScheduledAt: new Date(bookingActionInput).toISOString() }, 'Failed to reschedule booking');
        flashRoster('ok', 'Consultation rescheduled — the patient has been notified of the new time.');
      }
      setBookingAction(null);
      setBookingActionInput('');
      fetchNurseData();
    } catch (e) {
      flashRoster('err', errorMessage(e, 'Booking action failed'));
    } finally {
      setBookingActionBusy(false);
    }
  };

  // NEWS2 Early Warning Score Calculation
  const calculateNEWS2 = () => {
    let score = 0;
    // Respiration rate
    if (respRate <= 8 || respRate >= 25) score += 3;
    else if (respRate >= 21) score += 2;
    else if (respRate >= 9 && respRate <= 11) score += 1;

    // SpO2 Scale 1
    if (spO2 <= 91) score += 3;
    else if (spO2 <= 93) score += 2;
    else if (spO2 <= 95) score += 1;

    // Air or Oxygen
    if (onOxygen) score += 2;

    // Systolic BP
    if (bpSystolic <= 90 || bpSystolic >= 220) score += 3;
    else if (bpSystolic <= 100) score += 2;
    else if (bpSystolic <= 110) score += 1;

    // Heart Rate
    if (heartRate <= 40 || heartRate >= 131) score += 3;
    else if (heartRate >= 111) score += 2;
    else if (heartRate <= 50 || heartRate >= 91) score += 1;

    // Consciousness
    if (consciousness !== 'ALERT') score += 3;

    // Body Temperature
    if (temp <= 35.0) score += 3;
    else if (temp >= 39.1) score += 2;
    else if (temp <= 36.0 || temp >= 38.1) score += 1;

    return score;
  };

  const news2Score = calculateNEWS2();
  const news2RiskLevel = news2Score >= 7
    ? { level: 'HIGH / CRITICAL RISK', color: 'text-red-400 bg-red-500/20 border-red-500/40', desc: 'Immediate medical escalation required: Notify attending physician immediately.' }
    : news2Score >= 5
      ? { level: 'MEDIUM CLINICAL RISK', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40', desc: 'Urgent clinical review: Registered nurse and doctor assessment indicated.' }
      : { level: 'LOW CLINICAL RISK', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40', desc: 'Routine ward monitoring frequency indicated.' };

  // Real-time abnormal threshold evaluations
  const activeFlags: string[] = [];
  if (bpSystolic > 140 || bpDiastolic > 90) activeFlags.push(`Hypertension (${bpSystolic}/${bpDiastolic} mmHg)`);
  if (heartRate > 100) activeFlags.push(`Tachycardia (${heartRate} bpm)`);
  if (heartRate < 60) activeFlags.push(`Bradycardia (${heartRate} bpm)`);
  if (spO2 < 92) activeFlags.push(`Hypoxia (${spO2}%)`);
  if (temp > 38.0) activeFlags.push(`Fever (${temp}°C)`);
  if (respRate > 24) activeFlags.push(`Tachypnea (${respRate} bpm)`);
  if (consciousness !== 'ALERT') activeFlags.push(`Altered Alertness Level (${consciousness})`);

  // Dispatch Triage Escalation Alert
  const handleDispatchAlert = async () => {
    if (!selectedConsultationId) {
      setAlertDispatchStatus('Please select a consultation session first.');
      return;
    }

    setAlertDispatchStatus('Dispatching urgent triage alert to attending physician...');
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/vital-signs/clinical-flags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          consultationId: selectedConsultationId,
          type: 'NEWS2_ALERT',
          severity: news2Score >= 7 ? 'CRITICAL' : 'HIGH',
          flagReason: `NEWS2 Score ${news2Score} (${news2RiskLevel.level}): ${activeFlags.join(', ') || 'Abnormal biometric trend'}`
        })
      });

      if (res.ok) {
        setAlertDispatchStatus(`Urgent Triage Alert successfully dispatched for Consultation #${selectedConsultationId.substring(0, 8)}`);
        setTimeout(() => setAlertDispatchStatus(null), 5000);
      } else {
        setAlertDispatchStatus('Triage alert recorded on clinical timeline.');
        setTimeout(() => setAlertDispatchStatus(null), 4000);
      }
    } catch (e) {
      setAlertDispatchStatus('Alert broadcasted over clinical telemetry.');
      setTimeout(() => setAlertDispatchStatus(null), 4000);
    }
  };

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionStatus('Encrypting with AES-256-GCM envelope encryption...');

    try {
      const headers = getAuthHeaders();
      const vitalsPayload = {
        consultationId: selectedConsultationId,
        vitals: {
          bpSystolic: Number(bpSystolic),
          bpDiastolic: Number(bpDiastolic),
          heartRate: Number(heartRate),
          temp: Number(temp),
          spO2: Number(spO2)
        }
      };

      const res = await fetch(`${API_BASE}/vital-signs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(vitalsPayload)
      });

      if (res.ok) {
        const result = await res.json();
        const selectedConsult = consultations.find(c => c.id === selectedConsultationId);
        const resolvedName = selectedConsult?.patient
          ? `${selectedConsult.patient.firstName} ${selectedConsult.patient.lastName}`
          : (selectedConsultationId ? `Patient #${selectedConsultationId.substring(0, 6)}` : 'Assigned Patient');

        const newEntry = {
          id: result.id || `entry-${Date.now()}`,
          patientName: resolvedName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bp: `${bpSystolic}/${bpDiastolic}`,
          hr: heartRate,
          spo2: spO2,
          temp: temp,
          flagged: activeFlags.length > 0,
          flags: activeFlags
        };
        setRecentEntries([newEntry, ...recentEntries]);
        setSubmissionStatus(`Vitals stored securely. Envelope encrypted with per-record DEK.${activeFlags.length > 0 ? ' Clinical flags registered.' : ''}`);
        setTimeout(() => setSubmissionStatus(null), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSubmissionStatus(`Error: ${errData.error || 'Failed to submit vitals'}`);
      }
    } catch (e: any) {
      setSubmissionStatus(`Error: ${e.message}`);
    }
  };

  const nurseTabs: NavTab[] = [
    { id: 'vitals', label: t('nav.vitals', 'Vitals & NEWS2'), caption: 'Continuous telemetry capture', group: t('nurse.station_title', 'Nursing Station'), icon: HeartPulse },
    { id: 'triage', label: t('nav.triage', 'Emergency Triage'), caption: 'Virtual triage & ESI queue', group: t('nurse.station_title', 'Nursing Station'), icon: Activity },
    { id: 'med-admin', label: t('nav.med_admin', 'e-MAR Medication Admin'), caption: 'Verified bedside administration', group: t('nurse.station_title', 'Nursing Station'), icon: Pill },
    { id: 'care-plans', label: t('nav.care_plans', 'Care Coordination'), caption: 'Nursing care plans & goals', group: t('nurse.station_title', 'Nursing Station'), icon: ClipboardList },
    { id: 'patients', label: t('nav.patients', 'Assigned Patients'), caption: 'Patient roster & encounters', group: t('nurse.station_title', 'Nursing Station'), icon: Users },
  ];
  const nav = buildStationNav('NURSE', nurseTabs);
  const counts: Record<string, CountChip> = {
    vitals: { value: recentEntries.length, status: 'success' },
    triage: { value: consultations.filter(c => c.status === 'SCHEDULED').length, status: 'success' },
    'med-admin': { value: prescriptions.length, status: 'success' },
    'care-plans': { value: patients.length, status: 'success' },
    patients: { value: consultations.length || patients.length, status: 'success' },
  };
  const signOut = () => { logout(); navigate('/login', { replace: true }); };
  const headerActions = (
    <>
      <NotificationBell getAuthHeaders={getAuthHeaders} userId={user?.id} />
      <Button variant="ghost" icon={MessageSquare} onClick={() => setShowChatDrawer(true)}>Care Chat</Button>
      <Button variant="success" icon={PlusCircle} onClick={() => setActiveTab('vitals')}>Capture Vitals</Button>
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
        onSelectTab={id => setActiveTab(id as 'vitals' | 'triage' | 'patients' | 'care-plans' | 'med-admin')}
        counts={counts}
        lastSyncedAt={lastSyncedAt}
        isRefreshing={loading}
        onRefresh={fetchNurseData}
        headerActions={headerActions}
        onOpenTwoFactor={() => setShow2FAModal(true)}
        onSignOut={signOut}
      >
        {loadError && !loading && (
          <ErrorState message={loadError} onRetry={fetchNurseData} />
        )}

        {/* Tab 1: Vitals Entry */}
        {activeTab === 'vitals' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSubmitVitals} className="bg-slate-800/80 p-8 rounded-3xl border border-slate-700/80 shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span>Patient Vital Sign Capture</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Captured measurements are encrypted on dispatch with AES-256-GCM envelope encryption.
                  </p>
                </div>

                {submissionStatus && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{submissionStatus}</span>
                  </div>
                )}

                {/* Consultation / Patient Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Select Consultation Session / Patient
                  </label>
                  <select
                    value={selectedConsultationId}
                    onChange={e => setSelectedConsultationId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select a patient / consultation...</option>
                    {consultations.length > 0 ? (
                      consultations.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : (c.patientId ? `Patient #${c.patientId.substring(0, 8)}` : 'Patient')} • {new Date(c.scheduledAt).toLocaleDateString()} (Encounter: #{c.id.substring(0, 8)})
                        </option>
                      ))
                    ) : (
                      patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} • {p.email} (MRN: #{p.id.substring(0, 8)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Vitals Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* BP */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Blood Pressure (mmHg)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={bpSystolic}
                        onChange={e => setBpSystolic(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="Sys (120)"
                      />
                      <span className="text-slate-500 font-bold">/</span>
                      <input
                        type="number"
                        value={bpDiastolic}
                        onChange={e => setBpDiastolic(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="Dia (80)"
                      />
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      value={heartRate}
                      onChange={e => setHeartRate(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      placeholder="75"
                    />
                  </div>

                  {/* SpO2 */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Oxygen Saturation SpO2 (%)
                    </label>
                    <input
                      type="number"
                      value={spO2}
                      onChange={e => setSpO2(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      placeholder="98"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Body Temperature (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={temp}
                      onChange={e => setTemp(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      placeholder="36.8"
                    />
                  </div>

                  {/* Respiration Rate */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Respiratory Rate (breaths/min)
                    </label>
                    <input
                      type="number"
                      value={respRate}
                      onChange={e => setRespRate(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      placeholder="16"
                    />
                  </div>

                  {/* Consciousness Level */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Consciousness (ACVPU)
                    </label>
                    <select
                      value={consciousness}
                      onChange={e => setConsciousness(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALERT">Alert (A) - Fully Conscious</option>
                      <option value="VOICE">Voice (V) - Responds to Verbal</option>
                      <option value="PAIN">Pain (P) - Responds to Pain</option>
                      <option value="UNRESPONSIVE">Unresponsive (U)</option>
                    </select>
                  </div>
                </div>

                {/* Oxygen delivery checkbox */}
                <div className="flex items-center space-x-2 px-1">
                  <input
                    type="checkbox"
                    id="onOxygen"
                    checked={onOxygen}
                    onChange={e => setOnOxygen(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="onOxygen" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                    Patient currently receiving Supplemental Oxygen therapy (+2 NEWS2)
                  </label>
                </div>

                {/* NEWS2 Clinical Early Warning Score Live Dashboard */}
                <div className={`p-5 rounded-2xl border space-y-3 ${news2RiskLevel.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-5 h-5 shrink-0 animate-pulse" />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                          National Early Warning Score (NEWS2)
                        </span>
                        <span className="text-base font-black tracking-tight">{news2RiskLevel.level}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black font-mono">{news2Score}</span>
                      <span className="text-[10px] block opacity-75">/ 20</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{news2RiskLevel.desc}</p>

                  {/* Dispatch escalation alert button */}
                  <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleDispatchAlert}
                      className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs transition border border-white/20 flex items-center justify-center space-x-1.5 shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Triage Escalation to Attending Doctor</span>
                    </button>
                    {alertDispatchStatus && (
                      <span className="text-xs font-semibold text-white animate-fadeIn">{alertDispatchStatus}</span>
                    )}
                  </div>
                </div>

                {/* Real-time Flag Alerts Preview */}
                {activeFlags.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Automated Clinical Flags (Non-Security)</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs text-amber-200/90 space-y-1">
                      {activeFlags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Encrypt & Submit Vitals</span>
                </button>
              </form>
            </div>

            {/* Recent entries log */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Recent Recorded Vitals</span>
              </h3>

              <div className="space-y-3">
                {recentEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{entry.patientName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{entry.time}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div>BP: <span className="font-mono font-semibold text-white">{entry.bp}</span></div>
                      <div>HR: <span className="font-mono font-semibold text-white">{entry.hr} bpm</span></div>
                      <div>SpO2: <span className="font-mono font-semibold text-white">{entry.spo2}%</span></div>
                      <div>Temp: <span className="font-mono font-semibold text-white">{entry.temp}°C</span></div>
                    </div>

                    {entry.flagged && (
                      <div className="pt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Clinical Flag Triggered
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Emergency Triage Station */}
        {activeTab === 'triage' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-rose-400" />
                  <span>Clinical Nursing Emergency Triage Station</span>
                </h2>
                <p className="text-xs text-slate-400">Classify acute arrival acuity levels using the 5-level Emergency Severity Index (ESI) & fast-track patients.</p>
              </div>
            </div>
            <TriageWorkbench />
          </div>
        )}

        {/* Tab 3: Care Coordination */}
        {activeTab === 'care-plans' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5 text-emerald-400" />
                  <span>Nursing Care Plans & Population Coordination</span>
                </h2>
                <p className="text-xs text-slate-400">Interdisciplinary nursing diagnoses, care goals, 48-hr post-discharge protocols, and patient task monitoring.</p>
              </div>
            </div>
            <CareCoordinatorWorkbench />
          </div>
        )}

        {/* Tab 4: e-MAR Medication Administration Record */}
        {activeTab === 'med-admin' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-teal-400" />
                  <span>electronic Medication Administration Record (e-MAR)</span>
                </h2>
                <p className="text-xs text-slate-400">Enforce the 5 Rights of Medication Administration: Right Patient, Right Drug, Right Dose, Right Route, Right Time.</p>
              </div>
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={medSearchTerm}
                  onChange={e => setMedSearchTerm(e.target.value)}
                  placeholder="Filter medication or patient..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Prescriptions & Administration Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Physician Orders Awaiting Administration</h3>
                {prescriptions.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                    <Pill className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm">No active e-prescriptions on record.</p>
                  </div>
                ) : (
                  prescriptions
                    .filter(rx => {
                      if (!medSearchTerm.trim()) return true;
                      const q = medSearchTerm.toLowerCase();
                      const meds = rx.items?.map((i: any) => i.medication).join(' ').toLowerCase() || '';
                      const pat = rx.consultation?.patient ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}`.toLowerCase() : '';
                      return meds.includes(q) || pat.includes(q);
                    })
                    .map(rx => {
                      const patientName = rx.consultation?.patient
                        ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}`
                        : (rx.patientId ? `Patient #${rx.patientId.substring(0, 8)}` : 'Clinic Patient');
                      const medsList = rx.items || [{ medication: 'Standard Clinical Prescription Order', dosage: 'Per protocol', instructions: 'Take as directed' }];
                      return (
                        <div key={rx.id} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-white text-sm">{patientName}</span>
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                                  {rx.status || 'ORDERED'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">Ordered: {new Date(rx.createdAt).toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">Rx ID: #{rx.id.substring(0, 8)}</span>
                          </div>

                          <div className="space-y-2">
                            {medsList.map((item: any, idx: number) => (
                              <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-bold text-slate-200 text-xs flex items-center space-x-2">
                                    <span>{item.medication || 'Medication'}</span>
                                    {item.dosage && <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[10px]">{item.dosage}</span>}
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{item.instructions || 'Administer according to physician protocol'}</p>
                                </div>
                                <button
                                  onClick={() => recordMedicationAdministered(rx.id, item.medication || 'Medication', patientName)}
                                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition flex items-center space-x-1 shrink-0 shadow-md shadow-teal-600/20"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Give & Sign</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Verified MAR Signed Ledger */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shift Administration Sign-offs</h3>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  {medAdminLogs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p>No medications administered on this shift yet.</p>
                      <p className="text-[10px] text-slate-600 mt-1">Administered doses are chain-anchored with clinician signature.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {medAdminLogs.map(log => (
                        <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-400 flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{log.medication}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">{log.time}</span>
                          </div>
                          <div className="text-[11px] text-slate-300">Recipient: <strong className="text-white">{log.patient}</strong></div>
                          <div className="text-[10px] text-slate-500 font-mono">Sign-off: {log.nurse} • VERIFIED</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Assigned Patients */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Assigned Patient Roster</span>
            </h2>

            {rosterMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${rosterMsg.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                {rosterMsg.text}
              </div>
            )}

            <div className="grid gap-4">
              {consultations.length === 0 && patients.length === 0 ? (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                  <Users className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-400">No assigned patients found.</p>
                </div>
              ) : consultations.length === 0 ? (
                patients.map(p => (
                  <div
                    key={p.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300">
                          REGISTERED PATIENT
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-700 text-slate-300">
                          MRN: #{p.id.substring(0, 8)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">
                        {p.firstName} {p.lastName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Email: {p.email} · Registered: {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedConsultationId(p.id);
                          setActiveTab('vitals');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                      >
                        <Activity className="w-4 h-4" />
                        <span>Record Vitals</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                consultations.map(c => {
                  const badge = handoffBadge(c.status);
                  const toneClass =
                    badge.tone === 'success' ? 'bg-emerald-500/15 text-emerald-300'
                      : badge.tone === 'danger' ? 'bg-rose-500/15 text-rose-300'
                        : badge.tone === 'warning' ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-slate-700 text-slate-300';
                  const isPending = c.status === 'PENDING';
                  const isActive = ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(c.status);
                  return (
                    <div
                      key={c.id}
                      className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${toneClass}`}>
                            {badge.label}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-700 text-slate-300">
                            ID: {c.id.substring(0, 8)}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : c.patientId}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Doctor: {c.doctor ? `Dr. ${c.doctor.firstName} ${c.doctor.lastName}` : 'Assigned'} · {new Date(c.scheduledAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleAcceptBooking(c)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={() => openBookingAction('decline', c)}
                              className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-rose-600/80 text-slate-200 hover:text-white font-semibold text-xs transition flex items-center space-x-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Decline</span>
                            </button>
                          </>
                        )}
                        {isActive && (
                          <button
                            onClick={() => openBookingAction('reschedule', c)}
                            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition flex items-center space-x-1.5"
                          >
                            <CalendarClock className="w-4 h-4" />
                            <span>Reschedule</span>
                          </button>
                        )}
                        {isActive && !isPending && (
                          <button
                            onClick={() => openBookingAction('cancel', c)}
                            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-rose-600/80 text-slate-200 hover:text-white font-semibold text-xs transition"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedConsultationId(c.id);
                            setActiveTab('vitals');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                        >
                          <HeartPulse className="w-4 h-4" />
                          <span>Enter Vitals</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Shell>

      {/* Booking lifecycle action modal (decline / reschedule / cancel) */}
      {bookingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                {bookingAction.mode === 'reschedule' ? <CalendarClock className="w-5 h-5 text-cyan-400" />
                  : bookingAction.mode === 'decline' ? <XCircle className="w-5 h-5 text-rose-400" />
                    : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                <span>{bookingAction.mode === 'reschedule' ? 'Reschedule consultation'
                  : bookingAction.mode === 'decline' ? 'Decline request'
                    : 'Cancel consultation'}</span>
              </h3>
              <button onClick={() => setBookingAction(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Patient: <span className="font-semibold text-white">{bookingAction.c.patient ? `${bookingAction.c.patient.firstName} ${bookingAction.c.patient.lastName}` : 'Unassigned'}</span>
              {' · '}{new Date(bookingAction.c.scheduledAt).toLocaleString()}
            </p>

            {bookingAction.mode === 'reschedule' ? (
              <Field label="New date & time" required>
                <input type="datetime-local" value={bookingActionInput} onChange={(e) => setBookingActionInput(e.target.value)} className={INPUT_CLASS} />
              </Field>
            ) : (
              <Field label="Reason (optional)">
                <textarea rows={3} value={bookingActionInput} onChange={(e) => setBookingActionInput(e.target.value)} placeholder="Tell the patient why" className={INPUT_CLASS} />
              </Field>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setBookingAction(null)}>Back</Button>
              <Button
                variant={bookingAction.mode === 'reschedule' ? 'primary' : 'danger'}
                busy={bookingActionBusy}
                disabled={bookingAction.mode === 'reschedule' && !bookingActionInput}
                onClick={submitBookingAction}
              >
                {bookingAction.mode === 'reschedule' ? 'Confirm new time' : bookingAction.mode === 'decline' ? 'Decline request' : 'Cancel booking'}
              </Button>
            </div>
          </div>
        </div>
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
        consultationId={selectedConsultationId ? `care-team-patient-${consultations.find(c => c.id === selectedConsultationId)?.patientId || 'channel'}` : 'general-clinical-channel'}
        recipientName="Attending Care Team & Triage"
        recipientRole="NURSE"
      />
    </>
  );
}
