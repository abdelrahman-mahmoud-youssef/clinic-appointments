export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

// Half-open intervals [startsAt, endsAt): back-to-back ranges do not collide.
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}
