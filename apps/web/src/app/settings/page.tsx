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
import { Field, Input, Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

function hourLabel(hour: number): string {
  if (hour === 24) return '24:00 (midnight)';
  return `${String(hour).padStart(2, '0')}:00`;
}

const START_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const END_HOURS = Array.from({ length: 24 }, (_, index) => index + 1);

function WindowPreview({ start, end }: { start: number; end: number }) {
  const left = (start / 24) * 100;
  const width = (Math.max(end - start, 0) / 24) * 100;
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-md border border-line bg-bg">
        <div
          className="absolute inset-y-0 rounded-sm bg-brand/80"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-data text-[0.7rem] text-ink-faint">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [startHour, setStartHour] = useState(12);
  const [endHour, setEndHour] = useState(24);
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
      setName(settings.name);
      setStartHour(settings.dayStartHour);
      setEndHour(settings.dayEndHour);
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

  const invalidRange = endHour <= startHour;
  const invalidName = name.trim().length < 2;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (invalidRange || invalidName) return;
    setSaved(false);
    mutation.mutate({ name: name.trim(), dayStartHour: startHour, dayEndHour: endHour });
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Clinic settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {settings?.name ?? 'Your clinic'} · {settings?.timezone ?? '—'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-lg border border-line bg-surface p-5 sm:p-6"
      >
        <Field label="Clinic name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Clinic name"
          />
        </Field>
        {invalidName && (
          <p className="mt-2 text-sm text-danger">Clinic name must be at least 2 characters.</p>
        )}

        <hr className="my-5 border-line" />

        <h2 className="font-display text-sm font-semibold text-ink">Calendar hours</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The window the calendar shows on every day. Times are in the clinic timezone.
        </p>

        <div className="mt-4 flex gap-4">
          <Field label="Opens" className="flex-1">
            <Select
              value={startHour}
              onChange={(event) => setStartHour(Number(event.target.value))}
            >
              {START_HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Closes" className="flex-1">
            <Select value={endHour} onChange={(event) => setEndHour(Number(event.target.value))}>
              {END_HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <WindowPreview start={startHour} end={endHour} />
        </div>

        {invalidRange && (
          <p className="mt-3 text-sm text-danger">Closing time must be after opening time.</p>
        )}

        {mutation.isError && (
          <div className="mt-4">
            <Banner onDismiss={() => mutation.reset()}>{extractErrorMessage(mutation.error)}</Banner>
          </div>
        )}
        {saved && !mutation.isPending && <p className="mt-4 text-sm text-brand">Saved.</p>}

        <div className="mt-5">
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending || invalidRange || invalidName}
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
