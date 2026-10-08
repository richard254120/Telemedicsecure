import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Calendar,
  Video,
  FileEdit,
  Pill,
  HeartPulse,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Search
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<'schedule' | 'consultations' | 'eprescribe' | 'vitals'>('schedule');

  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [clinicalFlags, setClinicalFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Note editing modal / form state
  const [selectedConsultation, setSelectedConsultation] = useState<any | null>(null);
  const [clinicalNote, setClinicalNote] = useState<string>('');
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  // Vitals mock history for trend chart
  const [vitalsHistory, setVitalsHistory] = useState([
    { time: '09:00', heartRate: 72, bpSys: 120, bpDia: 80, spO2: 98 },
    { time: '11:00', heartRate: 76, bpSys: 124, bpDia: 82, spO2: 97 },
    { time: '13:00', heartRate: 104, bpSys: 145, bpDia: 94, spO2: 91 },
    { time: '15:00', heartRate: 88, bpSys: 130, bpDia: 86, spO2: 95 }
  ]);

  useEffect(() => {
    fetchDoctorData();
  }, [user]);

  const fetchDoctorData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [consRes, rxRes, flagsRes] = await Promise.all([
        fetch(`${API_BASE}/consultations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/prescriptions`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/vital-signs/clinical-flags/all`, { headers }).then(r => r.ok ? r.json() : [])
      ]);

      setConsultations(Array.isArray(consRes) ? consRes : []);
      setPrescriptions(Array.isArray(rxRes) ? rxRes : []);
      setClinicalFlags(Array.isArray(flagsRes) ? flagsRes : []);
    } catch (e) {
      console.error('Failed to load doctor dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedConsultation) return;
    setNoteStatus('Encrypting with AES-256-GCM envelope encryption...');
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations/${selectedConsultation.id}/notes`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: clinicalNote })
      });
      if (res.ok) {
        setNoteStatus('Clinical notes encrypted and saved securely with audit event recorded.');
        setTimeout(() => {
          setSelectedConsultation(null);
          setNoteStatus(null);
          setClinicalNote('');
        }, 2000);
      } else {
        const err = await res.json();
        setNoteStatus(`Error: ${err.error || 'Failed to update notes'}`);
      }
    } catch (e: any) {
      setNoteStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Attending Physician Portal • DEA EPCS Registered</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Dr. {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              End-to-End Encrypted WebRTC Consultations, Encrypted Vitals, and Ed25519 e-Prescribing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDoctorData}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/prescriptions/new')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/20 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Issue Prescription</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: 'schedule', label: 'Clinical Schedule', icon: Calendar, count: consultations.length },
            { id: 'consultations', label: 'Consultations & Notes', icon: FileEdit, count: consultations.length },
            { id: 'eprescribe', label: 'e-Prescribing (EPCS)', icon: Pill, count: prescriptions.length },
            { id: 'vitals', label: 'Patient Vitals & Flags', icon: HeartPulse, count: clinicalFlags.length }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-semibold text-xs transition ${
                  active
                    ? 'border-blue-400 text-blue-400 bg-blue-500/5'
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

        {/* Tab 1: Schedule */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Scheduled Consultations</span>
              </h2>
            </div>

            <div className="grid gap-4">
              {/* Default demo session card */}
              <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 hover:border-blue-500/50 transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      TODAY • 2:30 PM
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Room: demo-123</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Alice Smith — Cardiology Follow-Up</h3>
                  <p className="text-xs text-slate-400">
                    Patient requested prescription review & vital sign check.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate('/waiting-room/demo-123')}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join E2EE Call</span>
                  </button>
                  <button
                    onClick={() => navigate('/vitals/demo-123')}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                  >
                    <HeartPulse className="w-4 h-4" />
                    <span>View Vitals</span>
                  </button>
                </div>
              </div>

              {consultations.map(c => (
                <div
                  key={c.id}
                  className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-700 text-slate-300">
                        {c.status || 'SCHEDULED'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(c.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      Patient: {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : c.patientId}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/waiting-room/${c.id}`)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
                    >
                      <Video className="w-4 h-4" />
                      <span>Start Video</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Consultations & Notes */}
        {activeTab === 'consultations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileEdit className="w-5 h-5 text-blue-400" />
                  <span>Clinical Consultation Notes (AES-256 Envelope Encrypted)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  All clinical consultation notes are sealed with a unique per-record Data Encryption Key (DEK).
                </p>
              </div>
            </div>

            {selectedConsultation ? (
              <div className="p-6 rounded-3xl bg-slate-800/90 border border-blue-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Editing Clinical Notes for Consultation #{selectedConsultation.id?.substring(0, 8)}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Patient: {selectedConsultation.patient ? `${selectedConsultation.patient.firstName} ${selectedConsultation.patient.lastName}` : 'Alice Smith'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedConsultation(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                {noteStatus && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{noteStatus}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Consultation Examination & Treatment Plan
                  </label>
                  <textarea
                    rows={6}
                    value={clinicalNote}
                    onChange={e => setClinicalNote(e.target.value)}
                    placeholder="Enter confidential medical notes, clinical impressions, and recommendations..."
                    className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedConsultation(null)}
                    className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Encrypt & Store</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-white">Alice Smith — Consultation demo-123</h4>
                    <p className="text-xs text-slate-400">Cardiology assessment notes ready for updates.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedConsultation({ id: 'demo-123', patient: { firstName: 'Alice', lastName: 'Smith' } });
                      setClinicalNote('Patient presents with mild hypertension and elevated resting heart rate. Prescribed ACE inhibitor.');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Open Clinical Note</span>
                  </button>
                </div>

                {consultations.map(c => (
                  <div
                    key={c.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : `Consultation ${c.id.substring(0, 8)}`}
                      </h4>
                      <p className="text-xs text-slate-400">Scheduled: {new Date(c.scheduledAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedConsultation(c);
                        setClinicalNote('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Edit Notes</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: e-Prescribing */}
        {activeTab === 'eprescribe' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-cyan-400" />
                  <span>Ed25519 Cryptographically Signed Prescriptions</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Meets DEA Electronic Prescriptions for Controlled Substances (EPCS) requirements.
                </p>
              </div>

              <button
                onClick={() => navigate('/prescriptions/new')}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New e-Prescription</span>
              </button>
            </div>

            {prescriptions.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-3">
                <Pill className="w-12 h-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No prescriptions authored yet.</p>
                <button
                  onClick={() => navigate('/prescriptions/new')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Issue First Prescription</span>
                </button>
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          rx.status === 'ISSUED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : rx.status === 'DISPENSED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {rx.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">RX: {rx.id.substring(0, 8)}...</span>
                        <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          Ed25519 Signed
                        </span>
                      </div>

                      <div className="space-y-1">
                        {rx.items?.map((item: any) => (
                          <div key={item.id} className="text-xs text-white">
                            <span className="font-bold text-cyan-300">{item.medication}</span> — {item.dosage} ({item.instructions})
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Patient: {rx.consultation?.patient ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}` : 'Alice Smith'} • {new Date(rx.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/prescriptions/${rx.id}`)}
                        className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
                      >
                        Inspect
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

        {/* Tab 4: Patient Vitals & Flags */}
        {activeTab === 'vitals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <HeartPulse className="w-5 h-5 text-emerald-400" />
                  <span>Patient Vital Signs & Clinical Flags</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Decrypted clinical trends and automated threshold flags (separate from security alerts).
                </p>
              </div>

              <button
                onClick={() => navigate('/vitals/demo-123')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Capture New Vitals</span>
              </button>
            </div>

            {/* Abnormal clinical flags warning */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Active Clinical Flags Detected</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Alice Smith (Cardiology): Tachycardia (104 bpm) & Mild Hypoxia (91% SpO2) detected at 13:00. Blood pressure peaked at 145/94 mmHg.
              </p>
            </div>

            {/* Chart */}
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Vitals Trend (Heart Rate & Oxygen Saturation)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalsHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#ef4444" domain={[60, 120]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" domain={[85, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '0.75rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2.5} name="Heart Rate (bpm)" />
                    <Line yAxisId="right" type="monotone" dataKey="spO2" stroke="#06b6d4" strokeWidth={2.5} name="SpO2 (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
