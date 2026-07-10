'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { getAppointment } from '@/lib/api/appointments';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { AppShell } from '@/components/layout/AppShell';
import { AppointmentDetailView } from '@/components/appointments/AppointmentDetailView';
import { Banner } from '@/components/ui/Banner';

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isReady = useRequireAuth();

  const { data: appointment, isLoading, isError, error } = useQuery({
    queryKey: ['appointments', 'detail', id],
    queryFn: () => getAppointment(id),
    enabled: isReady,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  return (
    <AppShell>
      <Link
        href="/appointments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <span aria-hidden>←</span> Back to appointments
      </Link>

      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : isError || !appointment ? (
        <Banner>{isError ? extractErrorMessage(error) : 'Appointment not found.'}</Banner>
      ) : (
        <div className="max-w-xl">
          <h1 className="mb-4 font-display text-2xl font-semibold text-ink">
            {appointment.reason || 'Appointment'}
          </h1>
          <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <AppointmentDetailView appointment={appointment} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
