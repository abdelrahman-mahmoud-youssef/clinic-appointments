export interface WorkingHoursWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedParts(date: Date, timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(lookup('hour')) % 24;
  return { weekday: WEEKDAY_INDEX[lookup('weekday')], minutes: hour * 60 + Number(lookup('minute')) };
}

export function isWithinWorkingHours(
  windows: WorkingHoursWindow[],
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): boolean {
  const start = zonedParts(startsAt, timeZone);
  const end = zonedParts(endsAt, timeZone);
  if (end.weekday !== start.weekday) {
    return false;
  }

  return windows
    .filter((window) => window.weekday === start.weekday)
    .some((window) => start.minutes >= toMinutes(window.startTime) && end.minutes <= toMinutes(window.endTime));
}
