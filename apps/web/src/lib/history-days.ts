import type { BabyEvent } from "./baby-context";
import { startOfDay } from "./daily-totals";
import { eventsOverlappingDay } from "./event-time";

export const RECENT_EVENTS_LIMIT = 100;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

export interface DayGroup {
  key: string;
  date: Date;
  events: BabyEvent[];
}

export function groupEventsByDay(events: BabyEvent[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const event of events) {
    const date = startOfDay(new Date(event.startedAt));
    if (Number.isNaN(date.getTime())) continue;
    const key = ymd(date);
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, { date, events: [event], key });
    }
  }
  return [...groups.values()];
}

export function recentDays(today: Date, count: number): Date[] {
  const start = startOfDay(today);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() - i);
    return d;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function fullyCoveredDays({
  events,
  today,
  maxDays,
  limit = RECENT_EVENTS_LIMIT,
}: {
  events: BabyEvent[];
  today: Date;
  maxDays: number;
  limit?: number;
}): number {
  if (events.length < limit) return maxDays;

  let oldest = Number.POSITIVE_INFINITY;
  for (const event of events) {
    const t = new Date(event.startedAt).getTime();
    if (t < oldest) oldest = t;
  }
  if (!Number.isFinite(oldest)) return maxDays;

  const firstFullDay = startOfDay(new Date(oldest));
  firstFullDay.setDate(firstFullDay.getDate() + 1);
  const days =
    Math.round(
      (startOfDay(today).getTime() - firstFullDay.getTime()) / DAY_MS
    ) + 1;
  return Math.min(maxDays, Math.max(1, days));
}

export function recapDays({
  events,
  today,
  maxDays,
  limit = RECENT_EVENTS_LIMIT,
  now = Date.now(),
}: {
  events: BabyEvent[];
  today: Date;
  maxDays: number;
  limit?: number;
  now?: number;
}): { covered: number; days: Date[] } {
  const covered = fullyCoveredDays({ events, limit, maxDays, today });
  const todayKey = ymd(today);
  const days = recentDays(today, covered).filter(
    (date) =>
      ymd(date) === todayKey ||
      eventsOverlappingDay(events, date, now).length > 0
  );
  return { covered, days };
}

export function coverageCaption(shown: number, covered: number): string {
  if (shown <= 1) return "Showing today";
  if (shown >= covered) return `Showing the last ${covered} days`;
  return `Showing ${shown} days with entries from the last ${covered}`;
}
