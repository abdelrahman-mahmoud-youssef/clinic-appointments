import { WorkingHoursWindow } from '@/lib/api/doctors';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export interface DaySchedule {
  label: string;
  hours: string;
}

export function formatWeeklyHours(windows: WorkingHoursWindow[]): DaySchedule[] {
  const byDay = new Map<number, string>();
  for (const day of DAY_ORDER) {
    const dayWindows = windows
      .filter((window) => window.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (dayWindows.length > 0) {
      byDay.set(day, dayWindows.map((window) => `${window.startTime}–${window.endTime}`).join(', '));
    }
  }

  const groups: DaySchedule[] = [];
  let run: number[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const label =
      run.length === 1
        ? DAY_LABELS[run[0]]
        : `${DAY_LABELS[run[0]]}–${DAY_LABELS[run[run.length - 1]]}`;
    groups.push({ label, hours: byDay.get(run[0]) as string });
    run = [];
  };

  for (const day of DAY_ORDER) {
    if (!byDay.has(day)) {
      flush();
      continue;
    }
    if (run.length > 0 && byDay.get(run[run.length - 1]) !== byDay.get(day)) {
      flush();
    }
    run.push(day);
  }
  flush();

  return groups;
}
