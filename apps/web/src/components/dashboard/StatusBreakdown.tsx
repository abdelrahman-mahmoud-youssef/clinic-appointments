import { AppointmentStatus } from '@clinic/shared';
import { STATUS_COLORS, STATUS_LABELS } from '@/components/calendar/statusColors';

const ORDER: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

export function StatusBreakdown({ counts }: { counts?: Record<AppointmentStatus, number> }) {
  const resolved = counts ?? ({} as Record<AppointmentStatus, number>);
  const value = (status: AppointmentStatus) => resolved[status] ?? 0;
  const total = ORDER.reduce((sum, status) => sum + value(status), 0);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="font-display text-xs font-medium uppercase tracking-wide text-ink-faint">
        By status
      </p>

      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No appointments in this window.</p>
      ) : (
        <>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {ORDER.filter((status) => value(status) > 0).map((status) => (
              <span
                key={status}
                style={{ backgroundColor: STATUS_COLORS[status], flexGrow: value(status) }}
                title={`${STATUS_LABELS[status]}: ${value(status)}`}
              />
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {ORDER.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                <dt className="text-sm text-ink-soft">{STATUS_LABELS[status]}</dt>
                <dd className="ml-auto font-data text-sm tabular-nums text-ink">{value(status)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
