'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AppointmentStatus, Role } from '@clinic/shared';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAppointmentSummary } from '@/lib/api/appointments';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBreakdown } from '@/components/dashboard/StatusBreakdown';
import { WeeklyVolumeChart } from '@/components/dashboard/WeeklyVolumeChart';
import { UpcomingList } from '@/components/dashboard/UpcomingList';
import { RoleGate } from '@/components/auth/RoleGate';
import { CAN_BOOK } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/Button';

const WINDOW_DAYS = 7;
const BRAND = '#0f6e63';

const HEADLINE: Record<Role, { title: string; subtitle: string }> = {
  [Role.ADMIN]: { title: 'Clinic overview', subtitle: 'Everything across your clinic, next seven days.' },
  [Role.RECEPTIONIST]: { title: 'Front desk', subtitle: 'Book and manage the next seven days.' },
  [Role.DOCTOR]: { title: 'Your schedule', subtitle: 'Your appointments over the next seven days.' },
};

export default function DashboardPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();

  const range = useMemo(() => {
    const now = new Date();
    const from = startOfDay(now);
    return { from, to: endOfDay(addDays(from, WINDOW_DAYS - 1)), nowIso: now.toISOString() };
  }, []);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['appointments', 'summary', range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      getAppointmentSummary({ from: range.from.toISOString(), to: range.to.toISOString() }),
    enabled: isReady,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  const headline = role ? HEADLINE[role] : HEADLINE[Role.RECEPTIONIST];
  const show = (value: number | undefined) => (isLoading || value === undefined ? '—' : value);

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
        <StatCard label="Active" value={show(summary?.active)} hint="Not cancelled or no-show" accent={BRAND} />
        <StatCard
          label="Awaiting confirmation"
          value={show(summary?.counts[AppointmentStatus.SCHEDULED])}
        />
        <StatCard label="Confirmed" value={show(summary?.counts[AppointmentStatus.CONFIRMED])} />
        <StatCard label="Completed" value={show(summary?.counts[AppointmentStatus.COMPLETED])} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyVolumeChart data={summary?.byDay} />
        </div>
        <StatusBreakdown counts={summary?.counts} />
      </div>

      <div className="mt-4">
        <UpcomingList from={range.nowIso} to={range.to.toISOString()} />
      </div>
    </AppShell>
  );
}
