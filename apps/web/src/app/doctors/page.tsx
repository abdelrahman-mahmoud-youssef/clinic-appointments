'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listDoctors, createDoctor } from '@/lib/api/doctors';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { AppShell } from '@/components/layout/AppShell';
import { Field, Input } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

export default function DoctorsPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (isReady && role && role !== Role.ADMIN) router.replace('/dashboard');
  }, [isReady, role, router]);

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: listDoctors,
    enabled: isReady && role === Role.ADMIN,
  });

  const create = useMutation({
    mutationFn: () => createDoctor(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setName('');
    },
  });

  if (!isReady || role !== Role.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Doctors</h1>
        <p className="mt-1 text-sm text-ink-soft">Add doctors and see who is on staff.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-line bg-surface p-5 lg:col-span-1"
        >
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Add a doctor</h2>
          <Field label="Full name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Dr. Jane Smith"
              required
            />
          </Field>
          {create.isError && (
            <div className="mb-3">
              <Banner onDismiss={() => create.reset()}>{extractErrorMessage(create.error)}</Banner>
            </div>
          )}
          <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
            {create.isPending ? 'Adding…' : 'Add doctor'}
          </Button>
        </form>

        <div className="rounded-lg border border-line bg-surface lg:col-span-2">
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
      </div>
    </AppShell>
  );
}
