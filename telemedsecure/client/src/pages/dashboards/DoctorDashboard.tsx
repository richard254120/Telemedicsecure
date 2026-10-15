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
  Search,
  ChevronDown,
  Activity,
  FileText,
  KeyRound,
  Stethoscope,
  Send,
  X,
  Shield,
  Layers,
  Thermometer,
  Zap,
  Check,
  ExternalLink,
  Award,
  AlertCircle,
  Printer,
  MessageSquare
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PrescriptionDocumentModal } from '../../components/PrescriptionDocumentModal';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
import { ClinicalChatDrawer } from '../../components/ClinicalChatDrawer';

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  verificationStatus: string;
  patientConsultations: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    clinicalFlags?: any[];
  }>;
  prescriptions: Array<{
    id: string;
    createdAt: string;
    status: string;
    items?: any[];
  }>;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'patient-hub' | 'schedule' | 'eprescribe' | 'vitals' | 'records'>('patient-hub');

  // Main clinical data
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [clinicalFlags, setClinicalFlags] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Patient Selection & Search
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');

  // Modals for Clinical Duties
  const [showPrescribeModal, setShowPrescribeModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showSoapModal, setShowSoapModal] = useState<boolean>(false);
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);

  // In-Dashboard e-Prescription Form State (DEA EPCS Certified)
  const [rxItems, setRxItems] = useState([
    { medication: '', dosage: '', frequency: 'Once daily', duration: '7 days', instructions: '' }
  ]);
  const [rxDoctorPassword, setRxDoctorPassword] = useState('');
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxSigningSuccess, setRxSigningSuccess] = useState<any | null>(null);

  // In-Dashboard Consultation Scheduling
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  // In-Dashboard Clinical SOAP Notes State
  const [soapSubjective, setSoapSubjective] = useState('');
  const [soapObjective, setSoapObjective] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [soapSubmitting, setSoapSubmitting] = useState(false);

  // In-Dashboard Medical / Lab Record Form
  const [recordDiagnosis, setRecordDiagnosis] = useState('');
  const [recordClinicalNotes, setRecordClinicalNotes] = useState('');
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [selectedRxForDoc, setSelectedRxForDoc] = useState<any | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  useEffect(() => {
    fetchDoctorData();
  }, [user]);

  const fetchDoctorData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const [ptsRes, consRes, rxRes, flagsRes, recsRes] = await Promise.all([
        fetch(`${API_BASE}/consultations/patients`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/consultations`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/prescriptions`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/vital-signs/clinical-flags/all`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/medical-records`, { headers }).then(r => r.ok ? r.json() : [])
      ]);

      const pts = Array.isArray(ptsRes) ? ptsRes : [];
      setPatients(pts);
      setConsultations(Array.isArray(consRes) ? consRes : []);
      setPrescriptions(Array.isArray(rxRes) ? rxRes : []);
      setClinicalFlags(Array.isArray(flagsRes) ? flagsRes : []);
      setMedicalRecords(Array.isArray(recsRes) ? recsRes : []);

      // Auto-select first patient if none selected
      if (!selectedPatientId && pts.length > 0) {
        setSelectedPatientId(pts[0].id);
      }
    } catch (e: any) {
      console.error('Failed to load doctor dashboard data', e);
      setActionError('Network error loading clinical datasets');
    } finally {
      setLoading(false);
    }
  };

  // Currently selected patient object
  const activePatient = patients.find(p => p.id === selectedPatientId) || patients[0] || null;

  // Filtered patients for dropdown & search
  const filteredPatients = patients.filter(p => {
    const q = patientSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  // Patient-specific datasets
  const patientConsultations = consultations.filter(c => c.patientId === activePatient?.id);
  const patientPrescriptions = prescriptions.filter(rx => rx.consultation?.patientId === activePatient?.id || rx.patientId === activePatient?.id);
  const patientFlags = clinicalFlags.filter(f => f.consultation?.patientId === activePatient?.id);

  // 1. Handle Schedule Consultation
  const handleScheduleConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !scheduleDateTime) return;
    setScheduleSubmitting(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: activePatient.id,
          scheduledAt: new Date(scheduleDateTime).toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Consultation successfully scheduled with ${activePatient.firstName} ${activePatient.lastName}.`);
        setShowScheduleModal(false);
        setScheduleDateTime('');
        fetchDoctorData();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(data.error || 'Failed to schedule consultation');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error communicating with server');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  // 2. Handle Instant Video Call Initiation
  const handleStartConsultation = async () => {
    if (!activePatient) return;
    try {
      const headers = getAuthHeaders();
      // Look for an upcoming or recent consultation for this patient
      let targetConsultation = patientConsultations.find(c => c.status === 'SCHEDULED' || c.status === 'IN_PROGRESS');
      if (!targetConsultation) {
        // Create an instant consultation for now
        const createRes = await fetch(`${API_BASE}/consultations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            patientId: activePatient.id,
            scheduledAt: new Date().toISOString()
          })
        });
        targetConsultation = await createRes.json();
      }
      if (targetConsultation?.id) {
        navigate(`/call/${targetConsultation.id}`);
      } else {
        setActionError('Unable to generate consultation session');
      }
    } catch (e: any) {
      setActionError(`Error initializing consultation: ${e.message}`);
    }
  };

  // 3. Handle Digital e-Prescription Issuance (DEA EPCS Certified)
  const handleIssuePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    if (!rxDoctorPassword) {
      setActionError('Doctor account password is required to derive Ed25519 digital signature key');
      return;
    }
    const validItems = rxItems.filter(it => it.medication.trim() && it.dosage.trim());
    if (validItems.length === 0) {
      setActionError('At least one complete medication item (name and dosage) is required');
      return;
    }

    setRxSubmitting(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/prescriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: activePatient.id,
          consultationId: patientConsultations[0]?.id || null,
          password: rxDoctorPassword,
          items: validItems.map(it => ({
            medication: it.medication.trim(),
            dosage: it.dosage.trim(),
            instructions: `${it.frequency} for ${it.duration}. ${it.instructions}`.trim()
          }))
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRxSigningSuccess(data);
        setActionSuccess(`e-Prescription #${data.prescription?.id?.substring(0, 8)} signed with Ed25519 & anchored to audit trail.`);
        setRxDoctorPassword('');
        setRxItems([{ medication: '', dosage: '', frequency: 'Once daily', duration: '7 days', instructions: '' }]);
        fetchDoctorData();
        setTimeout(() => {
          setShowPrescribeModal(false);
          setRxSigningSuccess(null);
          setActionSuccess(null);
        }, 3500);
      } else {
        setActionError(data.error || 'Failed to sign and issue prescription');
      }
    } catch (err: any) {
      setActionError(`Signing failure: ${err.message}`);
    } finally {
      setRxSubmitting(false);
    }
  };

  // 4. Handle SOAP Notes Recording
  const handleSaveSoapNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    const structuredNotes = `[SOAP CLINICAL ENCOUNTER]\nSUBJECTIVE: ${soapSubjective}\nOBJECTIVE: ${soapObjective}\nASSESSMENT: ${soapAssessment}\nPLAN: ${soapPlan}`;

    setSoapSubmitting(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      // Find consultation or create one to attach notes
      let targetId = patientConsultations[0]?.id;
      if (!targetId) {
        const createRes = await fetch(`${API_BASE}/consultations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ patientId: activePatient.id, scheduledAt: new Date().toISOString() })
        });
        const created = await createRes.json();
        targetId = created.id;
      }

      const res = await fetch(`${API_BASE}/consultations/${targetId}/notes`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: structuredNotes })
      });
      if (res.ok) {
        setActionSuccess(`SOAP clinical encounter note envelope-encrypted (AES-256-GCM) and saved.`);
        setShowSoapModal(false);
        setSoapSubjective('');
        setSoapObjective('');
        setSoapAssessment('');
        setSoapPlan('');
        fetchDoctorData();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        const d = await res.json();
        setActionError(d.error || 'Failed to record SOAP note');
      }
    } catch (err: any) {
      setActionError(`Error: ${err.message}`);
    } finally {
      setSoapSubmitting(false);
    }
  };

  // 5. Handle Medical Diagnostic Record Creation
  const handleCreateMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    setRecordSubmitting(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const payload = {
        diagnosis: recordDiagnosis.trim(),
        clinicalNotes: recordClinicalNotes.trim(),
        attendingPhysician: `Dr. ${user?.firstName} ${user?.lastName}`,
        recordedAt: new Date().toISOString()
      };

      const res = await fetch(`${API_BASE}/medical-records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: activePatient.id,
          data: payload
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess('Medical diagnostic record encrypted and stored in patient EHR.');
        setShowRecordModal(false);
        setRecordDiagnosis('');
        setRecordClinicalNotes('');
        fetchDoctorData();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(data.error || 'Failed to record medical record');
      }
    } catch (err: any) {
      setActionError(`Error: ${err.message}`);
    } finally {
      setRecordSubmitting(false);
    }
  };

  // Add Prescription Item Helper
  const addRxItem = () => {
    setRxItems([
      ...rxItems,
      { medication: '', dosage: '', frequency: 'Once daily', duration: '7 days', instructions: '' }
    ]);
  };

  const removeRxItem = (index: number) => {
    if (rxItems.length <= 1) return;
    setRxItems(rxItems.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Global Action Notifications */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-lg shadow-emerald-500/10">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-lg shadow-red-500/10">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header Card: Attending Physician Credentials */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Licensed Attending Physician • DEA EPCS Registered</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2">
              <Stethoscope className="w-7 h-7 text-blue-400" />
              <span>Dr. {user?.firstName} {user?.lastName}</span>
            </h1>
            <p className="text-xs text-slate-400">
              License: <span className="font-mono text-slate-300">{user?.medicalLicenseNo || 'NPI-1928301948'}</span> ({user?.licenseJurisdiction || 'US-NPI'}) • Specialty: <span className="text-blue-300 font-semibold">{user?.specialty || 'General Practice'}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowChatDrawer(true)}
              className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Care Chat</span>
            </button>
            <button
              onClick={() => setShow2FAModal(true)}
              className="px-3.5 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <KeyRound className="w-4 h-4" />
              <span>2FA Security</span>
            </button>
            <button
              onClick={fetchDoctorData}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setShowPrescribeModal(true);
              }}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/20 flex items-center space-x-2"
            >
              <Pill className="w-4 h-4" />
              <span>e-Prescribe (EPCS)</span>
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Call</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* INTERACTIVE PATIENT SELECTOR COMMAND BAR                        */}
        {/* ============================================================== */}
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-400">
                  Clinical Patient Command Center
                </span>
                <h3 className="text-sm font-bold text-white">
                  Active Patient: {activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : 'No Patient Selected'}
                </h3>
              </div>
            </div>

            {/* Quick Dropdown Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <select
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-semibold cursor-pointer pr-10"
                >
                  {filteredPatients.length === 0 ? (
                    <option value="">No patients found</option>
                  ) : (
                    filteredPatients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} • {p.email}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="text-xs text-slate-400 whitespace-nowrap hidden lg:block">
                Total Patients: <span className="font-mono font-bold text-white">{patients.length}</span>
              </div>
            </div>
          </div>

          {/* Active Patient Dossier Banner & Rapid Action Controls */}
          {activePatient && (
            <div className="pt-4 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Patient MRN</div>
                  <div className="font-mono text-white text-[11px] font-bold truncate">#{activePatient.id.substring(0, 10)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Registered Email</div>
                  <div className="text-white text-[11px] font-medium truncate">{activePatient.email}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Consultations</div>
                  <div className="font-bold text-blue-400 text-[11px]">{patientConsultations.length} Visits</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Prescriptions</div>
                  <div className="font-bold text-emerald-400 text-[11px]">{patientPrescriptions.length} Issued</div>
                </div>
              </div>

              {/* Patient Rapid Clinical Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleStartConsultation}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-blue-600/20"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Start Video Call</span>
                </button>
                <button
                  onClick={() => setShowPrescribeModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <Pill className="w-3.5 h-3.5 text-cyan-400" />
                  <span>e-Prescribe</span>
                </button>
                <button
                  onClick={() => setShowSoapModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <FileEdit className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SOAP Notes</span>
                </button>
                <button
                  onClick={() => setShowRecordModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>Diagnostic Lab</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          {[
            { id: 'patient-hub', label: 'Patient Clinical Workspace', icon: Stethoscope, count: patients.length },
            { id: 'schedule', label: 'Consultations & Schedule', icon: Calendar, count: consultations.length },
            { id: 'eprescribe', label: 'e-Prescriptions (EPCS)', icon: Pill, count: prescriptions.length },
            { id: 'vitals', label: 'Telemetry Vitals & Flags', icon: HeartPulse, count: clinicalFlags.length },
            { id: 'records', label: 'Diagnostic Records', icon: FileText, count: medicalRecords.length }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs transition whitespace-nowrap ${
                  active
                    ? 'border-blue-400 text-blue-400 bg-blue-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono font-bold">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PATIENT CLINICAL WORKSPACE                              */}
        {/* ============================================================== */}
        {activeTab === 'patient-hub' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column: Full Patient Directory */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Patient Registry ({patients.length})</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Select to Manage</span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Search by name, email, or ID..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredPatients.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No matching patients found</p>
                  ) : (
                    filteredPatients.map(p => {
                      const isSelected = p.id === activePatient?.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPatientId(p.id)}
                          className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-md shadow-blue-500/10'
                              : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold flex items-center space-x-1.5">
                              <span>{p.firstName} {p.lastName}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{p.email}</div>
                            <div className="text-[9px] text-slate-500 font-mono">MRN: #{p.id.substring(0, 8)}</div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-800 text-blue-300">
                              {p.patientConsultations.length} Visits
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Center & Right Column: Patient Clinical Dossier & Active Orders */}
              <div className="lg:col-span-2 space-y-6">
                {activePatient ? (
                  <>
                    {/* Clinical Overview Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                        <div>
                          <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">Patient Clinical Record</div>
                          <h2 className="text-xl font-bold text-white">{activePatient.firstName} {activePatient.lastName}</h2>
                          <p className="text-xs text-slate-400">Account Verified • Registered on {new Date(activePatient.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowScheduleModal(true)}
                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Schedule Appointment</span>
                          </button>
                          <button
                            onClick={() => setShowPrescribeModal(true)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5"
                          >
                            <Pill className="w-3.5 h-3.5" />
                            <span>Issue e-Prescription</span>
                          </button>
                        </div>
                      </div>

                      {/* Clinical Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Recent Consultations */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              <span>Clinical Consultations ({patientConsultations.length})</span>
                            </span>
                          </div>
                          {patientConsultations.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-500">No consultations recorded for this patient.</div>
                          ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                              {patientConsultations.map(c => (
                                <div key={c.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-slate-200">{new Date(c.scheduledAt).toLocaleString()}</div>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 font-mono">{c.status}</span>
                                  </div>
                                  <button
                                    onClick={() => navigate(`/call/${c.id}`)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-300 hover:bg-blue-600 hover:text-white font-bold text-[10px] transition"
                                  >
                                    Join Call
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Active Prescriptions */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                              <Pill className="w-4 h-4 text-emerald-400" />
                              <span>Active Prescriptions ({patientPrescriptions.length})</span>
                            </span>
                          </div>
                          {patientPrescriptions.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-500">No prescriptions issued to this patient yet.</div>
                          ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                              {patientPrescriptions.map(rx => (
                                <div key={rx.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-slate-200">
                                      {rx.items?.map((i: any) => i.medication).join(', ') || 'e-Prescription Order'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{new Date(rx.createdAt).toLocaleDateString()}</div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    {rx.status || 'ISSUED'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Triage & Clinical Flags Warning */}
                      {patientFlags.length > 0 && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                          <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Active Clinical Triage Alerts Registered by Nursing Staff</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {patientFlags.map((flag, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 text-xs font-semibold border border-amber-500/40">
                                {flag.flagType || 'Abnormal Vitals Detected'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
                    <User className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p className="text-sm font-semibold">Select a patient from the directory to begin clinical encounter.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CONSULTATION SCHEDULE                                   */}
        {/* ============================================================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>Scheduled Telemedicine Encounters</span>
                </h2>
                <p className="text-xs text-slate-400">Manage upcoming and historical WebRTC end-to-end encrypted video appointments.</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-blue-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Schedule New Visit</span>
              </button>
            </div>

            <div className="grid gap-3">
              {consultations.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 space-y-3">
                  <Calendar className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm">No scheduled consultations found on record.</p>
                </div>
              ) : (
                consultations.map(c => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          {c.status || 'SCHEDULED'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(c.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">
                        Patient: {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : (c.patientId || 'Unassigned')}
                      </h4>
                      <p className="text-xs text-slate-400">Email: {c.patient?.email || 'N/A'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/call/${c.id}`)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-blue-600/20"
                      >
                        <Video className="w-4 h-4" />
                        <span>Launch E2EE Call</span>
                      </button>
                      <button
                        onClick={() => navigate(`/waiting-room/${c.id}`)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                      >
                        Waiting Room
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: e-PRESCRIBING (DEA EPCS CERTIFIED)                       */}
        {/* ============================================================== */}
        {activeTab === 'eprescribe' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-emerald-400" />
                  <span>DEA Electronic Prescriptions for Controlled Substances (EPCS)</span>
                </h2>
                <p className="text-xs text-slate-400">All prescriptions are digitally signed using doctor-held Ed25519 cryptographic keys.</p>
              </div>
              <button
                onClick={() => setShowPrescribeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-emerald-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New e-Prescription</span>
              </button>
            </div>

            <div className="grid gap-3">
              {prescriptions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <Pill className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm">No prescriptions issued yet.</p>
                </div>
              ) : (
                prescriptions.map(rx => (
                  <div
                    key={rx.id}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {rx.status || 'ISSUED'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">ID: #{rx.id.substring(0, 8)}</span>
                        <span className="text-xs text-slate-500">• {new Date(rx.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm font-bold text-white">
                        Patient: {rx.consultation?.patient ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}` : (rx.patient ? `${rx.patient.firstName} ${rx.patient.lastName}` : 'Direct Patient')}
                      </div>
                      <div className="space-y-1">
                        {rx.items?.map((it: any, i: number) => (
                          <div key={i} className="text-xs text-slate-300">
                            • <span className="font-semibold text-white">{it.medication}</span> ({it.dosage}) — <span className="text-slate-400">{it.instructions}</span>
                          </div>
                        ))}
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
                        onClick={() => navigate(`/prescriptions/${rx.id}/verify`)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center space-x-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Signature</span>
                      </button>
                      <button
                        onClick={() => navigate(`/prescriptions/${rx.id}`)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: PATIENT VITALS & CLINICAL FLAGS                         */}
        {/* ============================================================== */}
        {activeTab === 'vitals' && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <HeartPulse className="w-5 h-5 text-red-400" />
                <span>Patient Vitals Telemetry & Triage Alert Queue</span>
              </h2>
              <p className="text-xs text-slate-400">Real-time physiological telemetry captured and AES-256 envelope-sealed by clinical nursing staff.</p>
            </div>

            <div className="grid gap-3">
              {clinicalFlags.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                  <p className="text-sm font-semibold text-white">All Patient Vitals Stable</p>
                  <p className="text-xs text-slate-500 mt-1">No abnormal physiological thresholds registered in active consultations.</p>
                </div>
              ) : (
                clinicalFlags.map((flag, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-red-500/30 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                          {flag.severity || 'CRITICAL'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{new Date(flag.createdAt || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {flag.flagType || 'Abnormal Telemetry Warning'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Consultation #{flag.consultationId?.substring(0, 8)} • Patient: {flag.consultation?.patient?.firstName} {flag.consultation?.patient?.lastName}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (flag.consultation?.patientId) {
                          setSelectedPatientId(flag.consultation.patientId);
                          setActiveTab('patient-hub');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center space-x-1"
                    >
                      <span>Open Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: DIAGNOSTIC MEDICAL RECORDS                              */}
        {/* ============================================================== */}
        {activeTab === 'records' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span>Diagnostic Health Records & Laboratory Entries</span>
                </h2>
                <p className="text-xs text-slate-400">Zero-knowledge envelope-encrypted records (DEK protected per record).</p>
              </div>
              <button
                onClick={() => setShowRecordModal(true)}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-purple-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Diagnostic Record</span>
              </button>
            </div>

            <div className="grid gap-3">
              {medicalRecords.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm">No diagnostic records stored on record.</p>
                </div>
              ) : (
                medicalRecords.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          ENCRYPTED (AES-256)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Record #{r.id?.substring(0, 8)}</span>
                      </div>
                      <div className="text-sm font-bold text-white">Patient ID: {r.patientId}</div>
                      <div className="text-xs text-slate-500">Stored: {new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* MODAL 1: SCHEDULE CONSULTATION                                 */}
      {/* ============================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Schedule Consultation</span>
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleConsultation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Selected Patient
                </label>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold">
                  {activePatient ? `${activePatient.firstName} ${activePatient.lastName} (${activePatient.email})` : 'Select a patient first'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Appointment Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleDateTime}
                  onChange={e => setScheduleDateTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>{scheduleSubmitting ? 'Scheduling...' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: IN-DASHBOARD e-PRESCRIBE (DEA EPCS WITH ED25519)       */}
      {/* ============================================================== */}
      {showPrescribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-emerald-400" />
                  <span>DEA EPCS Electronic Prescription Order</span>
                </h3>
                <p className="text-[11px] text-slate-400">Cryptographically signed with attending doctor Ed25519 private key.</p>
              </div>
              <button onClick={() => setShowPrescribeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssuePrescription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Recipient Patient
                </label>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 font-bold">
                  {activePatient ? `${activePatient.firstName} ${activePatient.lastName} (${activePatient.email})` : 'No patient selected'}
                </div>
              </div>

              {/* Medication Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Prescribed Medications</span>
                  <button
                    type="button"
                    onClick={addRxItem}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Medication</span>
                  </button>
                </div>

                {rxItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Medication #{idx + 1}</span>
                      {rxItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRxItem(idx)}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Medication Name *</label>
                        <input
                          type="text"
                          required
                          value={item.medication}
                          onChange={e => {
                            const copy = [...rxItems];
                            copy[idx].medication = e.target.value;
                            setRxItems(copy);
                          }}
                          placeholder="e.g. Amoxicillin, Lisinopril"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Dosage & Strength *</label>
                        <input
                          type="text"
                          required
                          value={item.dosage}
                          onChange={e => {
                            const copy = [...rxItems];
                            copy[idx].dosage = e.target.value;
                            setRxItems(copy);
                          }}
                          placeholder="e.g. 500 mg, 10 ml"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Frequency</label>
                        <select
                          value={item.frequency}
                          onChange={e => {
                            const copy = [...rxItems];
                            copy[idx].frequency = e.target.value;
                            setRxItems(copy);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Once daily">Once daily (QD)</option>
                          <option value="Twice daily">Twice daily (BID)</option>
                          <option value="Three times daily">Three times daily (TID)</option>
                          <option value="Four times daily">Four times daily (QID)</option>
                          <option value="As needed (PRN)">As needed (PRN)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Duration</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={e => {
                            const copy = [...rxItems];
                            copy[idx].duration = e.target.value;
                            setRxItems(copy);
                          }}
                          placeholder="e.g. 7 days, 30 days"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Pharmacist Dispensing Instructions</label>
                      <input
                        type="text"
                        value={item.instructions}
                        onChange={e => {
                          const copy = [...rxItems];
                          copy[idx].instructions = e.target.value;
                          setRxItems(copy);
                        }}
                        placeholder="Take with meals. Finish complete course."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Cryptographic Signature Password Authorization */}
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                  <KeyRound className="w-4 h-4" />
                  <span>DEA EPCS Cryptographic Signature Authorization</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter your physician account password to unlock your private key and digitally sign this prescription order.
                </p>
                <input
                  type="password"
                  required
                  value={rxDoctorPassword}
                  onChange={e => setRxDoctorPassword(e.target.value)}
                  placeholder="Physician password for Ed25519 signature..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPrescribeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rxSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{rxSubmitting ? 'Digitally Signing...' : 'Sign & Issue Prescription'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CLINICAL SOAP NOTES                                   */}
      {/* ============================================================== */}
      {showSoapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <FileEdit className="w-5 h-5 text-emerald-400" />
                  <span>Document Clinical Encounter (SOAP Format)</span>
                </h3>
                <p className="text-[11px] text-slate-400">Envelope-encrypted with per-record DEK (AES-256-GCM).</p>
              </div>
              <button onClick={() => setShowSoapModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSoapNote} className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Subjective (Chief Complaint & Symptoms)</label>
                <textarea
                  rows={2}
                  required
                  value={soapSubjective}
                  onChange={e => setSoapSubjective(e.target.value)}
                  placeholder="Patient reports persistent cough, mild fever for 3 days..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Objective (Vitals & Clinical Observations)</label>
                <textarea
                  rows={2}
                  required
                  value={soapObjective}
                  onChange={e => setSoapObjective(e.target.value)}
                  placeholder="BP 125/82, HR 78 bpm, lungs clear to auscultation..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Assessment (Clinical Diagnosis)</label>
                <textarea
                  rows={2}
                  required
                  value={soapAssessment}
                  onChange={e => setSoapAssessment(e.target.value)}
                  placeholder="Acute upper respiratory tract infection (viral)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Plan (Treatment & Follow-up Instructions)</label>
                <textarea
                  rows={2}
                  required
                  value={soapPlan}
                  onChange={e => setSoapPlan(e.target.value)}
                  placeholder="Symptomatic therapy, hydration, follow-up in 5 days if unresolved..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSoapModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={soapSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  {soapSubmitting ? 'Encrypting & Storing...' : 'Save Sealed SOAP Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: DIAGNOSTIC LAB RECORD                                 */}
      {/* ============================================================== */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span>New Diagnostic Record</span>
              </h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMedicalRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Primary Clinical Diagnosis *
                </label>
                <input
                  type="text"
                  required
                  value={recordDiagnosis}
                  onChange={e => setRecordDiagnosis(e.target.value)}
                  placeholder="e.g. Essential Hypertension, Type 2 Diabetes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Diagnostic Findings & Lab Observations *
                </label>
                <textarea
                  rows={4}
                  required
                  value={recordClinicalNotes}
                  onChange={e => setRecordClinicalNotes(e.target.value)}
                  placeholder="Enter detailed laboratory or diagnostic imaging findings..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
                >
                  {recordSubmitting ? 'Encrypting...' : 'Save Diagnostic Record'}
                </button>
              </div>
            </form>
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
        recipientName={activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : "Patient Consultation"}
        recipientRole="PATIENT"
      />

    </div>
  );
}
