import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN';

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Attempting login to:', `${API_BASE}/auth/login`);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      console.log('Login response status:', res.status, res.statusText);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Login failed:', errorData);
        return { success: false, error: errorData.error || 'Authentication failed' };
      }
      const data = await res.json();
      console.log('Login successful:', data);
      setUser(data.user);
      setToken(data.accessToken);
      localStorage.setItem('telemed_token', data.accessToken);
      localStorage.setItem('telemed_user', JSON.stringify(data.user));
      return { success: true };
    } catch (e: any) {
      console.error('Login error:', e);
      return { success: false, error: e?.message || 'Network error during login' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('telemed_token');
    localStorage.removeItem('telemed_user');
  };

  const getAuthHeaders = (): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        getAuthHeaders
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
