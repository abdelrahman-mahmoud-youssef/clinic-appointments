'use client';

import { Suspense } from 'react';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { AppointmentCalendar } from '@/components/calendar/AppointmentCalendar';

export default function CalendarPage() {
  const isReady = useRequireAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  return (
    <AppShell>
      <div className="mb-5 sm:mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Calendar</h1>
        <p className="mt-1 text-sm text-ink-soft">Select an open slot to book, or drag to reschedule.</p>
      </div>
      <Suspense fallback={<div className="text-sm text-ink-soft">Loading…</div>}>
        <AppointmentCalendar />
      </Suspense>
    </AppShell>
  );
}
