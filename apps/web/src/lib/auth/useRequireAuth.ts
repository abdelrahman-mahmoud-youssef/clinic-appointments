'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

// Redirects to /login once the initial auth check has run and found no
// token. Returns whether the page is ready to render its authenticated
// content (i.e. auth state is known and the user is signed in).
export function useRequireAuth(): boolean {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  return isInitialized && isAuthenticated;
}
