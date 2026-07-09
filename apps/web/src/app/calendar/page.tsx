'use client';

import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';

export default function CalendarPage() {
  const isReady = useRequireAuth();
  const { logout } = useAuth();

  if (!isReady) {
    return null;
  }

  return (
    <main style={{ padding: '2rem' }}>
      <button onClick={logout}>Log out</button>
      <p>Calendar coming up next.</p>
    </main>
  );
}
