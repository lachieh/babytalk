import type { BabyEvent } from "@/lib/baby-context";

export interface WeekEventsResponse {
  eventsOverlappingRange: BabyEvent[];
}

export function filterWeekEvents(data: WeekEventsResponse): BabyEvent[] {
  return data.eventsOverlappingRange.filter((event) =>
    Number.isFinite(new Date(event.startedAt).getTime())
  );
}

const DAYS_IN_WEEK = 7;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export function getWeekStart(reference: Date): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - reference.getDay()
  );
}

export function weekDayStart(weekStart: Date, offset: number): Date {
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + offset
  );
}

export function wallClockHours(date: Date): number {
  return (
    date.getHours() +
    date.getMinutes() / 60 +
    date.getSeconds() / 3600 +
    date.getMilliseconds() / 3_600_000
  );
}

export function weekDayIndex(date: Date, weekStart: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const start = Date.UTC(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate()
  );
  return Math.round((day - start) / MS_PER_DAY);
}

const INSTANT_TYPES = new Set(["diaper", "note"]);

export interface WeekMark {
  id: string;
  event: BabyEvent;
  dayIdx: number;
  startHour: number;
  endHour: number;
  kind: "instant" | "span";
  running: boolean;
  openEnd: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

interface Span {
  end: number;
  running: boolean;
  start: number;
}

function resolveSpan(event: BabyEvent, now: number): Span | null {
  const start = new Date(event.startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  if (INSTANT_TYPES.has(event.type)) {
    return { end: start, running: false, start };
  }
  if (event.endedAt === null) {
    return now > start
      ? { end: now, running: true, start }
      : { end: start, running: false, start };
  }
  const end = new Date(event.endedAt).getTime();
  return {
    end: Number.isFinite(end) && end > start ? end : start,
    running: false,
    start,
  };
}

export function buildWeekMarks(
  events: BabyEvent[],
  weekStart: Date,
  now: number
): WeekMark[] {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekDayStart(weekStart, DAYS_IN_WEEK).getTime();
  const marks: WeekMark[] = [];

  for (const event of events) {
    const span = resolveSpan(event, now);
    if (!span) continue;

    if (span.end === span.start) {
      if (span.start < weekStartMs || span.start >= weekEndMs) continue;
      const at = new Date(span.start);
      const dayIdx = weekDayIndex(at, weekStart);
      const hour = wallClockHours(at);
      marks.push({
        continuesAfter: false,
        continuesBefore: false,
        dayIdx,
        endHour: hour,
        event,
        id: `${event.id}:${dayIdx}`,
        kind: "instant",
        openEnd: false,
        running: false,
        startHour: hour,
      });
      continue;
    }

    if (span.start >= weekEndMs || span.end <= weekStartMs) continue;

    const from = Math.max(span.start, weekStartMs);
    const to = Math.min(span.end, weekEndMs);
    let cursor = from;
    while (cursor < to) {
      const dayIdx = weekDayIndex(new Date(cursor), weekStart);
      const dayStartMs = weekDayStart(weekStart, dayIdx).getTime();
      const dayEndMs = weekDayStart(weekStart, dayIdx + 1).getTime();
      const pieceEnd = Math.min(to, dayEndMs);
      const startHour =
        cursor === dayStartMs ? 0 : wallClockHours(new Date(cursor));
      const endHour =
        pieceEnd === dayEndMs
          ? 24
          : Math.max(startHour, wallClockHours(new Date(pieceEnd)));

      marks.push({
        continuesAfter: pieceEnd < span.end,
        continuesBefore: cursor > span.start,
        dayIdx,
        endHour,
        event,
        id: `${event.id}:${dayIdx}`,
        kind: "span",
        openEnd: span.running && pieceEnd === span.end,
        running: span.running,
        startHour,
      });

      cursor = pieceEnd;
    }
  }

  return marks.toSorted(
    (a, b) =>
      a.dayIdx - b.dayIdx ||
      a.startHour - b.startHour ||
      a.id.localeCompare(b.id)
  );
}

export interface WeekDaySummary {
  date: Date;
  diapers: number;
  feeds: number;
  notes: number;
  pumps: number;
  sleepMs: number;
  sleeps: number;
}

const COUNT_KEYS: Record<string, "diapers" | "feeds" | "notes" | "pumps"> = {
  diaper: "diapers",
  feed: "feeds",
  note: "notes",
  pump: "pumps",
};

export function summarizeWeek(
  events: BabyEvent[],
  weekStart: Date,
  now: number
): WeekDaySummary[] {
  const days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => ({
    end: weekDayStart(weekStart, i + 1).getTime(),
    start: weekDayStart(weekStart, i).getTime(),
    summary: {
      date: weekDayStart(weekStart, i),
      diapers: 0,
      feeds: 0,
      notes: 0,
      pumps: 0,
      sleepMs: 0,
      sleeps: 0,
    } satisfies WeekDaySummary as WeekDaySummary,
  }));

  for (const event of events) {
    const span = resolveSpan(event, now);
    if (!span) continue;

    for (const day of days) {
      const startsToday = span.start >= day.start && span.start < day.end;
      if (event.type === "sleep") {
        const overlap =
          Math.min(span.end, day.end) - Math.max(span.start, day.start);
        if (overlap > 0) {
          day.summary.sleepMs += overlap;
          day.summary.sleeps += 1;
        } else if (startsToday && span.end === span.start) {
          day.summary.sleeps += 1;
        }
        continue;
      }
      const key = COUNT_KEYS[event.type];
      if (key && startsToday) day.summary[key] += 1;
    }
  }

  return days.map((day) => day.summary);
}

export function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function describeDay(summary: WeekDaySummary): string {
  const parts: string[] = [];
  if (summary.sleepMs > 0) parts.push(`${formatSpan(summary.sleepMs)} sleep`);
  else if (summary.sleeps > 0) parts.push("Sleep logged");
  if (summary.feeds > 0) parts.push(plural(summary.feeds, "feed", "feeds"));
  if (summary.diapers > 0)
    parts.push(plural(summary.diapers, "diaper", "diapers"));
  if (summary.pumps > 0) parts.push(plural(summary.pumps, "pump", "pumps"));
  if (summary.notes > 0) parts.push(plural(summary.notes, "note", "notes"));
  return parts.length > 0 ? parts.join(", ") : "Nothing logged";
}
