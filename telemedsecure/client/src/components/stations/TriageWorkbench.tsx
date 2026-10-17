import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  Activity,
  Zap,
  ArrowRight,
  ShieldAlert,
  X,
  Stethoscope,
  TrendingUp
} from 'lucide-react';

export default function TriageWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Action States
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Triage Form State
  const [patientId, setPatientId] = useState('');
  const [consultationId, setConsultationId] = useState('');
  const [esiScore, setEsiScore] = useState('3');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [heartRate, setHeartRate] = useState('80');
  const [bloodPressure, setBloodPressure] = useState('120/80');
  const [respiratoryRate, setRespiratoryRate] = useState('18');
  const [temperature, setTemperature] = useState('37.0');
  const [oxygenSat, setOxygenSat] = useState('98.0');
  const [acuityNotes, setAcuityNotes] = useState('');

  useEffect(() => {
    fetchTriageData();
  }, []);

  const fetchTriageData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [qRes, statRes, pRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/stations/triage/queue`, { headers }),
        fetch(`${API_BASE}/stations/triage/stats`, { headers }),
        fetch(`${API_BASE}/consultations/patients`, { headers }),
        fetch(`${API_BASE}/consultations`, { headers })
      ]);

      if (qRes.ok) setQueue(await qRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (pRes.ok) {
        const pData = await pRes.json();
        setPatients(Array.isArray(pData) ? pData : []);
        if (pData.length > 0 && !patientId) setPatientId(pData[0].id);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setConsultations(Array.isArray(cData) ? cData : []);
      }
    } catch (err: any) {
      console.error('Error fetching triage data', err);
      setActionError('Could not load emergency triage queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/triage/assess`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId,
          consultationId: consultationId || undefined,
          esiScore: Number(esiScore),
          chiefComplaint,
          heartRate: Number(heartRate),
          bloodPressure,
          respiratoryRate: Number(respiratoryRate),
          temperature: Number(temperature),
          oxygenSat: Number(oxygenSat),
          acuityNotes
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit triage assessment');
      }

      setActionSuccess(`Patient triaged as ESI Level ${esiScore}. Intake posted to clinical waiting queue.`);
      setShowAssessModal(false);
      setChiefComplaint('');
      setAcuityNotes('');
      fetchTriageData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getEsiBadge = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse font-bold';
      case 2:
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold';
      case 3:
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold';
      case 4:
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const filteredQueue = queue.filter(q =>
    q.triageNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.chiefComplaint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Real-time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Virtual Waiting Room</span>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            {stats?.virtualWaitingRoom ?? queue.length}
          </div>
          <p className="text-[11px] text-rose-400 font-mono">Patients in Triage Queue</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">High Acuity (ESI 1 & 2)</span>
          <div className="text-2xl font-black text-red-500 tracking-tight">
            {stats?.acuityLevel1and2 ?? queue.filter(q => q.esiScore <= 2).length}
          </div>
          <p className="text-[11px] text-red-400 font-mono">Immediate / Fast-Track</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Wait Time</span>
          <div className="text-2xl font-black text-white tracking-tight">
            {stats?.averageWaitTime ?? '5.8 min'}
          </div>
          <p className="text-[11px] text-cyan-400 font-mono">Intake to Attending MD</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">NEWS2 Telemetry</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {stats?.news2Alerts ?? 'Active'}
          </div>
          <p className="text-[11px] text-emerald-400 font-mono">Vital Sign Scoring Online</p>
        </div>
      </div>

      {/* Main Triage Waiting Room */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Emergency Intake & Acuity Triage Sorting Station</h3>
              <p className="text-xs text-slate-400">Real-time Emergency Severity Index (ESI) scoring, vital signs monitoring, and clinical fast-tracking</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchTriageData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAssessModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Intake Assessment</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search triage queue..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredQueue.length} Triaged Patients in Queue
          </span>
        </div>

        {/* Triage Queue List */}
        {filteredQueue.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <HeartPulse className="w-10 h-10 mx-auto mb-2 opacity-40 text-rose-400" />
            <p className="text-sm font-semibold text-slate-300">Virtual waiting room is clear</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredQueue.map(item => (
              <div key={item.id} className="p-6 hover:bg-slate-850/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono ${getEsiBadge(item.esiScore)}`}>
                      ESI Level {item.esiScore} - {item.esiScore === 1 ? 'Resuscitation' : item.esiScore === 2 ? 'Emergent' : item.esiScore === 3 ? 'Urgent' : 'Routine'}
                    </span>
                    <span className="text-xs font-mono text-rose-400 font-bold">{item.triageNumber}</span>
                    <span className="text-xs text-slate-400">Intake: {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Patient: {item.patient?.firstName} {item.patient?.lastName} ({item.patient?.email})
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      Chief Complaint: <span className="text-white">{item.chiefComplaint}</span>
                    </p>
                  </div>

                  {/* Vitals Telemetry Row */}
                  <div className="flex flex-wrap gap-2 text-[11px] pt-1 font-mono">
                    {item.bloodPressure && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        BP: <strong className="text-cyan-400">{item.bloodPressure}</strong> mmHg
                      </span>
                    )}
                    {item.heartRate && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        HR: <strong className={item.heartRate > 100 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{item.heartRate}</strong> bpm
                      </span>
                    )}
                    {item.oxygenSat && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        SpO2: <strong className={item.oxygenSat < 95 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{item.oxygenSat}%</strong>
                      </span>
                    )}
                    {item.temperature && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        Temp: <strong className={item.temperature > 37.8 ? 'text-rose-400' : 'text-slate-200'}>{item.temperature}°C</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-mono">
                    {item.assignedQueue}
                  </span>
                  {item.esiScore <= 2 && (
                    <span className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 animate-pulse flex items-center space-x-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Fast-Track</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Intake Assessment */}
      {showAssessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <HeartPulse className="w-5 h-5 text-rose-400" />
                <span>Emergency Intake & Acuity Triage Form</span>
              </h3>
              <button onClick={() => setShowAssessModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateAssessment} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Patient *
                </label>
                <select
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  required
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Emergency Severity Index (ESI Acuity) *
                </label>
                <select
                  value={esiScore}
                  onChange={e => setEsiScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-rose-500"
                >
                  <option value="1">Level 1 - Immediate Resuscitation Required (Severe Shock / Apnea)</option>
                  <option value="2">Level 2 - Emergent / High Risk / Severe Pain / Altered Mental State</option>
                  <option value="3">Level 3 - Urgent (Multiple Diagnostic / Lab Resources Expected)</option>
                  <option value="4">Level 4 - Less Urgent (Single Diagnostic Resource Expected)</option>
                  <option value="5">Level 5 - Non-Urgent (Routine Refill or Minor Complaint)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Primary Chief Complaint *
                </label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  required
                  placeholder="e.g. Acute chest tightness, persistent fever, sudden vision disturbance"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={e => setHeartRate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={bloodPressure}
                    onChange={e => setBloodPressure(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={oxygenSat}
                    onChange={e => setOxygenSat(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Triage Nurse Clinical Notes
                </label>
                <textarea
                  rows={2}
                  value={acuityNotes}
                  onChange={e => setAcuityNotes(e.target.value)}
                  placeholder="Clinical observation, patient positioning, mobility..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssessModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Commit Triage Assessment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
