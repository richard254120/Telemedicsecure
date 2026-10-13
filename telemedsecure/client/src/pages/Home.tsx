import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  User,
  ShieldAlert,
  Video,
  FileText,
  Blocks,
  Lock,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Search,
  Activity,
  Award,
  Zap,
  Server,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [verifyRxId, setVerifyRxId] = useState('');
  const [activeTab, setActiveTab] = useState<'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN'>('PATIENT');

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyRxId.trim()) {
      navigate(`/prescriptions/${verifyRxId.trim()}/verify`);
    } else {
      navigate('/prescriptions/verify');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-96 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-40 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Compliance Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shadow-lg shadow-cyan-500/10 backdrop-blur-md animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Zero-Knowledge Clinical Platform • HIPAA §164.312 & DEA EPCS Certified</span>
          </div>
        </div>

        {/* Hero Headline */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Next-Generation{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Secure Telemedicine
            </span>{' '}
            for Modern Healthcare
          </h1>

          <p className="text-base sm:text-xl text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto">
            Zero-knowledge consultations powered by <strong className="text-white font-semibold">WebRTC E2EE video</strong>,{' '}
            hardware-enveloped <strong className="text-white font-semibold">vital telemetry</strong>,{' '}
            <strong className="text-white font-semibold">Ed25519 digitally signed e-prescriptions</strong>, and an immutable{' '}
            <strong className="text-white font-semibold">Merkle audit chain</strong>.
          </p>

          {/* Action Pathways */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <button
                onClick={() => navigate(`/${user.role.toLowerCase()}`)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm transition shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2.5 group"
              >
                <span>Go to My {user.role} Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <Link
                  to="/login?portal=patient"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm transition shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2.5 group"
                >
                  <User className="w-4 h-4 text-cyan-200" />
                  <span>Enter Patient Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/login?portal=staff"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-100 font-bold text-sm transition shadow-lg flex items-center justify-center space-x-2.5"
                >
                  <Stethoscope className="w-4 h-4 text-blue-400" />
                  <span>Clinical Staff Sign In</span>
                </Link>
              </>
            )}

            <Link
              to="/prescriptions/verify"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold text-sm transition flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verify Digital Prescription</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-cyan-400">P-256 ECDH</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">End-to-End Encryption</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-blue-400">Ed25519</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">DEA EPCS Signed RX</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-emerald-400">SHA-256</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Solidity Merkle Anchor</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-purple-400">GDPR Art. 17</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Instant Crypto-Shredding</div>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Portals & Access Architecture Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Role-Based Access Control (HIPAA §164.312(a)(1))</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Designed for Every Clinical & Operational Role
          </h2>
          <p className="text-slate-400 text-sm mt-3">
            Patients access self-service telehealth appointments. Doctors, Nurses, and Compliance Officers work in
            dedicated, admin-provisioned clinical workstations with hardware-grade cryptographic safeguards.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex flex-wrap gap-1 max-w-2xl w-full">
            <button
              onClick={() => setActiveTab('PATIENT')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeTab === 'PATIENT'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
            <button
              onClick={() => setActiveTab('DOCTOR')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeTab === 'DOCTOR'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Station</span>
            </button>
            <button
              onClick={() => setActiveTab('NURSE')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeTab === 'NURSE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Nursing Station</span>
            </button>
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeTab === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Admin & Forensics</span>
            </button>
          </div>
        </div>

        {/* Dynamic Role Showcase Card */}
        <div className="bg-slate-900/70 rounded-3xl border border-slate-800 p-8 sm:p-10 shadow-2xl backdrop-blur-xl transition">
          {activeTab === 'PATIENT' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Patient Self-Service Telehealth Portal</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Patients register self-service to consult top specialists from any browser without installing software.
                  All personal health information (PHI) is isolated under strict zero-knowledge principles.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Instant encrypted video consultation waiting rooms with peer-to-peer WebRTC</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Prescription wallet with cryptographically verifiable QR codes for pharmacies</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>GDPR Art. 17 self-service data erasure & cryptographic key-shredding controls</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Automatic calendar appointment booking with verified practitioners</span>
                  </li>
                </ul>
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => navigate('/patient')}
                    className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center space-x-2"
                  >
                    <span>Launch Patient Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    to="/login?portal=patient"
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                  >
                    Register / Sign In
                  </Link>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-cyan-400 font-bold flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>PATIENT_SESSION_LIVE</span>
                  </span>
                  <span className="text-[10px] text-slate-500">AES-GCM-256</span>
                </div>
                <div className="space-y-2 text-slate-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Identity Status:</span>
                    <span className="text-emerald-400 font-semibold">Active & Encrypted</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Appointment:</span>
                    <span className="text-white">Dr. Sarah Mitchell, MD (Cardiology)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Video Stream:</span>
                    <span className="text-cyan-300">ECDH P-256 E2EE Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prescriptions Held:</span>
                    <span className="text-white">3 Verified Active Scripts</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[10px] text-cyan-300 leading-normal">
                  Your clinical session keys are generated locally in your browser. TeleMedSecure servers cannot decrypt your private medical consult.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DOCTOR' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Doctor Workstation & e-Prescribing Suite</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Doctor accounts are <strong className="text-white">provisioned directly by Healthcare Administration</strong>{' '}
                  after credential & medical license verification. Doctors sign in using their issued credentials to access
                  DEA EPCS-compliant prescription issuance and peer-to-peer encrypted consultations.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Ed25519 digital signing of e-prescriptions with non-repudiation keypairs</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Direct patient vitals review with automated clinical anomaly detection</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Clinical consultation rooms with end-to-end encrypted WebRTC audio/video</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Controlled substance safety compliance (DEA EPCS Schedule II-V readiness)</span>
                  </li>
                </ul>
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => navigate('/doctor')}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/20 flex items-center space-x-2"
                  >
                    <span>Open Doctor Workstation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    to="/prescriptions/new"
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                  >
                    Issue e-Prescription
                  </Link>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-blue-400 font-bold flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>EPCS_SIGNING_READY</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Ed25519 Curve</span>
                </div>
                <div className="space-y-2 text-slate-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Practitioner NPI:</span>
                    <span className="text-white">NPI-1928301948 (Verified)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DEA EPCS License:</span>
                    <span className="text-emerald-400 font-semibold">Active / Schedule II-V</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Clinical Queue:</span>
                    <span className="text-cyan-300">4 Waiting Consultations</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Key Fingerprint:</span>
                    <span className="text-slate-400">ed25519:7a9f...3c82</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-[10px] text-blue-300 leading-normal">
                  Staff credentials must be issued by the clinic admin. Unauthorized self-registration is strictly blocked to maintain medical network integrity.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'NURSE' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Nursing Triage & Vitals Monitoring Station</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Registered nurses log biometric telemetry, capture patient vital signs, and trigger real-time alert flags
                  for doctors. Accounts are created by clinic administrators with instant credential activation.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Encrypted telemetry recording: Blood Pressure, Heart Rate, SpO2, Temperature</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-time clinical triage anomaly detection and abnormal thresholds</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Hardware-backed envelope encryption using AES-256 for all recorded vitals</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Direct patient triage handoff into doctor consultation queues</span>
                  </li>
                </ul>
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => navigate('/nurse')}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
                  >
                    <span>Open Nursing Station</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                  >
                    Schedule Calendar
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-emerald-400 font-bold flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>TRIAGE_TELEMETRY_FEED</span>
                  </span>
                  <span className="text-[10px] text-slate-500">LIVE FEED</span>
                </div>
                <div className="space-y-2 text-slate-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Blood Pressure:</span>
                    <span className="text-white font-semibold">122 / 78 mmHg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resting Heart Rate:</span>
                    <span className="text-emerald-400 font-semibold">72 bpm (Normal)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blood Oxygen (SpO2):</span>
                    <span className="text-cyan-300 font-semibold">99%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Body Temperature:</span>
                    <span className="text-white">98.6 °F (37.0 °C)</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-[10px] text-emerald-300 leading-normal">
                  All vitals payloads are encrypted before transport using recipient public keys and logged to the Merkle audit trail.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ADMIN' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Admin Provisioning & Forensics Command Center</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  System administrators manage clinic operations, <strong className="text-white">provision clinical staff accounts</strong>,
                  monitor HIPAA/GDPR violations in real-time with 9 detection rules, and cryptographically verify Merkle audit trees.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Direct Staff Provisioning: Create verified Doctor, Nurse & Admin accounts with 1 click</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>HIPAA Compliance Engine: 9 live forensic detection rules & violation alerts</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Solidity Merkle Root Anchoring for tamper-evident cryptographic audit logs</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Forensic incident reporting and exportable cryptographic proof bundles</span>
                  </li>
                </ul>
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => navigate('/admin')}
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-600/20 flex items-center space-x-2"
                  >
                    <span>Launch Admin Command</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    to="/compliance"
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                  >
                    Compliance Rules Hub
                  </Link>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-purple-400 font-bold flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>MERKLE_ROOT_VERIFIED</span>
                  </span>
                  <span className="text-[10px] text-slate-500">BLOCKCHAIN ANCHOR</span>
                </div>
                <div className="space-y-2 text-slate-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Audit Chain Status:</span>
                    <span className="text-emerald-400 font-semibold">100% Intact (0 Tampering)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compliance Rules Active:</span>
                    <span className="text-white">9 / 9 Continuous Rules</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Staff Provisioning:</span>
                    <span className="text-cyan-300">Admin-Enforced RBAC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Root Hash:</span>
                    <span className="text-slate-400">0x8f2d...4a1e9c</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[10px] text-purple-300 leading-normal">
                  Staff account creation is restricted to authenticated Administrators. All provisioning actions are logged to the Merkle audit chain with forensic timestamps.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Instant Public Prescription & Verification Tool */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-800 rounded-3xl border border-cyan-500/20 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Public Cryptographic Verification Utility</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Instant Prescription & Report Verifier
            </h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Pharmacies, patients, and regulatory inspectors can instantly verify the authenticity of any Ed25519 digital signature
              or SHA-256 Merkle root hash without logging in.
            </p>

            <form onSubmit={handleQuickVerify} className="mt-6 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={verifyRxId}
                  onChange={e => setVerifyRxId(e.target.value)}
                  placeholder="Enter Prescription ID or Forensic Hash..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 shrink-0"
              >
                <span>Verify Signature</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Database Alteration</span>
              </span>
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Public Ed25519 Key Verification</span>
              </span>
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>DEA EPCS Compliant</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture Pillars */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Enterprise Security & Cryptographic Pillars
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Engineered from ground zero for mission-critical healthcare compliance and zero-trust environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">E2EE Video Consults</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              WebRTC with Insertable Streams using ECDH P-256 key exchange. Audio and video frames are encrypted before leaving your browser.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Ed25519 e-Prescriptions</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canonical JSON prescriptions signed with elliptic curve Ed25519 private keys. Eliminates fraud, tampering, and unauthorized dispensing.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Blocks className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Merkle Blockchain Audit</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographically linked SHA-256 audit logs anchored to a Solidity Merkle contract. Immediate detection of log modification.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Continuous Rules Engine</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              9 active HIPAA and GDPR compliance detectors monitoring access velocity, privileged operations, and automated incident forensics.
            </p>
          </div>
        </div>
      </section>

      {/* Institutional Trust Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white">TeleMedSecure</span>
              <p className="text-[10px] text-slate-400">Zero-Knowledge Telemedicine Architecture</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px]">
            <span className="hover:text-slate-300">HIPAA Security Rule §164.312</span>
            <span>•</span>
            <span className="hover:text-slate-300">DEA EPCS Certified</span>
            <span>•</span>
            <span className="hover:text-slate-300">GDPR Regulation (EU) 2016/679</span>
            <span>•</span>
            <span className="hover:text-slate-300">HITECH Act Enforced</span>
          </div>

          <div className="text-[11px] text-slate-500">
            &copy; 2026 TeleMedSecure Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
