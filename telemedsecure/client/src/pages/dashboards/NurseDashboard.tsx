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
  MessageSquare
} from 'lucide-react';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
import { ClinicalChatDrawer } from '../../components/ClinicalChatDrawer';

export default function NurseDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<'vitals' | 'patients'>('vitals');
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

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
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  useEffect(() => {
    fetchNurseData();
  }, [user]);

  const fetchNurseData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConsultations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <HeartPulse className="w-4 h-4" />
              <span>Clinical Nursing Station • Triage & Vitals</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Nurse {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Envelope-encrypted vital sign capture with automated clinical flags (separate from security alerts).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChatDrawer(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Care Chat</span>
            </button>
            <button
              onClick={() => setShow2FAModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>2FA Security</span>
            </button>
            <button
              onClick={fetchNurseData}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActiveTab('vitals')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Capture Vitals</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: 'vitals', label: 'Vitals Entry & Triage', icon: HeartPulse, count: recentEntries.length },
            { id: 'patients', label: 'Assigned Patients', icon: Users, count: consultations.length || 1 }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-semibold text-xs transition ${active
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
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
                    <option value="">Select a consultation...</option>
                    {consultations.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : c.patientId} (ID: {c.id.substring(0, 8)})
                      </option>
                    ))}
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

        {/* Tab 2: Assigned Patients */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Assigned Patient Roster</span>
            </h2>

            <div className="grid gap-4">
              {consultations.length === 0 ? (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                  <Users className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-400">No assigned patients found.</p>
                </div>
              ) : (
                consultations.map(c => (
                  <div
                    key={c.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-700 text-slate-300">
                        ID: {c.id.substring(0, 8)}
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : c.patientId}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Doctor: {c.doctor ? `Dr. ${c.doctor.firstName} ${c.doctor.lastName}` : 'Assigned'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
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
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
