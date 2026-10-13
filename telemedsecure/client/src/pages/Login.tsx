import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Sparkles,
  Info,
  LockKeyhole
} from 'lucide-react';

type PortalType = 'PATIENT' | 'STAFF';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Active portal tab: Patient vs Staff
  const [activePortal, setActivePortal] = useState<PortalType>('PATIENT');

  // Basic authentication states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Patient registration toggle (ONLY Patients can register)
  const [isRegister, setIsRegister] = useState(false);

  // Form fields for Patient Registration
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Parse portal from URL query (e.g. /login?portal=staff or /login?portal=patient)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalParam = params.get('portal');
    const emailParam = params.get('email');

    if (portalParam === 'staff') {
      setActivePortal('STAFF');
      setIsRegister(false);
    } else if (portalParam === 'patient') {
      setActivePortal('PATIENT');
    }

    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location.search]);

  // Demo credentials quick fill for testing and evaluation
  const handleFillDemo = (role: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'PATIENT') => {
    setError(null);
    setSuccessMessage(null);
    setIsRegister(false);

    if (role === 'ADMIN') {
      setActivePortal('STAFF');
      setEmail('admin@telemed.com');
      setPassword('Password123!');
    } else if (role === 'DOCTOR') {
      setActivePortal('STAFF');
      setEmail('doctor@telemed.com');
      setPassword('Password123!');
    } else if (role === 'NURSE') {
      setActivePortal('STAFF');
      setEmail('nurse@telemed.com');
      setPassword('Password123!');
    } else if (role === 'PATIENT') {
      setActivePortal('PATIENT');
      setEmail('patient@telemed.com');
      setPassword('Password123!');
    }
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

    if (isRegister) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    setLoading(true);

    if (isRegister) {
      // ONLY PATIENT self-registration is allowed
      try {
        const endpoint = `${API_BASE}/auth/register`;
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim()
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
          setSuccessMessage(
            'Patient account created successfully! You can now sign in with your email and password.'
          );
          setIsRegister(false);
          setPassword('');
          setValidationErrors({});
        } else {
          setError(data.error || 'Registration failed. Please check your details.');
        }
      } catch (err) {
        console.error('Registration network error:', err);
        setError('Network error. Unable to reach authentication server.');
      }
    } else {
      // Unified login flow
      const res = await login(email.trim().toLowerCase(), password);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.error || 'Invalid email or password.');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <Link to="/" className="inline-flex justify-center group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/25 group-hover:scale-105 transition">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </Link>
        <h2 className="mt-4 text-3xl font-black text-white tracking-tight">
          TeleMedSecure
        </h2>
        <p className="mt-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
          Zero-Trust Medical Identity & Access Control
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 space-y-4">
        {/* Portal Switcher Tabs */}
        <div className="bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 flex shadow-lg">
          <button
            type="button"
            onClick={() => {
              setActivePortal('PATIENT');
              setError(null);
              setSuccessMessage(null);
              setValidationErrors({});
            }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 ${
              activePortal === 'PATIENT'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Patient Portal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePortal('STAFF');
              setIsRegister(false);
              setError(null);
              setSuccessMessage(null);
              setValidationErrors({});
            }}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 ${
              activePortal === 'STAFF'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Hospital Staff & Clinical</span>
          </button>
        </div>

        {/* Main Form Container */}
        <div className="bg-slate-900/80 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800 backdrop-blur-xl">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white text-center">
              {activePortal === 'PATIENT'
                ? isRegister
                  ? 'Create Patient Account'
                  : 'Patient Sign In'
                : 'Hospital Staff Sign In'}
            </h3>
            <p className="text-xs text-slate-400 text-center mt-1">
              {activePortal === 'PATIENT'
                ? isRegister
                  ? 'Register self-service to book consultations and access medical records.'
                  : 'Access your appointments, consultations, and prescriptions.'
                : 'Doctors, Nurses, and Administrators sign in with clinic-provisioned credentials.'}
            </p>
          </div>

          {/* Clinical Staff Access Notice - STRICT RULE: Accounts must be created by Admin */}
          {activePortal === 'STAFF' && (
            <div className="mb-6 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-blue-300">
                <LockKeyhole className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Hospital Administration Policy</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Doctor, Nurse, and Administrator accounts are <strong className="text-white">created directly by Healthcare Administration</strong>.
                Self-registration is strictly restricted for clinical personnel. Please sign in using the official credentials provided to you by your Clinic Administrator.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Registration fields for Patient only */}
            {isRegister && activePortal === 'PATIENT' && (
              <div className="grid grid-cols-2 gap-3">
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
                {activePortal === 'STAFF' ? 'Work / Staff Email *' : 'Account Email *'}
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
                  placeholder={activePortal === 'STAFF' ? 'doctor@telemed.com' : 'patient@example.com'}
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
                {activePortal === 'STAFF' && (
                  <span className="text-[10px] text-slate-500">
                    Use password provided by admin
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
              className={`w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs transition shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 ${
                activePortal === 'STAFF'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/25'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading
                  ? 'Authenticating...'
                  : isRegister
                    ? 'Create Patient Account'
                    : `Sign In to ${activePortal === 'STAFF' ? 'Clinical Portal' : 'Patient Portal'}`}
              </span>
            </button>
          </form>

          {/* Bottom toggles & links */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center space-y-2">
            {activePortal === 'PATIENT' ? (
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                  setSuccessMessage(null);
                  setValidationErrors({});
                  setPassword('');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                {isRegister
                  ? '← Already have a patient account? Sign In'
                  : "Don't have an account? Register as a New Patient →"}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Staff Access Notice:</span> Only clinic administrators can create Doctor, Nurse, and Administrative accounts. If you require credentials, please contact your Hospital Administration.
              </div>
            )}
          </div>
        </div>

        {/* Demo Fast-Switch Helpers (Convenient for testing each role) */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Evaluation & Fast Demo Login</span>
            </span>
            <span className="text-[10px] text-slate-500">1-click test fill</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo('ADMIN')}
              className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold transition text-left"
            >
              <div className="font-bold flex items-center space-x-1">
                <ShieldAlert className="w-3 h-3 text-purple-400" />
                <span>Admin</span>
              </div>
              <div className="text-[9px] text-slate-400 truncate">admin@telemed.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleFillDemo('DOCTOR')}
              className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-semibold transition text-left"
            >
              <div className="font-bold flex items-center space-x-1">
                <Stethoscope className="w-3 h-3 text-blue-400" />
                <span>Doctor</span>
              </div>
              <div className="text-[9px] text-slate-400 truncate">doctor@telemed.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleFillDemo('NURSE')}
              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition text-left"
            >
              <div className="font-bold flex items-center space-x-1">
                <HeartPulse className="w-3 h-3 text-emerald-400" />
                <span>Nurse</span>
              </div>
              <div className="text-[9px] text-slate-400 truncate">nurse@telemed.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleFillDemo('PATIENT')}
              className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition text-left"
            >
              <div className="font-bold flex items-center space-x-1">
                <User className="w-3 h-3 text-cyan-400" />
                <span>Patient</span>
              </div>
              <div className="text-[9px] text-slate-400 truncate">patient@telemed.com</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
