'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login as loginRequest } from '@/lib/api/auth';
import { getToken, setToken } from './token-store';

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Token lives in localStorage, so the initial authenticated state is only
  // known after mount. isInitialized lets pages avoid a flash-redirect to
  // /login before this check has actually run.
  useEffect(() => {
    setIsAuthenticated(!!getToken());
    setIsInitialized(true);
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await loginRequest(email, password);
    setToken(accessToken);
    setIsAuthenticated(true);
    router.push('/calendar');
  }

  function logout() {
    setToken(null);
    setIsAuthenticated(false);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isInitialized, login, logout }}>
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
