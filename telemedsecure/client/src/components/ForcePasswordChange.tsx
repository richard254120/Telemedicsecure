/**
 * ForcePasswordChange — Full-screen gate shown when mustChangePassword === true.
 *
 * Rendered instead of the dashboard for any user whose account has been
 * flagged (admin-created accounts, first login, security-policy reset).
 * On success the flag is cleared server-side and the user is forwarded to
 * their normal dashboard.
 */
import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';

interface Props {
  onComplete: () => void; // called after a successful password change
}

/** Colour-coded rule row */
const Rule: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <li className={`flex items-center gap-2 text-xs ${met ? 'text-emerald-400' : 'text-slate-400'}`}>
    <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center ${met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
      {met ? '✓' : '·'}
    </span>
    {label}
  </li>
);

export default function ForcePasswordChange({ onComplete }: Props) {
  const { getAuthHeaders, logout } = useAuth();

  const [oldPassword, setOldPassword]           = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showOld, setShowOld]                   = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [success, setSuccess]                   = useState(false);

  // ── Password rules ──────────────────────────────────────────────────────────
  const rules = {
    length:    newPassword.length >= 10,
    upper:     /[A-Z]/.test(newPassword),
    lower:     /[a-z]/.test(newPassword),
    digit:     /[0-9]/.test(newPassword),
    special:   /[^A-Za-z0-9]/.test(newPassword),
    match:     newPassword.length > 0 && newPassword === confirmPassword,
    notSame:   newPassword.length > 0 && newPassword !== oldPassword,
  };
  const allRulesMet = Object.values(rules).every(Boolean);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesMet) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Password change failed. Check your current password.');
      }

      setSuccess(true);
      // Brief pause so the user sees the success state, then proceed to dashboard
      setTimeout(() => onComplete(), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header card */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 mb-4">
            <KeyRound className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Password Change Required</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Your account requires a password update before you can access the platform. This is a one-time security step.
          </p>
        </div>

        {/* Success state */}
        {success ? (
          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-white font-bold text-base">Password Updated Successfully</p>
            <p className="text-slate-400 text-xs">Redirecting you to your dashboard…</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl p-7 space-y-5">

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your current password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Create a strong new password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border text-white text-sm focus:outline-none placeholder-slate-600 ${
                      confirmPassword && !rules.match
                        ? 'border-rose-500/60 focus:border-rose-500'
                        : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password rules */}
              {newPassword.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Password Requirements</p>
                  <ul className="space-y-1">
                    <Rule met={rules.length}  label="At least 10 characters" />
                    <Rule met={rules.upper}   label="At least one uppercase letter (A–Z)" />
                    <Rule met={rules.lower}   label="At least one lowercase letter (a–z)" />
                    <Rule met={rules.digit}   label="At least one digit (0–9)" />
                    <Rule met={rules.special} label="At least one special character (!@#$…)" />
                    <Rule met={rules.match}   label="Passwords match" />
                    <Rule met={rules.notSame} label="Different from current password" />
                  </ul>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !allRulesMet || !oldPassword}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {submitting ? 'Updating Password…' : 'Update Password & Continue'}
              </button>
            </form>

            {/* Sign out link */}
            <p className="text-center text-xs text-slate-500">
              Want to sign in with a different account?{' '}
              <button
                onClick={logout}
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
              >
                Sign out
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

