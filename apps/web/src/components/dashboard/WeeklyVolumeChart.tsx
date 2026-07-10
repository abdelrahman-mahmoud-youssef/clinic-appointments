import { format, parseISO } from 'date-fns';
import { DayBucket } from '@/lib/api/appointments';

const CHART_HEIGHT = 132;

export function WeeklyVolumeChart({ data }: { data?: DayBucket[] }) {
  const days = data ?? [];
  const max = Math.max(1, ...days.map((day) => day.active));

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="font-display text-xs font-medium uppercase tracking-wide text-ink-faint">
        Appointments per day
      </p>

      {days.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing scheduled in this window.</p>
      ) : (
        <div className="mt-4 flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
          {days.map((day) => {
            const weekday = format(parseISO(day.date), 'EEE');
            return (
              <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-data text-xs tabular-nums text-ink-soft">{day.active || ''}</span>
                <div
                  className="w-full rounded-t bg-brand"
                  style={{
                    height: Math.round((day.active / max) * (CHART_HEIGHT - 34)),
                    minHeight: day.active > 0 ? 4 : 2,
                    opacity: day.active > 0 ? 1 : 0.25,
                  }}
                  title={`${weekday}: ${day.active}`}
                />
                <span className="font-display text-[0.7rem] text-ink-faint">{weekday}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
