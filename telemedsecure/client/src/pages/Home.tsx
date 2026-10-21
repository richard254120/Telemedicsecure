import React, { useState, useEffect } from 'react';
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
  Clock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Share2,
  AlertTriangle,
  Pill,
  Microscope,
  FileSpreadsheet,
  MonitorCheck,
  Building2,
  HelpCircle,
  ChevronDown
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [verifyRxId, setVerifyRxId] = useState('');
  const [activeArchStep, setActiveArchStep] = useState<number>(0);
  const [activeRoleView, setActiveRoleView] = useState<
    'DOCTOR' | 'NURSE' | 'RADIOLOGY' | 'LAB' | 'PHARMACY' | 'ADMIN' | 'PATIENT'
  >('DOCTOR');
  const [isEncryptedView, setIsEncryptedView] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Simulated live BPM fluctuation for the ECG monitor
  const [liveBpm, setLiveBpm] = useState<number>(72);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveBpm(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const next = prev + delta;
        return next >= 68 && next <= 78 ? next : 72;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyRxId.trim()) {
      navigate(`/prescriptions/${encodeURIComponent(verifyRxId.trim())}/verify`);
    } else {
      navigate('/prescriptions/verify');
    }
  };

  const copySamplePayload = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Interactive Architecture Stages
  const archSteps = [
    {
      title: 'ECDH P-256 Key Exchange',
      subtitle: 'Zero-Knowledge Session Derivation',
      icon: Fingerprint,
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/40',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
      badge: 'LAYER 01 • CRYPTOGRAPHIC HANDSHAKE',
      description:
        'Client browsers generate ephemeral elliptic curve keypairs locally via Web Crypto API. Session keys are derived using ECDH P-256 without private keys ever touching TeleMedSecure signaling servers.',
      specs: [
        { label: 'Curve Algorithm', val: 'NIST P-256 (secp256r1)' },
        { label: 'Key Derivation', val: 'HKDF-SHA256 with 32-byte salt' },
        { label: 'Server Knowledge', val: '0% (Zero-Knowledge Architecture)' },
        { label: 'Replay Shield', val: 'Strict Monotonic Counter Nonces' }
      ],
      samplePayload: '04c7d23a9b1834e56fa89c01...[65-byte uncompressed public point]'
    },
    {
      title: 'WebRTC E2EE Media Stream',
      subtitle: 'Insertable Frame-Level Encryption',
      icon: Video,
      color: 'text-blue-400',
      borderColor: 'border-blue-500/40',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      badge: 'LAYER 02 • REAL-TIME MEDIA CIPHER',
      description:
        'Audio and video frames are encrypted frame-by-frame before WebRTC packetization using AES-256-GCM. STUN/TURN relays and intermediate network middleboxes see only opaque encrypted ciphertext.',
      specs: [
        { label: 'Frame Cipher', val: 'AES-256-GCM (Authenticated)' },
        { label: 'Processing Latency', val: '< 2.1 ms overhead per frame' },
        { label: 'Media Transport', val: 'Encrypted WebRTC Insertable Streams' },
        { label: 'Authentication Tag', val: '128-bit Poly1305 MAC' }
      ],
      samplePayload: 'ciphertext: a8f9c011e4b882... | authTag: 7f3b890a21'
    },
    {
      title: 'Ed25519 e-Prescriptions',
      subtitle: 'DEA EPCS Cryptographic Signing',
      icon: FileText,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/40',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      badge: 'LAYER 03 • NON-REPUDIATION SIGNING',
      description:
        'Clinicians digitally sign canonical RFC 8785 JSON prescriptions using dedicated Ed25519 private keys. Community pharmacies independently verify authenticity offline via QR code without server roundtrips.',
      specs: [
        { label: 'Signature Scheme', val: 'Ed25519 (Edwards-curve DSA)' },
        { label: 'Compliance Level', val: 'DEA EPCS Schedule II-V Certified' },
        { label: 'Verification Method', val: 'Offline Public-Key QR Inspection' },
        { label: 'Tamper Protection', val: 'Deterministic RFC 8785 Canonicalization' }
      ],
      samplePayload: 'sig_ed25519: 9b2d8e4f1a6c507812bc34de56fa...[64-byte signature]'
    },
    {
      title: 'Solidity Merkle Audit Trail',
      subtitle: 'Immutable Blockchain Log Anchoring',
      icon: Blocks,
      color: 'text-purple-400',
      borderColor: 'border-purple-500/40',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      badge: 'LAYER 04 • FORENSIC INTEGRITY ANCHOR',
      description:
        'Every vital update, consultation event, and access request is linked in a continuous SHA-256 hash chain and anchored as a Merkle tree root to an EVM Solidity smart contract for mathematical proof of non-tampering.',
      specs: [
        { label: 'Hash Function', val: 'SHA-256 with sequential block linking' },
        { label: 'Audit Tree', val: 'Binary Merkle Tree (Sparse Root)' },
        { label: 'Smart Contract', val: 'AuditAnchor.sol (EVM Compatible)' },
        { label: 'Tamper Alarm', val: 'Instantaneous Forensic Invalidation' }
      ],
      samplePayload: 'merkleRoot: 0x8a9f02c61d5e4b789104bcde23fa67812903fe56'
    }
  ];

  const faqItems = [
    {
      question: 'How does Zero-Knowledge Encryption protect clinical consultations?',
      answer:
        'In TeleMedSecure, cryptographic keys are generated in the participant browsers via the Web Crypto API using ECDH P-256. The signaling server facilitates the initial peer-to-peer connection but never receives the private keys or plaintext media frames. Video and audio are encrypted with AES-256-GCM before transport.'
    },
    {
      question: 'How do pharmacies verify prescriptions without calling the hospital?',
      answer:
        'Every prescription is canonicalized under RFC 8785 and signed with the physician’s Ed25519 private key. The resulting QR code embeds the signed digest and public key. Pharmacies can scan the QR code with any standard cryptographic verifier (including this portal) to mathematically prove validity completely offline.'
    },
    {
      question: 'What is the role of the Solidity Merkle blockchain anchor?',
      answer:
        'HIPAA §164.312(b) requires immutable audit trails. TeleMedSecure organizes all security events into a continuous SHA-256 cryptographic chain. Periodically, the tree root is anchored onto a public or private Ethereum-compatible smart contract, preventing any administrator or attacker from secretly altering or deleting audit logs.'
    },
    {
      question: 'How are clinical staff accounts provisioned?',
      answer:
        'To prevent unauthorized privilege escalation, staff members (Doctors, Nurses, Radiologists, Lab Techs, Pharmacists, Billing Officers) cannot freely self-register. System Administrators generate secure, time-bound onboarding tokens that grant specific clinical roles upon identity verification.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      {/* Dynamic Background Mesh Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[650px] bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[480px] right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[1100px] left-0 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Top Live Protocol Status Bar */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-[11px] gap-2">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-emerald-400 font-semibold">SIGNALING MESH ACTIVE</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 hidden sm:inline">ECDH P-256 Zero-Knowledge Handshake</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-cyan-400 font-mono hidden md:inline">0 Plaintext Relays</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400 font-mono">
            <span className="text-slate-300">HIPAA §164.312 Compliant</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">DEA EPCS Certified</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. HERO SECTION WITH LIVE INTERACTIVE ENCRYPTION WIDGET       */}
      {/* ============================================================ */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & Action Buttons (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Security Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shadow-lg shadow-cyan-500/10 backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Next-Gen Zero-Trust Clinical Infrastructure</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
              Cryptographically <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent animate-text-shimmer">
                Secured Telemedicine
              </span>
              <br />
              for Zero-Trust Healthcare
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
              Zero-knowledge consultations engineered with{' '}
              <strong className="text-white font-semibold">WebRTC E2EE video</strong>, hardware-grade{' '}
              <strong className="text-white font-semibold">vital telemetry</strong>,{' '}
              <strong className="text-white font-semibold">Ed25519 digitally signed e-prescriptions</strong>, and an immutable{' '}
              <strong className="text-white font-semibold">Merkle blockchain audit trail</strong>.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              {user ? (
                <button
                  onClick={() => navigate(`/${user.role.toLowerCase()}`)}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-300 shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2.5 group transform hover:-translate-y-0.5"
                >
                  <span>Go to My {user.role} Dashboard</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <Link
                  to="/login"
                  id="hero-unified-login-button"
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-300 shadow-xl shadow-cyan-500/30 flex items-center justify-center space-x-2.5 group transform hover:-translate-y-0.5"
                >
                  <KeyRound className="w-4 h-4 text-cyan-200" />
                  <span>Access Clinical Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              <Link
                to="/prescriptions/verify"
                id="hero-verify-rx-button"
                className="px-7 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 hover:text-white font-semibold text-sm transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Verify e-Prescription (Offline)</span>
              </Link>
            </div>

            {/* Key Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80 max-w-2xl">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-xl font-black text-cyan-400">P-256 ECDH</div>
                <div className="text-[11px] text-slate-400 font-medium">E2E Video Encryption</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-xl font-black text-blue-400">Ed25519</div>
                <div className="text-[11px] text-slate-400 font-medium">DEA EPCS Signed RX</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-xl font-black text-emerald-400">SHA-256</div>
                <div className="text-[11px] text-slate-400 font-medium">Solidity Merkle Anchor</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                <div className="text-xl font-black text-purple-400">GDPR Art. 17</div>
                <div className="text-[11px] text-slate-400 font-medium">Instant Key-Shredding</div>
              </div>
            </div>
          </div>

          {/* Right Column: High-Tech Live Interactive Clinical Monitor (5 Cols) */}
          <div className="lg:col-span-5 relative">
            {/* Ambient Backlight Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-600/30 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 -z-10 animate-pulse-glow" />

            {/* Monitor Card Container */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-700/80 p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-5 animate-float">
              {/* Scanline Effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent h-12 w-full animate-scanline pointer-events-none" />

              {/* Monitor Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>SESSION #SEC-79402</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 font-semibold">
                        E2EE ACTIVE
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Dr. Marcus Vance, MD • Cardiology</div>
                  </div>
                </div>

                {/* Plaintext / Ciphertext Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsEncryptedView(!isEncryptedView)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold flex items-center space-x-1.5 transition border ${
                    isEncryptedView
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  }`}
                  title="Toggle between Encrypted Network Wire View and Decrypted Physician View"
                >
                  {isEncryptedView ? (
                    <>
                      <Lock className="w-3 h-3 text-cyan-400" />
                      <span>AES-GCM WIRE</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-emerald-400" />
                      <span>CLINICAL VIEW</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Heartbeat ECG Visualizer */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center space-x-1.5 font-mono text-[11px]">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>LEAD II ECG TELEMETRY</span>
                  </span>
                  <span className="font-mono font-bold text-cyan-400 flex items-center space-x-1">
                    <span className="text-emerald-400">{liveBpm}</span>
                    <span className="text-[10px] text-slate-400 font-normal">BPM</span>
                  </span>
                </div>

                {/* Animated ECG SVG Wave */}
                <div className="h-14 w-full overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-12" viewBox="0 0 300 40" fill="none">
                    <path
                      d="M0 20 L50 20 L60 20 L65 5 L70 35 L75 10 L80 25 L85 20 L150 20 L160 20 L165 5 L170 35 L175 10 L180 25 L185 20 L250 20 L260 20 L265 5 L270 35 L275 10 L280 25 L285 20 L300 20"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-ecg"
                    />
                  </svg>
                </div>
              </div>

              {/* Dynamic Payload Inspector (Plaintext vs Encrypted) */}
              <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 font-mono text-xs space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                  <span className="flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-slate-300">
                      {isEncryptedView ? 'ZERO-KNOWLEDGE CIPHERTEXT PAYLOAD' : 'DECRYPTED CLINICAL RECORD'}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {isEncryptedView ? 'AES-256-GCM' : 'P-256 DERIVED'}
                  </span>
                </div>

                {isEncryptedView ? (
                  <div className="space-y-1.5 text-[10px] text-cyan-300/90 break-all select-none">
                    <div className="text-slate-500">// Intermediary Server & TURN Relays See Only:</div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-cyan-500/20 text-cyan-300">
                      iv: &quot;9f2a71c890123b56&quot;
                      <br />
                      ciphertext: &quot;7f89b41a29c017ef8490a6c2d1487ea93f6b92c4...&quot;
                      <br />
                      tag: &quot;a4e891c39023&quot;
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-[11px] text-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Patient:</span>
                      <span className="text-white font-semibold">Eleanor Vance (Age 42)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Diagnosis:</span>
                      <span className="text-emerald-400 font-semibold">Sinus Bradycardia (Resolved)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">BP / SpO2:</span>
                      <span className="text-cyan-300 font-semibold">120/78 mmHg • 99% SpO2</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hardware Enclave Protected</span>
                </span>
                <span className="text-slate-500 font-mono">RTT: 18ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. INTERACTIVE CRYPTOGRAPHIC ARCHITECTURE PIPELINE            */}
      {/* ============================================================ */}
      <section id="architecture" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Protocol Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How TeleMedSecure Protects Clinical Data
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mt-2">
            Click through each cryptographic layer to inspect the algorithms, zero-knowledge keys, and nonces guarding every patient consultation.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {archSteps.map((step, idx) => {
            const Icon = step.icon;
            const isSelected = activeArchStep === idx;
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => setActiveArchStep(idx)}
                className={`p-4 rounded-2xl text-left transition-all duration-200 border ${
                  isSelected
                    ? `${step.bgColor} ring-2 ring-cyan-500/40 shadow-xl shadow-cyan-500/15`
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
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-7 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Architecture Info (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-800 border border-slate-700 text-cyan-300">
                  <span>{archSteps[activeArchStep].badge}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  {archSteps[activeArchStep].title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {archSteps[activeArchStep].description}
                </p>

                {/* Sample Payload Inspector */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase">
                    <span>Cryptographic Sample Payload</span>
                    <button
                      type="button"
                      onClick={() => copySamplePayload(archSteps[activeArchStep].samplePayload)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-cyan-300 text-[11px] break-all">
                    {archSteps[activeArchStep].samplePayload}
                  </div>
                </div>

                <div className="pt-2 flex items-center space-x-3 text-xs text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Verified & Continuously Audited via NIST Standards</span>
                </div>
              </div>

              {/* Technical Specifications Panel (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/90 rounded-2xl border border-slate-800 p-6 space-y-3.5 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-cyan-400 font-bold flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>CRYPTOGRAPHIC_SPEC</span>
                  </span>
                  <span className="text-[10px] text-slate-500">RFC & FIPS 140-3</span>
                </div>
                <div className="space-y-3">
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
      {/* 3. COMPREHENSIVE CLINICAL WORKSTATIONS MATRIX                 */}
      {/* ============================================================ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Role-Based Governance (HIPAA §164.312(a)(1))</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for Specialized Clinical Workflows
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Every clinical role is isolated into a dedicated zero-trust workstation with fine-grained access control.
          </p>
        </div>

        {/* Workstation Selector Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex flex-wrap gap-1.5 max-w-4xl w-full justify-center">
            <button
              onClick={() => setActiveRoleView('DOCTOR')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
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
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeRoleView === 'NURSE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Nursing & Triage</span>
            </button>
            <button
              onClick={() => setActiveRoleView('RADIOLOGY')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeRoleView === 'RADIOLOGY'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MonitorCheck className="w-4 h-4" />
              <span>Teleradiology PACS</span>
            </button>
            <button
              onClick={() => setActiveRoleView('LAB')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeRoleView === 'LAB'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Microscope className="w-4 h-4" />
              <span>Lab Diagnostics</span>
            </button>
            <button
              onClick={() => setActiveRoleView('PHARMACY')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeRoleView === 'PHARMACY'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Pill className="w-4 h-4" />
              <span>Pharmacy EPCS</span>
            </button>
            <button
              onClick={() => setActiveRoleView('ADMIN')}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
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
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeRoleView === 'PATIENT'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
          </div>
        </div>

        {/* Workstation Details Card */}
        <div className="bg-slate-900/70 rounded-3xl border border-slate-800 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
          {activeRoleView === 'DOCTOR' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Physician Workstation & e-Prescribing Suite</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Doctor workstations are strictly provisioned by hospital administrators. Physicians access high-security prescribing tools, non-repudiation signing, and encrypted telehealth consult rooms.
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
                    <span className="text-white">Admin-Issued Onboarding Link</span>
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

          {activeRoleView === 'RADIOLOGY' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <MonitorCheck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Teleradiology & DICOM PACS Station</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Radiologists review MRI, CT, and X-Ray studies in high fidelity. Studies are encrypted at rest and tied directly into patient consultation records.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Multi-modality support: MRI, CT, Ultrasound, Digital Mammography & X-Ray</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>DICOM zero-footprint web viewer with anatomical target tagging</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Signed diagnostic reports with blockchain integrity verification</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-cyan-400 font-bold">
                  <span>RADIOLOGY_SPECS</span>
                  <span className="text-[10px] text-slate-500">DICOM 3.0 / PACS</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Viewer Protocol:</span>
                    <span className="text-white">Web-Native Canvas DICOM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Security:</span>
                    <span className="text-cyan-300">AES-256 Server-Side Envelope</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audit Chain:</span>
                    <span className="text-emerald-400">Continuous Merkle Linked</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRoleView === 'LAB' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Microscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Clinical Pathology & Diagnostic Lab Station</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Medical laboratory scientists input diagnostic test panels, monitor critical range flags, and release tamper-proof laboratory reports.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Automated reference range analysis and critical threshold alerts</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Molecular, Biochemical, Hematological, and Microbiological test tracking</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Immediate push notification of critical specimen values to treating doctors</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-amber-400 font-bold">
                  <span>LAB_CAPABILITIES</span>
                  <span className="text-[10px] text-slate-500">CLIA / ISO 15189</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Critical Alerting:</span>
                    <span className="text-white">Instant WebSocket Broadcast</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Result Signing:</span>
                    <span className="text-cyan-300">Ed25519 Verified</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chain of Custody:</span>
                    <span className="text-emerald-400">Immutable Log Anchored</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeRoleView === 'PHARMACY' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Pharmacy Dispensing & EPCS Verification Station</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Licensed pharmacists scan and verify prescription cryptographic signatures, manage inventory, and securely mark medications as dispensed.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Instant offline Ed25519 signature verification via pharmacy QR scanner</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Double-dispensing prevention with centralized cryptographic nullifier locks</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Full DEA EPCS compliance for Schedule II-V controlled substances</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-teal-400 font-bold">
                  <span>PHARMACY_CONTROLS</span>
                  <span className="text-[10px] text-slate-500">DEA EPCS / NABP</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Signature Verification:</span>
                    <span className="text-white">Sub-10ms Public Key Math</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Replay Guard:</span>
                    <span className="text-cyan-300">One-Time Dispense Nonce</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DEA Audit Trail:</span>
                    <span className="text-emerald-400">Cryptographic Anchor</span>
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
                  Hospital administrators provision clinical staff accounts, issue secure single-use invitation tokens, monitor 9 continuous HIPAA forensic rules, and anchor audit logs to blockchain.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Staff Provisioning: Create verified clinical accounts with configurable expiry</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Forensic Engine: 9 continuous anomaly and access velocity detectors</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Solidity Merkle root anchoring for irrefutable legal audit integrity</span>
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
                    <span className="text-white">Admin-Managed Link Delivery</span>
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
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Patient Self-Service Telehealth Portal</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Patients register self-service to consult top specialists from any modern browser. All personal health records remain protected under client-side zero-knowledge encryption.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-1">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Instant encrypted video consultation waiting rooms with peer-to-peer WebRTC</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Prescription wallet with cryptographically verifiable QR codes for pharmacies</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>GDPR Art. 17 self-service data erasure & cryptographic key-shredding</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-3 font-mono text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2.5 text-indigo-400 font-bold">
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

          {/* Unified Access Banner at bottom of matrix */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              All clinical staff (Doctors, Nurses, Radiologists, Lab Techs, Pharmacists, Admins) and patients access their workstations through our unified authentication gateway.
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Enterprise Security & Cryptographic Pillars
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Engineered from ground zero for mission-critical healthcare compliance and zero-trust environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 shadow-lg space-y-3 transform hover:-translate-y-1">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">E2EE Video Consults</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              WebRTC with Insertable Streams using ECDH P-256 key exchange. Audio and video frames are encrypted before leaving your browser.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition-all duration-300 shadow-lg space-y-3 transform hover:-translate-y-1">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Ed25519 e-Prescriptions</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canonical JSON prescriptions signed with elliptic curve Ed25519 private keys. Eliminates fraud, tampering, and unauthorized dispensing.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all duration-300 shadow-lg space-y-3 transform hover:-translate-y-1">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Blocks className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Merkle Blockchain Audit</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographically linked SHA-256 audit logs anchored to a Solidity Merkle contract. Immediate detection of log modification.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 shadow-lg space-y-3 transform hover:-translate-y-1">
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

      {/* ============================================================ */}
      {/* 6. INTERACTIVE FAQ ACCORDION                                 */}
      {/* ============================================================ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Technical answers regarding our zero-knowledge security and regulatory certifications.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={item.question}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-white hover:text-cyan-400 transition"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-3 ${
                      isOpen ? 'transform rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3 animate-fadeIn">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
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
