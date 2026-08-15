import type { BabyEvent } from "./baby-context";

const DURATION_EVENT_TYPES = new Set(["feed", "pump", "sleep"]);

export interface TimeRange {
  end: number;
  start: number;
}

export function dayRange(date: Date): TimeRange {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { end: end.getTime(), start: start.getTime() };
}

export function isDurationEvent(event: BabyEvent): boolean {
  return DURATION_EVENT_TYPES.has(event.type);
}

function effectiveEnd(event: BabyEvent, now: number): number {
  return event.endedAt ? new Date(event.endedAt).getTime() : now;
}

export function eventOverlapsRange(
  event: BabyEvent,
  range: TimeRange,
  now = Date.now()
): boolean {
  const start = new Date(event.startedAt).getTime();
  if (!Number.isFinite(start)) return false;

  if (!isDurationEvent(event)) {
    return start >= range.start && start < range.end;
  }

  const end = effectiveEnd(event, now);
  if (!(Number.isFinite(end) && end >= start)) return false;

  return start < range.end && end > range.start;
}

export function eventsOverlappingDay(
  events: BabyEvent[],
  date: Date,
  now = Date.now()
): BabyEvent[] {
  const range = dayRange(date);
  return events.filter((event) => eventOverlapsRange(event, range, now));
}

export function durationWithinRange(
  event: BabyEvent,
  range: TimeRange,
  now = Date.now()
): number {
  if (!isDurationEvent(event)) return 0;

  const start = new Date(event.startedAt).getTime();
  const end = effectiveEnd(event, now);
  if (!(Number.isFinite(start) && Number.isFinite(end) && end >= start)) {
    return 0;
  }

  const overlapStart = Math.max(start, range.start);
  const overlapEnd = Math.min(end, range.end);
  return Math.max(0, overlapEnd - overlapStart);
}
