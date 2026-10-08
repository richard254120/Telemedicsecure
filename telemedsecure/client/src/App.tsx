import React from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import CallRoom from './pages/CallRoom';
import VitalsDashboard from './pages/VitalsDashboard';
import PrescriptionCreate from './pages/PrescriptionCreate';
import PrescriptionView from './pages/PrescriptionView';
import PrescriptionVerify from './pages/PrescriptionVerify';
import PrescriptionList from './pages/PrescriptionList';
import AuditIntegrityDashboard from './pages/AuditIntegrityDashboard';
import ComplianceDashboard from './pages/ComplianceDashboard';
import IncidentForensicsDashboard from './pages/IncidentForensicsDashboard';
import ReportVerification from './pages/ReportVerification';
import Login from './pages/Login';

import PatientDashboard from './pages/dashboards/PatientDashboard';
import DoctorDashboard from './pages/dashboards/DoctorDashboard';
import NurseDashboard from './pages/dashboards/NurseDashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';

import {
  Video,
  HeartPulse,
  FileText,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Blocks,
  ShieldAlert,
  User,
  Stethoscope,
  Users,
  KeyRound
} from 'lucide-react';

function DashboardRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Validating identity credentials...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
}

function AppointmentList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-Knowledge Architecture • HIPAA & DEA EPCS Ready</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">TeleMedSecure Clinical Portal</h1>
          <p className="text-slate-400 mt-2 text-base">
            End-to-End Encrypted Telemedicine, Encrypted Vitals, and Ed25519 Cryptographically Signed Prescriptions
          </p>
        </div>

        {/* Role-Based Dashboard Fast Access Banners */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Role-Based Workstations
            </span>
            <span className="text-xs text-cyan-400 font-mono">
              Active: {user ? `${user.role} (${user.firstName} ${user.lastName})` : 'Guest'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Doctor */}
            <div
              onClick={() => navigate('/doctor')}
              className="p-5 rounded-3xl bg-slate-800/80 border border-blue-500/30 hover:border-blue-400 hover:bg-slate-800 transition cursor-pointer shadow-lg space-y-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Doctor Workstation</h3>
                <p className="text-xs text-slate-400 mt-0.5">Schedule, Consultations, e-Prescribe, Vitals</p>
              </div>
              <div className="text-xs font-semibold text-blue-400 flex items-center space-x-1">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Patient */}
            <div
              onClick={() => navigate('/patient')}
              className="p-5 rounded-3xl bg-slate-800/80 border border-cyan-500/30 hover:border-cyan-400 hover:bg-slate-800 transition cursor-pointer shadow-lg space-y-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Patient Portal</h3>
                <p className="text-xs text-slate-400 mt-0.5">Appointments, Records, Prescriptions, GDPR</p>
              </div>
              <div className="text-xs font-semibold text-cyan-400 flex items-center space-x-1">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Nurse */}
            <div
              onClick={() => navigate('/nurse')}
              className="p-5 rounded-3xl bg-slate-800/80 border border-emerald-500/30 hover:border-emerald-400 hover:bg-slate-800 transition cursor-pointer shadow-lg space-y-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Nursing Station</h3>
                <p className="text-xs text-slate-400 mt-0.5">Vitals Entry, Flags, Assigned Patients</p>
              </div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Admin */}
            <div
              onClick={() => navigate('/admin')}
              className="p-5 rounded-3xl bg-slate-800/80 border border-purple-500/30 hover:border-purple-400 hover:bg-slate-800 transition cursor-pointer shadow-lg space-y-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Compliance & Admin</h3>
                <p className="text-xs text-slate-400 mt-0.5">RBAC, RX Audit, Rules, Forensics</p>
              </div>
              <div className="text-xs font-semibold text-purple-400 flex items-center space-x-1">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Hub Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Card 1: E2EE Video */}
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/70 hover:border-blue-500/50 transition shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">E2EE Consultations</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                WebRTC video with ECDH P-256 and AES-GCM Insertable Streams.
              </p>
            </div>
            <button
              onClick={() => navigate('/waiting-room/demo-123')}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
            >
              <span>Join Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Vitals */}
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/70 hover:border-emerald-500/50 transition shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <HeartPulse className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Encrypted Vitals</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vital signs capture with AES-256 envelope encryption & flags.
              </p>
            </div>
            <button
              onClick={() => navigate('/vitals/demo-123')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2"
            >
              <span>Vitals Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: Prescriptions */}
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/70 hover:border-cyan-500/50 transition shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Ed25519 Prescriptions</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Digitally signed canonical JSON with full lifecycle tracking.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/prescriptions')}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
              >
                List
              </button>
              <button
                onClick={() => navigate('/prescriptions/new')}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/30 flex items-center justify-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Issue</span>
              </button>
            </div>
          </div>

          {/* Card 4: Audit Blockchain Anchor */}
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/70 hover:border-purple-500/50 transition shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Blocks className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Audit Blockchain Anchor</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                SHA-256 hash-chaining anchored to Solidity Merkle contract.
              </p>
            </div>
            <button
              onClick={() => navigate('/integrity')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2"
            >
              <span>Audit Integrity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 5: Compliance Rules & GDPR */}
          <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/70 hover:border-red-500/50 transition shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Compliance Rules Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                9 HIPAA/GDPR detection rules, live alerts & crypto-shredding.
              </p>
            </div>
            <button
              onClick={() => navigate('/compliance')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-semibold text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center space-x-2"
            >
              <span>Compliance Hub</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Appointments List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Today's Scheduled Consultations</span>
          </h2>

          <div className="grid gap-4">
            <div className="bg-slate-800/90 p-6 rounded-2xl shadow-lg border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-600 transition">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SCHEDULED
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Room: demo-123</span>
                </div>
                <h3 className="text-base font-bold text-white">Dr. Sarah Jenkins & Alice Smith</h3>
                <p className="text-xs text-slate-400">Cardiology Follow-up & Prescription Renewal • Today, 2:30 PM</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate('/waiting-room/demo-123')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center space-x-1.5"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Call</span>
                </button>
                <button
                  onClick={() => navigate('/vitals/demo-123')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
                >
                  <HeartPulse className="w-4 h-4" />
                  <span>Vitals</span>
                </button>
                <button
                  onClick={() => navigate('/prescriptions/new')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Issue RX</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitingRoom() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-8" />
      <h2 className="text-2xl font-bold text-white mb-2">Secure Waiting Room</h2>
      <p className="text-slate-400 mb-8 max-w-sm">
        Deriving ECDH P-256 session parameters. Waiting for doctor to establish peer connection...
      </p>
      <button
        onClick={() => navigate('/call/demo-123')}
        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-8 rounded-2xl transition shadow-xl shadow-emerald-600/20"
      >
        Doctor Connected (Enter E2EE Call)
      </button>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public & Clinical Root */}
              <Route path="/" element={<AppointmentList />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />

              {/* Step 11 Role-Based Dashboards */}
              <Route
                path="/patient"
                element={
                  <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/nurse"
                element={
                  <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
                    <NurseDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Consultation & Vitals */}
              <Route path="/waiting-room/:id" element={<WaitingRoom />} />
              <Route path="/call/:id" element={<CallRoom />} />
              <Route path="/vitals/:id" element={<VitalsDashboard />} />

              {/* Prescriptions & Verification */}
              <Route path="/prescriptions" element={<PrescriptionList />} />
              <Route
                path="/prescriptions/new"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                    <PrescriptionCreate />
                  </ProtectedRoute>
                }
              />
              <Route path="/prescriptions/:id" element={<PrescriptionView />} />
              <Route path="/prescriptions/:id/verify" element={<PrescriptionVerify />} />
              <Route path="/prescriptions/verify" element={<PrescriptionVerify />} />

              {/* Forensic & Audit Tools */}
              <Route
                path="/integrity"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AuditIntegrityDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compliance"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <ComplianceDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/investigation"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <IncidentForensicsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/investigation/verify" element={<ReportVerification />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
