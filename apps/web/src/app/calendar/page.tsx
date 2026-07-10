'use client';

import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppointmentCalendar } from '@/components/calendar/AppointmentCalendar';
import { Button } from '@/components/ui/Button';

export default function CalendarPage() {
  const isReady = useRequireAuth();
  const { logout } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <span className="slot-closed hidden h-8 w-8 shrink-0 rounded-lg border border-line-strong sm:block" />
          <h1 className="font-display text-lg font-semibold text-ink sm:text-xl">Appointments</h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </header>
      <AppointmentCalendar />
    </main>
  );
}
