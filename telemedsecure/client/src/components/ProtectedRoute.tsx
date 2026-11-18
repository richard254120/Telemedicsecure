import React, { useCallback } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import ForcePasswordChange from './ForcePasswordChange';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Validating Cryptographic Session Credentials...</p>
      </div>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ── Force password change gate ─────────────────────────────────────────────
  // When an admin-created account logs in for the first time (or after a
  // security-policy reset), every API endpoint returns 403 "Password change
  // required".  Intercept here so the user sees a proper form rather than a
  // series of "This panel could not be loaded" errors.
  if (user.mustChangePassword) {
    const onComplete = () => {
      // The server already cleared the flag; update the cached user object so
      // this gate doesn't re-appear on the next render.
      const stored = localStorage.getItem('telemed_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.mustChangePassword = false;
          localStorage.setItem('telemed_user', JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }
      navigate(`/${user.role.toLowerCase()}`, { replace: true });
    };

    return <ForcePasswordChange onComplete={onComplete} />;
  }

  // ── Wrong role ─────────────────────────────────────────────────────────────
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[80vh] bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/90 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Access Restricted</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Role-Based Access Control (RBAC) Enforcement: Your active identity is{' '}
              <span className="font-semibold text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                {user.role}
              </span>
              , but this module requires one of:
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {allowedRoles.map(r => (
                <span
                  key={r}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-red-500/10 text-red-300 border border-red-500/20"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60 space-y-3">
            <p className="text-xs text-slate-400 font-medium">
              Contact an administrator if you believe you should have access to this module.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to={`/${user.role.toLowerCase()}`}
              className="inline-flex items-center space-x-2 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to {user.role} Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
