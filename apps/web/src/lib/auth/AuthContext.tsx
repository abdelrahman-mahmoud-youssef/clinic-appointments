'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@clinic/shared';
import { login as loginRequest } from '@/lib/api/auth';
import { getToken, setToken } from './token-store';
import { decodeRole } from './jwt';

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitialized: boolean;
  role: Role | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const router = useRouter();

  // Token lives in localStorage, so the initial authenticated state is only
  // known after mount. isInitialized lets pages avoid a flash-redirect to
  // /login before this check has actually run.
  useEffect(() => {
    const token = getToken();
    setIsAuthenticated(!!token);
    setRole(token ? decodeRole(token) : null);
    setIsInitialized(true);
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await loginRequest(email, password);
    setToken(accessToken);
    setRole(decodeRole(accessToken));
    setIsAuthenticated(true);
    router.push('/dashboard');
  }

  function logout() {
    setToken(null);
    setRole(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isInitialized, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
