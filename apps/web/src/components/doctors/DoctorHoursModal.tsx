'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Doctor,
  WorkingHoursWindow,
  getDoctorAvailability,
  setDoctorAvailability,
} from '@/lib/api/doctors';
import { getClinicSettings } from '@/lib/api/clinic';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

interface DayState {
  open: boolean;
  start: string;
  end: string;
}

function timeOptions(startHour: number, endHour: number): string[] {
  const options: string[] = [];
  for (let minute = startHour * 60; minute <= endHour * 60; minute += 30) {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    options.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  }
  return options;
}

export function DoctorHoursModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: windows } = useQuery({
    queryKey: ['doctor-availability', doctor.id],
    queryFn: () => getDoctorAvailability(doctor.id),
  });
  const { data: clinic } = useQuery({ queryKey: ['clinic-settings'], queryFn: getClinicSettings });

  const [days, setDays] = useState<Record<number, DayState> | null>(null);

  const options = useMemo(
    () => (clinic ? timeOptions(clinic.dayStartHour, clinic.dayEndHour) : []),
    [clinic],
  );

  useEffect(() => {
    if (!windows || options.length === 0) return;
    const defaultStart = options[0];
    const defaultEnd = options[options.length - 1];
    const next: Record<number, DayState> = {};
    for (const day of DAY_ORDER) {
      const existing = windows.find((window) => window.weekday === day);
      const fitsWindow =
        existing &&
        options.includes(existing.startTime) &&
        options.includes(existing.endTime) &&
        existing.startTime < existing.endTime;
      if (fitsWindow) {
        next[day] = { open: true, start: existing.startTime, end: existing.endTime };
      } else if (existing) {
        next[day] = { open: true, start: defaultStart, end: defaultEnd };
      } else {
        next[day] = { open: false, start: defaultStart, end: defaultEnd };
      }
    }
    setDays(next);
  }, [windows, options]);

  const invalidDay = days
    ? DAY_ORDER.find((day) => days[day].open && days[day].end <= days[day].start)
    : undefined;
  const hasInvalid = invalidDay !== undefined;

  const save = useMutation({
    mutationFn: () => {
      const payload: WorkingHoursWindow[] = DAY_ORDER.filter((day) => days![day].open).map((day) => ({
        weekday: day,
        startTime: days![day].start,
        endTime: days![day].end,
      }));
      return setDoctorAvailability(doctor.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-availability', doctor.id] });
      onClose();
    },
  });

  function update(day: number, patch: Partial<DayState>) {
    setDays((prev) => (prev ? { ...prev, [day]: { ...prev[day], ...patch } } : prev));
  }

  return (
    <Modal title={`Working hours — ${doctor.name}`} onClose={onClose}>
      {!days ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-soft">
            One shift per day, within the clinic window ({options[0]}–{options[options.length - 1]}).
          </p>

          <div className="flex flex-col gap-2">
            {DAY_ORDER.map((day) => {
              const state = days[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <label className="flex w-28 shrink-0 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={state.open}
                      onChange={(event) => update(day, { open: event.target.checked })}
                    />
                    {DAY_LABELS[day]}
                  </label>
                  {state.open ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={state.start}
                        onChange={(event) => update(day, { start: event.target.value })}
                        className="w-24"
                      >
                        {options.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </Select>
                      <span className="text-ink-faint">–</span>
                      <Select
                        value={state.end}
                        onChange={(event) => update(day, { end: event.target.value })}
                        className="w-24"
                      >
                        {options.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <span className="text-sm text-ink-faint">Closed</span>
                  )}
                </div>
              );
            })}
          </div>

          {hasInvalid && (
            <p className="mt-3 text-sm text-danger">
              {DAY_LABELS[invalidDay as number]}: closing time must be after opening time.
            </p>
          )}
          {save.isError && (
            <div className="mt-3">
              <Banner onDismiss={() => save.reset()}>{extractErrorMessage(save.error)}</Banner>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={save.isPending || hasInvalid}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save hours'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
