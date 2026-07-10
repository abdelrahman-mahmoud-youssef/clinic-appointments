'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, Role } from '@clinic/shared';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listAppointments } from '@/lib/api/appointments';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBreakdown } from '@/components/dashboard/StatusBreakdown';
import { RoleGate } from '@/components/auth/RoleGate';
import { CAN_BOOK } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/Button';

const WINDOW_DAYS = 7;
const BRAND = '#0f6e63';

function emptyCounts(): Record<AppointmentStatus, number> {
  return {
    [AppointmentStatus.SCHEDULED]: 0,
    [AppointmentStatus.CONFIRMED]: 0,
    [AppointmentStatus.COMPLETED]: 0,
    [AppointmentStatus.CANCELLED]: 0,
    [AppointmentStatus.NO_SHOW]: 0,
  };
}

const HEADLINE: Record<Role, { title: string; subtitle: string }> = {
  [Role.ADMIN]: { title: 'Clinic overview', subtitle: 'Everything happening across your clinic.' },
  [Role.RECEPTIONIST]: { title: 'Front desk', subtitle: 'Book and manage the next seven days.' },
  [Role.DOCTOR]: { title: 'Your clinic', subtitle: 'Update appointment statuses from the calendar.' },
};

export default function DashboardPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    return { from, to: endOfDay(addDays(from, WINDOW_DAYS - 1)) };
  }, []);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'dashboard', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => listAppointments({ from: range.from.toISOString(), to: range.to.toISOString() }),
    enabled: isReady,
  });

  const stats = useMemo(() => {
    const todayEnd = endOfDay(new Date());
    const counts = emptyCounts();
    let today = 0;
    let active = 0;
    for (const appointment of appointments) {
      counts[appointment.status] += 1;
      const isActive =
        appointment.status !== AppointmentStatus.CANCELLED &&
        appointment.status !== AppointmentStatus.NO_SHOW;
      if (!isActive) continue;
      active += 1;
      if (new Date(appointment.startsAt) <= todayEnd) today += 1;
    }
    return { today, active, counts };
  }, [appointments]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  const headline = role ? HEADLINE[role] : HEADLINE[Role.RECEPTIONIST];

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{headline.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{headline.subtitle}</p>
        </div>
        <RoleGate roles={CAN_BOOK}>
          <Button variant="primary" onClick={() => router.push('/calendar')}>
            New appointment
          </Button>
        </RoleGate>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={isLoading ? '—' : stats.today} hint="Active appointments" accent={BRAND} />
        <StatCard label="Next 7 days" value={isLoading ? '—' : stats.active} hint="Active appointments" />
        <StatCard
          label="Awaiting confirmation"
          value={isLoading ? '—' : stats.counts[AppointmentStatus.SCHEDULED]}
        />
        <StatCard label="Confirmed" value={isLoading ? '—' : stats.counts[AppointmentStatus.CONFIRMED]} />
      </div>

      <div className="mt-4">
        <StatusBreakdown counts={stats.counts} />
      </div>
    </AppShell>
  );
}
