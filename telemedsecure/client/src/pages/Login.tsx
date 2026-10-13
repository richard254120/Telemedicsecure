import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Ticket,
  FileCheck2,
  AlertCircle
} from 'lucide-react';

type RegisterMode = 'PATIENT' | 'STAFF_INVITE' | 'PRACTITIONER_APPLY';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Basic authentication states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Registration navigation states
  const [isRegister, setIsRegister] = useState(false);
  const [registerMode, setRegisterMode] = useState<RegisterMode>('PATIENT');

  // Registration form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [medicalLicenseNo, setMedicalLicenseNo] = useState('');
  const [licenseJurisdiction, setLicenseJurisdiction] = useState('US-NPI');
  const [specialty, setSpecialty] = useState('General Practice');
  const [practitionerRole, setPractitionerRole] = useState<'DOCTOR' | 'NURSE'>('DOCTOR');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Parse invite tokens from URL query (e.g., /login?invite=abcdef&email=doctor@telemed.com)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteParam = params.get('invite');
    const emailParam = params.get('email');

    if (inviteParam) {
      setIsRegister(true);
      setRegisterMode('STAFF_INVITE');
      setInvitationToken(inviteParam);
      if (emailParam) {
        setEmail(emailParam);
      }
    }
  }, [location.search]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (isRegister) {
      if (!firstName || firstName.trim().length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
      }
      if (!lastName || lastName.trim().length < 2) {
        errors.lastName = 'Last name must be at least 2 characters';
      }

      if (registerMode === 'STAFF_INVITE') {
        if (!invitationToken.trim()) {
          errors.invitationToken = 'Valid staff invitation token is required';
        }
      }

      if (registerMode === 'PRACTITIONER_APPLY') {
        if (!medicalLicenseNo.trim()) {
          errors.medicalLicenseNo = 'State/National medical license number is mandatory';
        }
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
      try {
        let endpoint = `${API_BASE}/auth/register`;
        let payload: any = {
          email,
          password,
          firstName,
          lastName
        };

        if (registerMode === 'STAFF_INVITE') {
          endpoint = `${API_BASE}/auth/register-staff`;
          payload = {
            ...payload,
            invitationToken: invitationToken.trim(),
            medicalLicenseNo: medicalLicenseNo.trim() || undefined,
            licenseJurisdiction,
            specialty
          };
        } else if (registerMode === 'PRACTITIONER_APPLY') {
          endpoint = `${API_BASE}/auth/apply-practitioner`;
          payload = {
            ...payload,
            role: practitionerRole,
            medicalLicenseNo: medicalLicenseNo.trim(),
            licenseJurisdiction,
            specialty
          };
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
          if (registerMode === 'PRACTITIONER_APPLY') {
            setSuccessMessage(
              'Application submitted! Your clinical credentials are under administrative review. Once verified, you will be able to sign in.'
            );
          } else {
            setSuccessMessage(
              'Account registration complete! You can now sign in with your credentials.'
            );
          }
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
      // Login flow
      const res = await login(email, password);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.error || 'Invalid email or password.');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-black text-white tracking-tight">
          TeleMedSecure
        </h2>
        <p className="mt-1 text-center text-xs text-cyan-400 font-semibold uppercase tracking-wider">
          Zero-Trust Clinical Identity & Access Control
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        <div className="bg-slate-800/90 py-8 px-6 shadow-2xl rounded-3xl border border-slate-700/80 backdrop-blur-xl sm:px-10">
          <h3 className="text-xl font-bold text-white text-center mb-6">
            {isRegister
              ? registerMode === 'PATIENT'
                ? 'Patient Portal Sign Up'
                : registerMode === 'STAFF_INVITE'
                  ? 'Clinical Staff Invitation'
                  : 'Practitioner Credential Application'
              : 'Sign In to TeleMedSecure'}
          </h3>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Registration Mode Selector */}
          {isRegister && (
            <div className="mb-6 bg-slate-900/80 p-1 rounded-2xl border border-slate-700/80 flex text-xs">
              <button
                type="button"
                onClick={() => {
                  setRegisterMode('PATIENT');
                  setError(null);
                  setValidationErrors({});
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 ${
                  registerMode === 'PATIENT'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Patient</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegisterMode('STAFF_INVITE');
                  setError(null);
                  setValidationErrors({});
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 ${
                  registerMode === 'STAFF_INVITE'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Have Invite</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegisterMode('PRACTITIONER_APPLY');
                  setError(null);
                  setValidationErrors({});
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center space-x-1.5 ${
                  registerMode === 'PRACTITIONER_APPLY'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                {registerMode === 'PATIENT' && (
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-center space-x-2">
                    <User className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span>Self-service patient registration with end-to-end encrypted consultations.</span>
                  </div>
                )}

                {registerMode === 'STAFF_INVITE' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 flex items-center space-x-2">
                      <Ticket className="w-4 h-4 shrink-0 text-purple-400" />
                      <span>Onboarding using a cryptographically generated clinic invitation token.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Invitation Token
                      </label>
                      <input
                        type="text"
                        value={invitationToken}
                        onChange={e => setInvitationToken(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border text-white font-mono placeholder-slate-500 text-xs focus:outline-none ${
                          validationErrors.invitationToken ? 'border-red-500' : 'border-slate-700 focus:border-purple-500'
                        }`}
                        placeholder="Enter 64-char invitation token"
                      />
                      {validationErrors.invitationToken && (
                        <p className="text-[10px] text-red-400 mt-1">{validationErrors.invitationToken}</p>
                      )}
                    </div>
                  </div>
                )}

                {registerMode === 'PRACTITIONER_APPLY' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>Clinical credentials require administrative license verification before activation.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Clinical Role
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPractitionerRole('DOCTOR')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                            practitionerRole === 'DOCTOR'
                              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Doctor (MD / DO)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPractitionerRole('NURSE')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                            practitionerRole === 'NURSE'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <HeartPulse className="w-3.5 h-3.5" />
                          <span>Nurse (RN / NP)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none ${
                        validationErrors.firstName ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'
                      }`}
                      placeholder="John"
                    />
                    {validationErrors.firstName && (
                      <p className="text-[10px] text-red-400 mt-1">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none ${
                        validationErrors.lastName ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'
                      }`}
                      placeholder="Doe"
                    />
                    {validationErrors.lastName && (
                      <p className="text-[10px] text-red-400 mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Additional Clinical Fields */}
                {(registerMode === 'STAFF_INVITE' || registerMode === 'PRACTITIONER_APPLY') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        License / NPI #
                      </label>
                      <input
                        type="text"
                        value={medicalLicenseNo}
                        onChange={e => setMedicalLicenseNo(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                          validationErrors.medicalLicenseNo ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'
                        }`}
                        placeholder="NPI-1928374829"
                      />
                      {validationErrors.medicalLicenseNo && (
                        <p className="text-[10px] text-red-400 mt-1">{validationErrors.medicalLicenseNo}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Specialty
                      </label>
                      <input
                        type="text"
                        value={specialty}
                        onChange={e => setSpecialty(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500"
                        placeholder="Cardiology"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none ${
                    validationErrors.email ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'
                  }`}
                  placeholder="name@telemed.com"
                />
              </div>
              {validationErrors.email && (
                <p className="text-[10px] text-red-400 mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none ${
                    validationErrors.password ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'
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
              {isRegister && !validationErrors.password && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Must be 8+ chars with uppercase, lowercase, and number
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition shadow-lg shadow-cyan-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading
                  ? isRegister
                    ? 'Processing...'
                    : 'Authenticating...'
                  : isRegister
                    ? registerMode === 'PRACTITIONER_APPLY'
                      ? 'Submit Credential Application'
                      : registerMode === 'STAFF_INVITE'
                        ? 'Accept Invite & Register'
                        : 'Create Patient Account'
                    : 'Sign In'}
              </span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-700/60 text-center space-y-2">
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
              {isRegister ? '← Back to Sign In' : "Don't have an account? Register as Patient"}
            </button>

            {!isRegister && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setRegisterMode('STAFF_INVITE');
                    setError(null);
                    setSuccessMessage(null);
                    setValidationErrors({});
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Clinical Staff? Register with Invitation Code →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
