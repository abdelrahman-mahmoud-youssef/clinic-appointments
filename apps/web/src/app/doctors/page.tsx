'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listDoctors, getDoctorAvailability, Doctor } from '@/lib/api/doctors';
import { formatWeeklyHours } from '@/lib/doctorHours';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { DoctorHoursModal } from '@/components/doctors/DoctorHoursModal';

function DoctorRow({ doctor, onEdit }: { doctor: Doctor; onEdit: () => void }) {
  const { data: windows = [], isLoading } = useQuery({
    queryKey: ['doctor-availability', doctor.id],
    queryFn: () => getDoctorAvailability(doctor.id),
  });
  const schedule = formatWeeklyHours(windows);

  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xs font-semibold text-brand">
        {doctor.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{doctor.name}</p>
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-5">
          {isLoading ? (
            <span>Loading hours…</span>
          ) : schedule.length === 0 ? (
            <span className="text-ink-faint">No working hours set</span>
          ) : (
            schedule.map((group) => (
              <span key={group.label}>
                <span className="font-medium">{group.label}</span>{' '}
                <span className="font-data text-ink">{group.hours}</span>
              </span>
            ))
          )}
        </div>
      </div>
      <Button variant="secondary" className="shrink-0" onClick={onEdit}>
        Edit hours
      </Button>
    </li>
  );
}

export default function DoctorsPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && role && role !== Role.ADMIN) router.replace('/dashboard');
  }, [isReady, role, router]);

  const [editing, setEditing] = useState<Doctor | null>(null);

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
          Working hours are shown in the clinic timezone. Doctors are added on the Staff page.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        {doctors.length === 0 ? (
          <p className="p-5 text-sm text-ink-soft">No doctors yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {doctors.map((doctor) => (
              <DoctorRow key={doctor.id} doctor={doctor} onEdit={() => setEditing(doctor)} />
            ))}
          </ul>
        )}
      </div>

      {editing && <DoctorHoursModal doctor={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}
