export interface WorkingHoursWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// True when [startsAt, endsAt) falls fully inside a single working-hours row
// for that weekday. An appointment spanning midnight (different UTC weekday
// for start vs end) can never fit a single day's window.
export function isWithinWorkingHours(
  windows: WorkingHoursWindow[],
  startsAt: Date,
  endsAt: Date,
): boolean {
  const weekday = startsAt.getUTCDay();
  if (endsAt.getUTCDay() !== weekday) {
    return false;
  }

  const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
  const endMinutes = endsAt.getUTCHours() * 60 + endsAt.getUTCMinutes();

  return windows
    .filter((window) => window.weekday === weekday)
    .some((window) => startMinutes >= toMinutes(window.startTime) && endMinutes <= toMinutes(window.endTime));
}
