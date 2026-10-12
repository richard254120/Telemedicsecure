import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { API_BASE } from '../config';
import { ShieldCheck, User, Stethoscope, HeartPulse, ShieldAlert, KeyRound, ArrowRight, CheckCircle2, UserPlus, Eye, EyeOff, Mail, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, quickLogin, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PATIENT');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
      if (!firstName) {
        errors.firstName = 'First name is required';
      } else if (firstName.length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
      }

      if (!lastName) {
        errors.lastName = 'Last name is required';
      } else if (lastName.length < 2) {
        errors.lastName = 'Last name must be at least 2 characters';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    if (isRegister) {
      // Registration
      try {
        console.log('Registering user:', { email, firstName, lastName, role: selectedRole });
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, firstName, lastName, role: selectedRole })
        });
        const data = await res.json();
        if (res.ok) {
          setError('Registration successful! Please sign in with your credentials.');
          setIsRegister(false);
          setValidationErrors({});
        } else {
          setError(data.error || 'Registration failed. Please try again.');
        }
      } catch (e) {
        console.error('Registration error:', e);
        setError('Network error. Please check your connection and try again.');
      }
    } else {
      // Login
      console.log('Submitting login with:', { email, password: '***' });
      const ok = await login(email, password);
      if (ok) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleQuickLogin = async (role: UserRole) => {
    setLoading(true);
    setError(null);
    const ok = await quickLogin(role);
    setLoading(false);
    if (ok) {
      navigate('/dashboard');
    } else {
      setError('Quick login failed. Please try again.');
    }
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
          Zero-Knowledge Clinical Authentication
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        <div className="bg-slate-800/90 py-8 px-6 shadow-2xl rounded-3xl border border-slate-700/80 backdrop-blur-xl sm:px-10">
          <h3 className="text-xl font-bold text-white text-center mb-6">
            {isRegister ? 'Create New Account' : 'Sign In'}
          </h3>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 ${validationErrors.firstName ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-cyan-500'
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
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 ${validationErrors.lastName ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-cyan-500'
                        }`}
                      placeholder="Doe"
                    />
                    {validationErrors.lastName && (
                      <p className="text-[10px] text-red-400 mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { role: 'PATIENT' as UserRole, label: 'Patient', icon: User, color: 'cyan' },
                      { role: 'DOCTOR' as UserRole, label: 'Doctor', icon: Stethoscope, color: 'blue' },
                      { role: 'NURSE' as UserRole, label: 'Nurse', icon: HeartPulse, color: 'emerald' },
                      { role: 'ADMIN' as UserRole, label: 'Admin', icon: ShieldAlert, color: 'purple' }
                    ].map(({ role, label, icon: Icon, color }) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`p-3 rounded-xl border-2 text-xs font-semibold transition flex items-center justify-center space-x-2 ${selectedRole === role
                          ? `border-${color}-500 bg-${color}-500/20 text-${color}-400`
                          : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 ${validationErrors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  placeholder="your@email.com"
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
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 ${validationErrors.password ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-cyan-500'
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
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition shadow-lg shadow-cyan-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? (isRegister ? 'Creating Account...' : 'Authenticating...') : (isRegister ? 'Create Account' : 'Sign In')}</span>
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setValidationErrors({});
                setEmail('');
                setPassword('');
                setFirstName('');
                setLastName('');
                setSelectedRole('PATIENT');
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
