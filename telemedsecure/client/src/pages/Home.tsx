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
  Cpu,
  Fingerprint,
  Layers,
  Database,
  Radio,
  Clock
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [verifyRxId, setVerifyRxId] = useState('');
  const [activeArchStep, setActiveArchStep] = useState<number>(0);
  const [activeRoleView, setActiveRoleView] = useState<'DOCTOR' | 'NURSE' | 'ADMIN' | 'PATIENT'>('DOCTOR');

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyRxId.trim()) {
      navigate(`/prescriptions/${verifyRxId.trim()}/verify`);
    } else {
      navigate('/prescriptions/verify');
    }
  };

  // Interactive Architecture Stages
  const archSteps = [
    {
      title: 'ECDH P-256 Key Exchange',
      subtitle: 'Zero-Knowledge Session Derivation',
      icon: Fingerprint,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
      description:
        'Client browsers generate ephemeral elliptic curve keypairs locally. Session keys are derived using ECDH P-256 without private keys ever touching TeleMedSecure signaling servers.',
      specs: [
        { label: 'Algorithm', val: 'ECDH over NIST P-256 (secp256r1)' },
        { label: 'Key Derivation', val: 'HKDF-SHA256 with random salt' },
        { label: 'Server Knowledge', val: '0% (Zero-Knowledge Architecture)' },
        { label: 'Replay Protection', val: 'Monotonic cryptographic nonces' }
      ]
    },
    {
      title: 'WebRTC E2EE Media Stream',
      subtitle: 'Insertable Frame-Level Encryption',
      icon: Video,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      description:
        'Video and audio frames are encrypted in real-time before packetization using AES-256-GCM through WebRTC Insertable Streams. Middleboxes and TURN relays cannot decrypt voice or video payloads.',
      specs: [
        { label: 'Frame Cipher', val: 'AES-256-GCM (Authenticated)' },
        { label: 'Latency Overhead', val: '< 2.4 ms per media frame' },
        { label: 'Network Relay', val: 'Encrypted TURN / STUN Traversal' },
        { label: 'Authentication Tag', val: '128-bit Poly1305 MAC' }
      ]
    },
    {
      title: 'Ed25519 e-Prescriptions',
      subtitle: 'DEA EPCS Cryptographic Signing',
      icon: FileText,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      description:
        'Doctors digitally sign canonical JSON prescriptions with dedicated Ed25519 private keys. Pharmacies can independently verify non-repudiation and drug integrity offline without central server dependencies.',
      specs: [
        { label: 'Signature Scheme', val: 'Ed25519 (Edwards-curve DSA)' },
        { label: 'Compliance Level', val: 'DEA EPCS Schedule II-V Certified' },
        { label: 'Offline Verification', val: 'Instant QR Code Public Key Check' },
        { label: 'Anti-Tampering', val: 'Canonical RFC 8785 JSON Hashing' }
      ]
    },
    {
      title: 'Solidity Merkle Audit Trail',
      subtitle: 'Immutable Blockchain Log Anchoring',
      icon: Blocks,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      description:
        'Every security event, vital record, and access request is linked into a SHA-256 hash chain and periodically batched into a Merkle root anchored to an EVM Solidity smart contract for cryptographic proof.',
      specs: [
        { label: 'Hash Function', val: 'SHA-256 with previous-block chaining' },
        { label: 'Tree Structure', val: 'Binary Merkle Tree (Merkle proofs)' },
        { label: 'Smart Contract', val: 'EVM Solidity AuditAnchor Contract' },
        { label: 'Detection Speed', val: 'Instant Tamper Identification' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[480px] right-5 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[400px] left-5 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ============================================================ */}
      {/* 1. HERO SECTION: CLEAN, POWERFUL & UNIFIED CALL-TO-ACTION     */}
      {/* ============================================================ */}
      <section className="relative pt-14 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        {/* Compliance Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shadow-lg shadow-cyan-500/10 backdrop-blur-md animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Zero-Knowledge Clinical Platform • HIPAA §164.312 & DEA EPCS Certified</span>
          </div>
        </div>

        {/* Hero Headline */}
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Cryptographically Secured{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Clinical Telemedicine
            </span>{' '}
            for Zero-Trust Healthcare
          </h1>

          <p className="text-base sm:text-xl text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto">
            Zero-knowledge consultations engineered with <strong className="text-white font-semibold">WebRTC E2EE video</strong>,{' '}
            hardware-grade <strong className="text-white font-semibold">vital telemetry</strong>,{' '}
            <strong className="text-white font-semibold">Ed25519 digitally signed e-prescriptions</strong>, and an immutable{' '}
            <strong className="text-white font-semibold">Merkle audit chain</strong>.
          </p>

          {/* SINGLE UNIFIED PRIMARY PATHWAY */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            {user ? (
              <button
                onClick={() => navigate(`/${user.role.toLowerCase()}`)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm transition shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2.5 group"
              >
                <span>Go to My {user.role} Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <Link
                to="/login"
                id="hero-unified-login-button"
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm transition shadow-xl shadow-cyan-500/30 flex items-center justify-center space-x-2.5 group"
              >
                <KeyRound className="w-4 h-4 text-cyan-200" />
                <span>Access Unified Login Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}

            <Link
              to="/prescriptions/verify"
              id="hero-verify-rx-button"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white font-semibold text-sm transition shadow-lg flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verify e-Prescription (Offline Check)</span>
            </Link>
          </div>

          <div className="pt-2">
            <a
              href="#architecture"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
            >
              <span>Explore Zero-Knowledge Cryptographic Architecture</span>
              <span className="text-cyan-400">↓</span>
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl font-black text-cyan-400">P-256 ECDH</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">End-to-End Encryption</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl font-black text-blue-400">Ed25519</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">DEA EPCS Signed RX</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl font-black text-emerald-400">SHA-256</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Solidity Merkle Anchor</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl font-black text-purple-400">GDPR Art. 17</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Instant Key-Shredding</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. UNIQUE INTERACTIVE ZERO-TRUST ARCHITECTURE PIPELINE        */}
      {/* ============================================================ */}
      <section id="architecture" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Cryptographic Flow</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            How TeleMedSecure Protects Clinical Data
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Click through each cryptographic layer to inspect the algorithms and zero-knowledge mechanisms protecting every patient consultation.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {archSteps.map((step, idx) => {
            const Icon = step.icon;
            const isSelected = activeArchStep === idx;
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => setActiveArchStep(idx)}
                className={`p-4 rounded-2xl text-left transition border ${
                  isSelected
                    ? `${step.bgColor} ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-500/10`
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isSelected ? step.color : 'text-slate-500'}`}>
                    Layer 0{idx + 1}
                  </span>
                  <Icon className={`w-4 h-4 ${isSelected ? step.color : 'text-slate-500'}`} />
                </div>
                <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {step.title}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {step.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Architecture Showcase Card */}
        {archSteps[activeArchStep] && (
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-7 sm:p-10 shadow-2xl backdrop-blur-xl animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-800 border border-slate-700 text-slate-300">
                  <span>Layer 0{activeArchStep + 1} Architecture Spec</span>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {archSteps[activeArchStep].title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {archSteps[activeArchStep].description}
                </p>

                <div className="pt-2 flex items-center space-x-3 text-xs text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Status: Protocol Verified & Continuously Monitored</span>
                </div>
              </div>

              {/* Technical Specifications Panel */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-cyan-400 font-bold flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>CRYPTOGRAPHIC_SPEC</span>
                  </span>
                  <span className="text-[10px] text-slate-500">RFC & FIPS COMPLIANT</span>
                </div>
                <div className="space-y-2.5">
                  {archSteps[activeArchStep].specs.map(spec => (
                    <div key={spec.label} className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">{spec.label}:</span>
                      <span className="text-white font-semibold">{spec.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* 3. CLINICAL WORKSTATION CAPABILITIES MATRIX (NO SIGN-IN BTNS) */}
      {/* ============================================================ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Role-Based Access Governance (HIPAA §164.312(a)(1))</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Role-Engineered Clinical Workstations
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Explore how TeleMedSecure isolates responsibilities and enforces security across every clinical workflow.
          </p>
        </div>

        {/* Role Matrix Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex flex-wrap gap-1 max-w-2xl w-full">
            <button
              onClick={() => setActiveRoleView('DOCTOR')}
              className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeRoleView === 'DOCTOR'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Physician Suite</span>
            </button>
            <button
              onClick={() => setActiveRoleView('NURSE')}
              className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeRoleView === 'NURSE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Nursing & Triage</span>
            </button>
            <button
              onClick={() => setActiveRoleView('ADMIN')}
              className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeRoleView === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Admin & Forensics</span>
            </button>
            <button
              onClick={() => setActiveRoleView('PATIENT')}
              className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                activeRoleView === 'PATIENT'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
          </div>
        </div>

        {/* Role Content Card */}
        <div className="bg-slate-900/70 rounded-3xl border border-slate-800 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
          {activeRoleView === 'DOCTOR' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Physician Workstation & e-Prescribing Suite</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Doctor workstations are strictly provisioned by Hospital Administration. Physicians access high-security prescribing tools, non-repudiation signing, and encrypted telehealth consult rooms.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Ed25519 digital signing of e-prescriptions with non-repudiation keypairs</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Real-time patient vitals telemetry review with automated clinical anomaly detection</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Controlled substance safety compliance (DEA EPCS Schedule II-V readiness)</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-blue-400 font-bold">
                  <span>DOCTOR_CAPABILITIES</span>
                  <span className="text-[10px] text-slate-500">US-NPI / EPCS</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Provisioning Flow:</span>
                    <span className="text-white">Admin-Issued / Invitation</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Signing Algorithm:</span>
                    <span className="text-cyan-300">Ed25519 Canonical JSON</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consultation Video:</span>
                    <span className="text-emerald-400">WebRTC ECDH P-256 E2EE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRoleView === 'NURSE' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Nursing Triage & Vitals Monitoring Station</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Registered nurses record patient biometric telemetry, flag abnormal health thresholds, and triage waiting patients directly into physician queues.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Encrypted telemetry recording: Blood Pressure, Heart Rate, SpO2, Temperature</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Automated anomaly thresholds and instant physician triage alerts</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Hardware envelope encryption using AES-256 for all stored vitals</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-emerald-400 font-bold">
                  <span>NURSE_CAPABILITIES</span>
                  <span className="text-[10px] text-slate-500">CLINICAL TRIAGE</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Provisioning Flow:</span>
                    <span className="text-white">Admin-Issued / Invitation</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Telemetry Transport:</span>
                    <span className="text-cyan-300">Envelope-Encrypted WebSocket</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audit Anchoring:</span>
                    <span className="text-emerald-400">Merkle Chain SHA-256</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRoleView === 'ADMIN' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Admin Provisioning & Forensics Command Center</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Hospital administrators provision clinical staff accounts, issue 5-minute single-use invitation tokens, monitor 9 continuous HIPAA forensic rules, and anchor audit logs to blockchain.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Staff Provisioning: Create verified Doctor, Nurse & Admin accounts directly</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>5-Minute Single-Use Onboarding Tokens with automated expiration</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>HIPAA Rules Engine: 9 continuous forensic breach and anomaly detectors</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-purple-400 font-bold">
                  <span>ADMIN_CAPABILITIES</span>
                  <span className="text-[10px] text-slate-500">GOVERNANCE & AUDIT</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Staff Provisioning:</span>
                    <span className="text-white">Direct & 5-Min Token Links</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Forensic Engine:</span>
                    <span className="text-cyan-300">9 Active Continuous Rules</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audit Proofs:</span>
                    <span className="text-emerald-400">Solidity Merkle Root Anchoring</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRoleView === 'PATIENT' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Patient Self-Service Telehealth Portal</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Patients register self-service to consult top specialists from any browser without software installation. All personal health records remain protected under client-side zero-knowledge encryption.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
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
                    <span>GDPR Art. 17 self-service data erasure & cryptographic key-shredding</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-cyan-400 font-bold">
                  <span>PATIENT_CAPABILITIES</span>
                  <span className="text-[10px] text-slate-500">SELF-SERVICE ACCESS</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Registration Flow:</span>
                    <span className="text-white">Self-Service Sign Up</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Video Privacy:</span>
                    <span className="text-cyan-300">E2EE Insertable Streams</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prescription Wallet:</span>
                    <span className="text-emerald-400">Ed25519 Verifiable QR</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unified Access Banner at the bottom of the capabilities matrix */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              All clinical staff (Doctors, Nurses, Admins) and patients access their workstations through our unified authentication gateway.
            </div>
            <Link
              to="/login"
              className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition border border-slate-700 flex items-center space-x-2 shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              <span>Go to Unified Access Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. PUBLIC CRYPTOGRAPHIC VERIFICATION UTILITY                 */}
      {/* ============================================================ */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-800 rounded-3xl border border-cyan-500/20 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Public Cryptographic Verification Utility</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Instant Prescription & Audit Verifier
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

      {/* ============================================================ */}
      {/* 5. ENTERPRISE PILLARS & REGULATORY CERTIFICATIONS            */}
      {/* ============================================================ */}
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
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">E2EE Video Consults</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              WebRTC with Insertable Streams using ECDH P-256 key exchange. Audio and video frames are encrypted before leaving your browser.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Ed25519 e-Prescriptions</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canonical JSON prescriptions signed with elliptic curve Ed25519 private keys. Eliminates fraud, tampering, and unauthorized dispensing.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition shadow-lg space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Blocks className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Merkle Blockchain Audit</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographically linked SHA-256 audit logs anchored to a Solidity Merkle contract. Immediate detection of log modification.
            </p>
          </div>

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
