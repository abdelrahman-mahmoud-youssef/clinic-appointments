'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { listAppointments } from '@/lib/api/appointments';
import { Badge } from '@/components/ui/Badge';
import { STATUS_COLORS, STATUS_LABELS } from '@/components/calendar/statusColors';

const MAX_ITEMS = 6;

export function UpcomingList({ from, to }: { from: string; to: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['appointments', 'upcoming', from, to],
    queryFn: () => listAppointments({ from, to }),
  });

  const items = data.slice(0, MAX_ITEMS);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="font-display text-xs font-medium uppercase tracking-wide text-ink-faint">Upcoming</p>

      {isLoading ? (
        <p className="mt-3 text-sm text-ink-soft">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No upcoming appointments.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((appointment) => (
            <li key={appointment.id} className="flex items-center gap-3 py-2.5">
              <div className="w-14 shrink-0 font-data text-xs leading-tight tabular-nums text-ink-soft">
                <div>{format(new Date(appointment.startsAt), 'EEE')}</div>
                <div className="text-ink">{format(new Date(appointment.startsAt), 'HH:mm')}</div>
              </div>
              <span className="flex-1 truncate text-sm text-ink">
                {appointment.reason || 'Appointment'}
              </span>
              <Badge color={STATUS_COLORS[appointment.status]}>
                {STATUS_LABELS[appointment.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
