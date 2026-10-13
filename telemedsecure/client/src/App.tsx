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
import ConsultationCreate from './pages/ConsultationCreate';
import Home from './pages/Home';
import AppointmentScheduler from './pages/AppointmentScheduler';

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
              <Route path="/" element={<Home />} />
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
              <Route
                path="/consultations/new"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                    <ConsultationCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN', 'NURSE']}>
                    <AppointmentScheduler />
                  </ProtectedRoute>
                }
              />

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
