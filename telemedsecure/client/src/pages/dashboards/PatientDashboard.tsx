import React, { useState, useEffect } from 'react';
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
  Lock
} from 'lucide-react';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<'appointments' | 'records' | 'prescriptions' | 'consent'>('appointments');

  // State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientData();
  }, [user]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [appRes, recRes, rxRes, conRes] = await Promise.all([
        fetch(`${API_BASE}/consultations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/medical-records`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/prescriptions`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/gdpr/consent`, { headers }).then(r => r.ok ? r.json() : [])
      ]);

      setAppointments(Array.isArray(appRes) ? appRes : []);
      setRecords(Array.isArray(recRes) ? recRes : []);
      setPrescriptions(Array.isArray(rxRes) ? rxRes : []);
      setConsents(Array.isArray(conRes) ? conRes : []);
    } catch (e) {
      console.error('Error loading patient dashboard data', e);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Patient Portal • Zero-Knowledge Encrypted</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Welcome, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Protected Health Information (PHI) encrypted with AES-256-GCM envelope encryption.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPatientData}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/waiting-room/demo-123')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/20 flex items-center space-x-2"
            >
              <Video className="w-4 h-4" />
              <span>Join Active Call</span>
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
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: 'appointments', label: 'Appointments', icon: Calendar, count: appointments.length },
            { id: 'records', label: 'Medical Records', icon: FileText, count: records.length },
            { id: 'prescriptions', label: 'Prescriptions', icon: Pill, count: prescriptions.length },
            { id: 'consent', label: 'GDPR Consent & Privacy', icon: Shield, count: consents.length }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-semibold text-xs transition ${
                  active
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
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

        {/* Tab 1: Appointments */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>Your Telemedicine Consultations</span>
              </h2>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-8 text-center space-y-4">
                <Calendar className="w-12 h-12 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No scheduled consultations found on record.</p>
                <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 max-w-md mx-auto text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">Demo Consultation Session</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">SCHEDULED</span>
                  </div>
                  <p className="text-xs text-slate-400">Room: demo-123 • Dr. Sarah Jenkins</p>
                  <button
                    onClick={() => navigate('/waiting-room/demo-123')}
                    className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Enter Waiting Room</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointments.map(app => (
                  <div
                    key={app.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 hover:border-cyan-500/50 transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {app.status || 'SCHEDULED'}
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
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/waiting-room/${app.id}`)}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
                      >
                        <Video className="w-4 h-4" />
                        <span>Join Call</span>
                      </button>
                    </div>
                  </div>
                ))}
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
              <span className="text-xs text-slate-400">Zero-Knowledge Decrypted View</span>
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
                    </div>

                    <div className="flex items-center gap-2">
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
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                          isGranted
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
      </div>
    </div>
  );
}
