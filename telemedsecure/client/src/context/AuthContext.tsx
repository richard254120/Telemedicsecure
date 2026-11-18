/**
 * AuthContext — session management with silent token refresh.
 *
 * Access tokens last 2 h on the server. This context refreshes them
 * automatically every 100 minutes (20 min before they expire) so a
 * clinician working a full shift is never interrupted by a 401.
 *
 * Token chain:
 *   login  → stores accessToken + refreshToken in localStorage
 *   every 100 min  → POST /auth/refresh, swap in new accessToken
 *   401 from transport → one silent retry via refresh, then logout if that fails too
 *   logout → clears all storage
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { API_BASE } from '../config';
import { registerSilentRefresh, clearSilentRefresh } from '../dashboard-shell/transport';

export type UserRole =
  | 'PATIENT'
  | 'DOCTOR'
  | 'NURSE'
  | 'PHARMACIST'
  | 'RECEPTIONIST'
  | 'ADMIN'
  | 'LAB_TECHNICIAN'
  | 'RADIOLOGIST'
  | 'BILLING_OFFICER'
  | 'TRIAGE_OFFICER'
  | 'CARE_COORDINATOR';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  verificationStatus?: 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
  medicalLicenseNo?: string | null;
  licenseJurisdiction?: string | null;
  specialty?: string | null;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
  /** Attempt a silent token refresh; resolves true on success. */
  silentRefresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** How often the background timer fires (ms) — 100 min, well before the 2-h access-token TTL */
const REFRESH_INTERVAL_MS = 100 * 60 * 1000;

/** localStorage keys */
const LS_TOKEN   = 'telemed_token';
const LS_REFRESH = 'telemed_refresh_token';
const LS_USER    = 'telemed_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(LS_USER);
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(LS_TOKEN) || null
  );

  const [isLoading, setIsLoading] = useState(true);

  // Keep a ref so the interval can always read the latest refreshToken without
  // being recreated on every token rotation.
  const refreshTokenRef = useRef<string | null>(
    localStorage.getItem(LS_REFRESH) || null
  );

  // ─── helpers ────────────────────────────────────────────────────────────────

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    refreshTokenRef.current = null;
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_USER);
  }, []);

  const applyTokens = useCallback(
    (accessToken: string, refreshToken: string, profile: AuthUser) => {
      setToken(accessToken);
      setUser(profile);
      refreshTokenRef.current = refreshToken;
      localStorage.setItem(LS_TOKEN, accessToken);
      localStorage.setItem(LS_REFRESH, refreshToken);
      localStorage.setItem(LS_USER, JSON.stringify(profile));
    },
    []
  );

  // ─── silent refresh ──────────────────────────────────────────────────────────

  const silentRefresh = useCallback(async (): Promise<boolean> => {
    const rt = refreshTokenRef.current;
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = await res.json();
      // The /refresh endpoint returns { accessToken, refreshToken }
      const newAccess: string  = data.accessToken;
      const newRefresh: string = data.refreshToken ?? rt; // fall back to old if server omits it
      setToken(newAccess);
      refreshTokenRef.current = newRefresh;
      localStorage.setItem(LS_TOKEN, newAccess);
      localStorage.setItem(LS_REFRESH, newRefresh);
      return true;
    } catch {
      return false;
    }
  }, [clearSession]);

  // ─── background timer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return; // not logged in — no timer needed
    const id = setInterval(() => {
      void silentRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, silentRefresh]);

  // ─── register silentRefresh with the transport layer ─────────────────────────

  useEffect(() => {
    registerSilentRefresh(silentRefresh);
    return () => clearSilentRefresh();
  }, [silentRefresh]);

  // ─── listen for auth-expired broadcasts from transport ───────────────────────
  // The transport already attempted a silent refresh before broadcasting;
  // by the time this listener fires, the refresh has failed — just clear the session.

  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener('telemed:auth-expired', onExpired);
    return () => window.removeEventListener('telemed:auth-expired', onExpired);
  }, [clearSession]);

  // ─── boot: validate stored token ────────────────────────────────────────────

  useEffect(() => {
    const initAuth = async () => {
      const storedToken   = localStorage.getItem(LS_TOKEN);
      const storedRefresh = localStorage.getItem(LS_REFRESH);
      const storedUser    = localStorage.getItem(LS_USER);

      if (storedToken && storedUser) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.ok) {
            const data: AuthUser = await res.json();
            setUser(data);
            setToken(storedToken);
            refreshTokenRef.current = storedRefresh;
            setIsLoading(false);
            return;
          }
          // Access token stale — try a silent refresh before giving up
          if (storedRefresh) {
            refreshTokenRef.current = storedRefresh;
            const ok = await silentRefresh();
            if (ok) {
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Boot auth check failed', e);
        }
      }

      clearSession();
      setIsLoading(false);
    };

    void initAuth();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── login ───────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { success: false, error: (errorData as { error?: string }).error || 'Authentication failed' };
        }

        const data = await res.json();
        applyTokens(data.accessToken, data.refreshToken, data.user as AuthUser);
        return { success: true };
      } catch (e) {
        const detail = e instanceof Error && e.message ? e.message : '';
        return { success: false, error: detail || 'Network error during login' };
      }
    },
    [applyTokens]
  );

  // ─── logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // ─── auth headers ─────────────────────────────────────────────────────────────

  // Stable while token is stable — memoised consumers are not torn down on render.
  const getAuthHeaders = useCallback((): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  // ─── context value ────────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout, getAuthHeaders, silentRefresh }),
    [user, token, isLoading, login, logout, getAuthHeaders, silentRefresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
