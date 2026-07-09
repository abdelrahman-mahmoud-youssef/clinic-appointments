'use client';

import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppointmentCalendar } from '@/components/calendar/AppointmentCalendar';

export default function CalendarPage() {
  const isReady = useRequireAuth();
  const { logout } = useAuth();

  if (!isReady) {
    return null;
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <h1>Appointments</h1>
        <button onClick={logout}>Log out</button>
      </header>
      <AppointmentCalendar />
    </main>
  );
}
