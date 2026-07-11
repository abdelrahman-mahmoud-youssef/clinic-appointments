'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listDoctors } from '@/lib/api/doctors';
import { AppShell } from '@/components/layout/AppShell';

export default function DoctorsPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && role && role !== Role.ADMIN) router.replace('/dashboard');
  }, [isReady, role, router]);

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: listDoctors,
    enabled: isReady && role === Role.ADMIN,
  });

  if (!isReady || role !== Role.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Doctors</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Doctors are added on the Staff page when you create a doctor account.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {doctors.length === 0 ? (
          <p className="p-5 text-sm text-ink-soft">No doctors yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {doctors.map((doctor) => (
              <li key={doctor.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xs font-semibold text-brand">
                  {doctor.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-ink">{doctor.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
