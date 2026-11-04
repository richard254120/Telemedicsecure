import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

/*
 * Every station is a code-split route. Previously all twenty page modules —
 * including the admin console, the forensics workbench, the WebRTC call room and
 * recharts — were imported eagerly, so a patient signing in downloaded the whole
 * hospital. `lazy()` gives the router a component that resolves only when the
 * route is visited, and Vite emits one chunk per station.
 */
const CallRoom = lazy(() => import('./pages/CallRoom'));
const VitalsDashboard = lazy(() => import('./pages/VitalsDashboard'));
const PrescriptionCreate = lazy(() => import('./pages/PrescriptionCreate'));
const PrescriptionView = lazy(() => import('./pages/PrescriptionView'));
const PrescriptionVerify = lazy(() => import('./pages/PrescriptionVerify'));
const PrescriptionList = lazy(() => import('./pages/PrescriptionList'));
const AuditIntegrityDashboard = lazy(() => import('./pages/AuditIntegrityDashboard'));
const ComplianceDashboard = lazy(() => import('./pages/ComplianceDashboard'));
const IncidentForensicsDashboard = lazy(() => import('./pages/IncidentForensicsDashboard'));
const ReportVerification = lazy(() => import('./pages/ReportVerification'));
const Login = lazy(() => import('./pages/Login'));
const ConsultationCreate = lazy(() => import('./pages/ConsultationCreate'));
const Home = lazy(() => import('./pages/Home'));
const AppointmentScheduler = lazy(() => import('./pages/AppointmentScheduler'));

const PatientDashboard = lazy(() => import('./pages/dashboards/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/dashboards/DoctorDashboard'));
const NurseDashboard = lazy(() => import('./pages/dashboards/NurseDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const StaffStationDashboard = lazy(() => import('./pages/dashboards/StaffStationDashboard'));

const RouteFallback = (
  <div className="min-h-[60vh] bg-slate-900 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
    <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    <span>Loading station…</span>
  </div>
);

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
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-8" />
      <h2 className="text-2xl font-bold text-white mb-2">Secure Waiting Room</h2>
      <p className="text-slate-400 mb-8 max-w-sm">
        Deriving ECDH P-256 session parameters. Waiting for clinical session to connect...
      </p>
      {id && (
        <button
          onClick={() => navigate(`/call/${id}`)}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-8 rounded-2xl transition shadow-xl shadow-emerald-600/20"
        >
          Clinician Ready (Enter E2EE Call)
        </button>
      )}
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
            <Suspense fallback={RouteFallback}>
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

                {/* Clinical Hospital Roles Dashboards */}
                <Route
                  path="/pharmacist"
                  element={
                    <ProtectedRoute allowedRoles={['PHARMACIST', 'ADMIN']}>
                      <StaffStationDashboard stationRole="PHARMACIST" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lab_technician"
                  element={
                    <ProtectedRoute allowedRoles={['LAB_TECHNICIAN', 'ADMIN']}>
                      <StaffStationDashboard stationRole="LAB_TECHNICIAN" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/radiologist"
                  element={
                    <ProtectedRoute allowedRoles={['RADIOLOGIST', 'ADMIN']}>
                      <StaffStationDashboard stationRole="RADIOLOGIST" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing_officer"
                  element={
                    <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'ADMIN']}>
                      <StaffStationDashboard stationRole="BILLING_OFFICER" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'ADMIN']}>
                      <StaffStationDashboard stationRole="BILLING_OFFICER" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/triage_officer"
                  element={
                    <ProtectedRoute allowedRoles={['TRIAGE_OFFICER', 'NURSE', 'ADMIN']}>
                      <StaffStationDashboard stationRole="TRIAGE_OFFICER" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/care_coordinator"
                  element={
                    <ProtectedRoute allowedRoles={['CARE_COORDINATOR', 'ADMIN']}>
                      <StaffStationDashboard stationRole="CARE_COORDINATOR" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/receptionist"
                  element={
                    <ProtectedRoute allowedRoles={['RECEPTIONIST', 'ADMIN']}>
                      <StaffStationDashboard stationRole="RECEPTIONIST" />
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
            </Suspense>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
