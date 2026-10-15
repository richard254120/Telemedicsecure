import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { API_BASE } from '../config';
import {
  ShieldCheck,
  User,
  Stethoscope,
  HeartPulse,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  LockKeyhole,
  Clock,
  AlertTriangle,
  Ticket,
  UserPlus,
  ArrowRight,
  Shield
} from 'lucide-react';

export type LoginSection = 'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN' | 'INVITATION';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Active section tab: Patient, Doctor, Nurse, Admin, or Invitation Onboarding
  const [activeSection, setActiveSection] = useState<LoginSection>('DOCTOR');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpField, setShowTotpField] = useState(false);

  // Patient registration toggle (Self-service ONLY for Patients)
  const [isPatientRegister, setIsPatientRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Staff Invitation Token Onboarding state
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{ email: string; role: string; expiresAt: string; invitedBy?: any } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteExpired, setInviteExpired] = useState(false);
  const [medicalLicenseNo, setMedicalLicenseNo] = useState('');
  const [specialty, setSpecialty] = useState('');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Verify staff invitation token
  const verifyInvite = async (token: string) => {
    if (!token.trim()) return;
    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/invitations/${encodeURIComponent(token.trim())}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setInviteData(data);
        setEmail(data.email);
        setInviteToken(token.trim());
        setInviteExpired(false);
      } else {
        setInviteExpired(data.expired || false);
        setError(data.error || 'Invalid or expired invitation token');
      }
    } catch (e) {
      console.error('Verify invite error:', e);
      setError('Failed to reach server to verify invitation token');
    } finally {
      setInviteLoading(false);
    }
  };

  // Parse section and invite from URL queries (e.g. /login?role=doctor, /login?portal=staff, /login?invite=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalParam = params.get('portal');
    const roleParam = params.get('role');
    const emailParam = params.get('email');
    const inviteParam = params.get('invite');

    if (inviteParam) {
      setActiveSection('INVITATION');
      setInviteTokenInput(inviteParam);
      verifyInvite(inviteParam);
    } else if (roleParam) {
      const upper = roleParam.toUpperCase();
      if (upper === 'DOCTOR' || upper === 'NURSE' || upper === 'ADMIN' || upper === 'PATIENT') {
        setActiveSection(upper as LoginSection);
      }
    } else if (portalParam === 'staff') {
      setActiveSection('DOCTOR');
    } else if (portalParam === 'patient') {
      setActiveSection('PATIENT');
    }

    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location.search]);

  // Handle section change
  const handleSectionSelect = (section: LoginSection) => {
    setActiveSection(section);
    setError(null);
    setSuccessMessage(null);
    setValidationErrors({});
    setIsPatientRegister(false);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (isPatientRegister || (activeSection === 'INVITATION' && inviteData)) {
      if (!firstName || firstName.trim().length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
      }
      if (!lastName || lastName.trim().length < 2) {
        errors.lastName = 'Last name must be at least 2 characters';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit standard login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    setLoading(true);

    if (activeSection === 'PATIENT' && isPatientRegister) {
      // Patient self-registration
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim()
          })
        });

        const data = await res.json();
        if (res.ok) {
          setSuccessMessage('Patient account created successfully! You can now sign in.');
          setIsPatientRegister(false);
          setPassword('');
          setValidationErrors({});
        } else {
          setError(data.error || 'Registration failed. Please check your details.');
        }
      } catch (err) {
        console.error('Registration network error:', err);
        setError('Network error. Unable to reach authentication server.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Unified sign in for Doctor, Nurse, Admin, or Patient
    const res = await login(email.trim().toLowerCase(), password);
    if (res.success) {
      // Direct navigation to user's authorized role dashboard
      const storedUser = localStorage.getItem('telemed_user');
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      const rolePath = parsed?.role ? `/${parsed.role.toLowerCase()}` : '/dashboard';
      navigate(rolePath);
    } else {
      setError(res.error || 'Invalid email or password.');
    }
    setLoading(false);
  };

  // Staff onboarding registration via invitation token
  const handleStaffOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken || !inviteData) return;
    setError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationToken: inviteToken,
          email: inviteData.email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          medicalLicenseNo: medicalLicenseNo.trim() || undefined,
          specialty: specialty.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Account registered and verified as ${data.user.role}! Signing you in...`);
        if (data.accessToken && data.user) {
          localStorage.setItem('telemed_token', data.accessToken);
          localStorage.setItem('telemed_user', JSON.stringify(data.user));
          setTimeout(() => {
            window.location.href = `/${data.user.role.toLowerCase()}`;
          }, 1000);
        } else {
          await login(inviteData.email, password);
          navigate(`/${data.user.role.toLowerCase()}`);
        }
      } else {
        if (data.expired) setInviteExpired(true);
        setError(data.error || 'Failed to complete staff onboarding');
      }
    } catch (err: any) {
      console.error('Staff onboarding error:', err);
      setError('Network error during staff onboarding.');
    } finally {
      setLoading(false);
    }
  };

  // Section-specific metadata
  const getSectionMetadata = () => {
    switch (activeSection) {
      case 'DOCTOR':
        return {
          title: 'Physician Workstation',
          subtitle: 'Licensed Physicians, Specialists & Prescribers',
          badge: 'CLINICAL PRACTITIONER',
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          gradient: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25',
          borderActive: 'border-blue-500/50',
          notice: 'Doctor accounts are provisioned directly by Healthcare Administration. Sign in with the credentials issued to you to access DEA EPCS e-prescribing and E2EE video consults.',
          emailPlaceholder: 'doctor.specialist@telemed.com',
          buttonText: 'Sign In to Doctor Station'
        };
      case 'NURSE':
        return {
          title: 'Nursing & Triage Station',
          subtitle: 'Registered Nurses, Clinical Staff & Triage',
          badge: 'CLINICAL TRIAGE',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          gradient: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25',
          borderActive: 'border-emerald-500/50',
          notice: 'Nursing accounts are provisioned by Healthcare Administration. Sign in to capture encrypted patient vitals, monitor telemetry, and manage clinical consultation queues.',
          emailPlaceholder: 'nurse.practitioner@telemed.com',
          buttonText: 'Sign In to Nursing Station'
        };
      case 'ADMIN':
        return {
          title: 'Hospital Admin & Forensics',
          subtitle: 'System Administrators, Compliance Officers & Auditors',
          badge: 'SECURITY & GOVERNANCE',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          gradient: 'from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25',
          borderActive: 'border-purple-500/50',
          notice: 'Restricted administrative zone. Enforcing clinical RBAC, staff provisioning, 9 continuous HIPAA forensic rules, and Solidity Merkle audit chain verification.',
          emailPlaceholder: 'admin@telemed.com',
          buttonText: 'Sign In to Admin Command'
        };
      case 'PATIENT':
        return {
          title: isPatientRegister ? 'Create Patient Account' : 'Patient Telehealth Portal',
          subtitle: 'Patients, Family Members & Care Recipients',
          badge: 'PATIENT SELF-SERVICE',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          gradient: 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/25',
          borderActive: 'border-cyan-500/50',
          notice: isPatientRegister
            ? 'Patients can register self-service to book telehealth consultations and access cryptographically signed prescriptions.'
            : 'Access your appointments, consultations, and verified e-prescriptions in a zero-knowledge environment.',
          emailPlaceholder: 'patient@example.com',
          buttonText: isPatientRegister ? 'Create Patient Account' : 'Sign In to Patient Portal'
        };
      case 'INVITATION':
        return {
          title: 'Staff Invitation Onboarding',
          subtitle: 'Activate Single-Use Onboarding Token (5-Minute Window)',
          badge: 'TOKEN ONBOARDING',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          gradient: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25',
          borderActive: 'border-amber-500/50',
          notice: 'Single-use staff onboarding tokens expire strictly 5 minutes after generation. Enter your token below to complete your clinical registration.',
          emailPlaceholder: '',
          buttonText: 'Verify Token'
        };
    }
  };

  const meta = getSectionMetadata();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 text-center">
        <Link to="/" className="inline-flex justify-center group mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/25 group-hover:scale-105 transition">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          TeleMedSecure Unified Access Hub
        </h2>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          Zero-Trust Authentication • Select your authorized clinical or patient station below
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 space-y-4">
        {/* Navigation Sections Bar */}
        <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl grid grid-cols-2 sm:grid-cols-5 gap-1">
          {/* 1. Doctor */}
          <button
            type="button"
            id="nav-section-doctor"
            onClick={() => handleSectionSelect('DOCTOR')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
              activeSection === 'DOCTOR'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span className="text-[11px]">Doctor</span>
          </button>

          {/* 2. Nurse */}
          <button
            type="button"
            id="nav-section-nurse"
            onClick={() => handleSectionSelect('NURSE')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
              activeSection === 'NURSE'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            <span className="text-[11px]">Nurse</span>
          </button>

          {/* 3. Admin */}
          <button
            type="button"
            id="nav-section-admin"
            onClick={() => handleSectionSelect('ADMIN')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
              activeSection === 'ADMIN'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[11px]">Admin</span>
          </button>

          {/* 4. Patient */}
          <button
            type="button"
            id="nav-section-patient"
            onClick={() => handleSectionSelect('PATIENT')}
            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
              activeSection === 'PATIENT'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-[11px]">Patient</span>
          </button>

          {/* 5. Accept Invite */}
          <button
            type="button"
            id="nav-section-invitation"
            onClick={() => handleSectionSelect('INVITATION')}
            className={`col-span-2 sm:col-span-1 py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1 relative ${
              activeSection === 'INVITATION'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Ticket className="w-4 h-4 text-amber-300" />
            <span className="text-[11px]">Invite Token</span>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-500 text-[8px] text-slate-950 font-black rounded-full uppercase">
              5m
            </span>
          </button>
        </div>

        {/* Main Station Form Container */}
        <div className="bg-slate-900/85 py-7 px-6 sm:px-9 shadow-2xl rounded-3xl border border-slate-800 backdrop-blur-xl transition">
          {/* Section Banner Header */}
          <div className="mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold border uppercase tracking-wider ${meta.badgeColor}`}>
                  {meta.badge}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {meta.title}
                </h3>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
                {activeSection === 'DOCTOR' && <Stethoscope className="w-5 h-5 text-blue-400" />}
                {activeSection === 'NURSE' && <HeartPulse className="w-5 h-5 text-emerald-400" />}
                {activeSection === 'ADMIN' && <ShieldAlert className="w-5 h-5 text-purple-400" />}
                {activeSection === 'PATIENT' && <User className="w-5 h-5 text-cyan-400" />}
                {activeSection === 'INVITATION' && <Ticket className="w-5 h-5 text-amber-400" />}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {meta.subtitle}
            </p>
          </div>

          {/* Section Guidance Notice */}
          {activeSection !== 'INVITATION' && (
            <div className="mb-5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                <LockKeyhole className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Station Access Protocol</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {meta.notice}
              </p>
            </div>
          )}

          {/* Error & Success Messages */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* SECTION 5: STAFF INVITATION TOKEN ONBOARDING FORM             */}
          {/* ============================================================ */}
          {activeSection === 'INVITATION' ? (
            <div className="space-y-4">
              {!inviteData && !inviteExpired && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1.5">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-300">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>5-Minute Onboarding Policy</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      If your clinic administrator sent you an invitation token, paste it below to verify and complete your clinical staff registration.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Enter 64-Character Invitation Token *
                    </label>
                    <div className="relative">
                      <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={inviteTokenInput}
                        onChange={e => setInviteTokenInput(e.target.value)}
                        placeholder="Paste single-use token from admin..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => verifyInvite(inviteTokenInput)}
                    disabled={inviteLoading || !inviteTokenInput.trim()}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <span>{inviteLoading ? 'Verifying Token...' : 'Verify Token & Begin Registration'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {inviteExpired && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-3 animate-fadeIn">
                  <div className="flex items-center space-x-2 font-bold text-amber-400">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Token Expired (5-Minute Lifespan)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    This staff invitation token has exceeded the 5-minute security window or has already been consumed. For compliance with clinical zero-trust standards, onboarding tokens expire quickly.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Please contact your Hospital Administrator to generate a fresh invitation link.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteToken(null);
                      setInviteData(null);
                      setInviteExpired(false);
                      setInviteTokenInput('');
                      setActiveSection('DOCTOR');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
                  >
                    Return to Staff Sign In
                  </button>
                </div>
              )}

              {inviteToken && inviteData && !inviteExpired && (
                <form className="space-y-4 animate-fadeIn" onSubmit={handleStaffOnboardingSubmit}>
                  <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        <span>Verified Invitation Token</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {inviteData.role}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] text-amber-300 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Valid for 5 minutes from generation</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Onboarding account for <strong className="text-white">{inviteData.email}</strong>. Complete your credentials below to immediately access your workstation.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required
                        placeholder="e.g. Robert"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        required
                        placeholder="e.g. Chen"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Work Email (Locked to Token)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={inviteData.email}
                        disabled
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 font-mono text-xs cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {['DOCTOR', 'NURSE'].includes(inviteData.role) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                          Medical License / NPI #
                        </label>
                        <input
                          type="text"
                          value={medicalLicenseNo}
                          onChange={e => setMedicalLicenseNo(e.target.value)}
                          placeholder="NPI-1928374829"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                          Clinical Specialty
                        </label>
                        <input
                          type="text"
                          value={specialty}
                          onChange={e => setSpecialty(e.target.value)}
                          placeholder="Cardiology / Internal"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Set Account Password *
                      </label>
                      <span className="text-[10px] text-slate-500">Min 8 characters</span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{loading ? 'Activating Account...' : `Complete Onboarding as ${inviteData.role}`}</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ============================================================ */
            /* SECTIONS 1-4: STANDARD SIGN IN FOR DOCTOR / NURSE / ADMIN / PATIENT */
            /* ============================================================ */
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              {/* Registration fields for Patient only */}
              {activeSection === 'PATIENT' && isPatientRegister && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-950 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                        validationErrors.firstName ? 'border-red-500' : 'border-slate-800 focus:border-cyan-500'
                      }`}
                      placeholder="e.g. Jane"
                    />
                    {validationErrors.firstName && (
                      <p className="text-[10px] text-red-400 mt-1">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-950 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                        validationErrors.lastName ? 'border-red-500' : 'border-slate-800 focus:border-cyan-500'
                      }`}
                      placeholder="e.g. Doe"
                    />
                    {validationErrors.lastName && (
                      <p className="text-[10px] text-red-400 mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {activeSection === 'PATIENT' ? 'Patient Email Address *' : `${meta.title} Email *`}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                      validationErrors.email ? 'border-red-500' : 'border-slate-800 focus:border-cyan-500'
                    }`}
                    placeholder={meta.emailPlaceholder}
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-[10px] text-red-400 mt-1">{validationErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password *
                  </label>
                  {activeSection !== 'PATIENT' && (
                    <span className="text-[10px] text-slate-500">
                      Use password configured by Administrator
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                      validationErrors.password ? 'border-red-500' : 'border-slate-800 focus:border-cyan-500'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="text-[10px] text-red-400 mt-1">{validationErrors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs transition shadow-lg bg-gradient-to-r text-white flex items-center justify-center space-x-2 disabled:opacity-50 ${meta.gradient}`}
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : meta.buttonText}</span>
              </button>
            </form>
          )}

          {/* Bottom toggle for Patient self-registration vs login */}
          {activeSection === 'PATIENT' && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsPatientRegister(!isPatientRegister);
                  setError(null);
                  setSuccessMessage(null);
                  setValidationErrors({});
                  setPassword('');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition"
              >
                {isPatientRegister
                  ? '← Already have a patient account? Sign In'
                  : "Don't have an account? Register as a New Patient →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
