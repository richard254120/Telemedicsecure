import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config';

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
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('telemed_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('telemed_token') || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize or restore session
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('telemed_token');
      const storedUser = localStorage.getItem('telemed_user');

      if (storedToken && storedUser) {
        try {
          // Verify with backend
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Backend auth check failed, clearing session', e);
        }
      }

      // Clear invalid session
      setUser(null);
      setToken(null);
      localStorage.removeItem('telemed_token');
      localStorage.removeItem('telemed_user');
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string, totp?: string): Promise<{ success: boolean; error?: string; requires2FA?: boolean }> => {
      try {
        // `totp` is only attached when supplied: the API treats a stored secret on
        // the user row as an enrolment and rejects the attempt with `requires2FA`
        // until the code comes back. No request or response payload is logged —
        // this context used to `console.log` the credentials-bearing response.
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(totp ? { email, password, totp } : { email, password })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.error || 'Authentication failed',
            requires2FA: !!errorData.requires2FA
          };
        }

        const data = await res.json();
        setUser(data.user);
        setToken(data.accessToken);
        localStorage.setItem('telemed_token', data.accessToken);
        localStorage.setItem('telemed_user', JSON.stringify(data.user));
        return { success: true };
      } catch (e) {
        const detail = e instanceof Error && e.message ? e.message : '';
        return { success: false, error: detail || 'Network error during login' };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('telemed_token');
    localStorage.removeItem('telemed_user');
  }, []);

  // Stable while the token is stable, so memoised consumers (the admin console's
  // data and action layers) are not torn down on every provider render.
  const getAuthHeaders = useCallback((): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, [token]);

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout, getAuthHeaders }),
    [user, token, isLoading, login, logout, getAuthHeaders]
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
