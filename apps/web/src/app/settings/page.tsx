'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { getClinicSettings, updateClinicSettings } from '@/lib/api/clinic';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { AppShell } from '@/components/layout/AppShell';
import { Field, Input } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

export default function SettingsPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isReady && role && role !== Role.ADMIN) {
      router.replace('/dashboard');
    }
  }, [isReady, role, router]);

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: getClinicSettings,
    enabled: isReady && role === Role.ADMIN,
  });

  useEffect(() => {
    if (settings) {
      setStartHour(String(settings.dayStartHour));
      setEndHour(String(settings.dayEndHour));
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateClinicSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['clinic-settings'], updated);
      setSaved(true);
    },
  });

  if (!isReady || role !== Role.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    mutation.mutate({ dayStartHour: Number(startHour), dayEndHour: Number(endHour) });
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Clinic settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Set the hours the calendar shows for {settings?.timezone ?? 'your clinic'}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md rounded-lg border border-line bg-surface p-5 sm:p-6">
        <div className="flex gap-4">
          <Field label="Opens at (hour)" className="flex-1">
            <Input
              type="number"
              min={0}
              max={23}
              value={startHour}
              onChange={(event) => setStartHour(event.target.value)}
              required
            />
          </Field>
          <Field label="Closes at (hour)" className="flex-1">
            <Input
              type="number"
              min={1}
              max={24}
              value={endHour}
              onChange={(event) => setEndHour(event.target.value)}
              required
            />
          </Field>
        </div>

        <p className="mb-4 text-xs text-ink-faint">
          Use a 24-hour clock — 24 means midnight. The calendar shows this window on every day.
        </p>

        {mutation.isError && (
          <div className="mb-4">
            <Banner onDismiss={() => mutation.reset()}>{extractErrorMessage(mutation.error)}</Banner>
          </div>
        )}
        {saved && !mutation.isPending && (
          <p className="mb-4 text-sm text-brand">Saved.</p>
        )}

        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </AppShell>
  );
}
