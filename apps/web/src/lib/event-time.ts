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

export type EntryShape = "instant" | "span";

export function entryShape(type: string, method?: unknown): EntryShape {
  if (type === "sleep" || type === "pump") return "span";
  if (type === "feed") return method === "solid" ? "instant" : "span";
  return "instant";
}

export type TimeChoice =
  | { kind: "ago"; minutes: number }
  | { kind: "at"; local: string };

export const NOW: TimeChoice = { kind: "ago", minutes: 0 };

interface StoredTiming {
  endedAt: string | null;
  startedAt: string;
}

export interface EntryTiming {
  end: TimeChoice;
  running: boolean;
  start: TimeChoice;
  /** The saved times, kept verbatim until a timing field changes. */
  stored?: StoredTiming;
}

export function changeTiming(
  timing: EntryTiming,
  patch: Partial<Omit<EntryTiming, "stored">>
): EntryTiming {
  const { stored: _stored, ...rest } = timing;
  return { ...rest, ...patch };
}

export type TimingField = "start" | "end";

export type ResolvedTiming =
  | { ok: true; endedAt: string | null; startedAt: string }
  | { field: TimingField; message: string; ok: false };

const FUTURE_TOLERANCE_MS = 60_000;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(iso: string | number): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function resolveTime(choice: TimeChoice, now = Date.now()): number {
  if (choice.kind === "ago") return now - choice.minutes * 60_000;
  return choice.local ? new Date(choice.local).getTime() : Number.NaN;
}

export function pastTimeError(
  choice: TimeChoice,
  now = Date.now()
): string | undefined {
  const at = resolveTime(choice, now);
  if (!Number.isFinite(at)) return "Pick a time.";
  if (at > now + FUTURE_TOLERANCE_MS) return "That time hasn't happened yet.";
  return undefined;
}

const fail = (field: TimingField, message: string): ResolvedTiming => ({
  field,
  message,
  ok: false,
});

export function resolveEntryTiming(
  shape: EntryShape,
  timing: EntryTiming,
  now = Date.now()
): ResolvedTiming {
  if (timing.stored) return { ok: true, ...timing.stored };
  const end = resolveTime(timing.end, now);

  if (shape === "instant") {
    const error = pastTimeError(timing.end, now);
    if (error) return fail("end", error);
    const iso = new Date(end).toISOString();
    return { endedAt: iso, ok: true, startedAt: iso };
  }

  const start = resolveTime(timing.start, now);
  if (!Number.isFinite(start)) return fail("start", "Pick a start time.");
  if (start > now + FUTURE_TOLERANCE_MS) {
    return fail("start", "Start can't be in the future.");
  }
  const startedAt = new Date(start).toISOString();
  if (timing.running) return { endedAt: null, ok: true, startedAt };

  if (!Number.isFinite(end)) return fail("end", "Pick an end time.");
  if (end > now + FUTURE_TOLERANCE_MS) {
    return fail("end", "End can't be in the future.");
  }
  if (start >= end) return fail("start", "Start must be before the end.");

  return { endedAt: new Date(end).toISOString(), ok: true, startedAt };
}

export function timingFromEvent(
  event: Pick<BabyEvent, "endedAt" | "startedAt">,
  shape: EntryShape
): EntryTiming {
  const stored = { endedAt: event.endedAt, startedAt: event.startedAt };
  const start: TimeChoice = {
    kind: "at",
    local: toLocalInput(event.startedAt),
  };
  if (shape === "instant") {
    return { end: start, running: false, start, stored };
  }
  if (!event.endedAt) {
    return { end: NOW, running: true, start, stored };
  }
  const end: TimeChoice = { kind: "at", local: toLocalInput(event.endedAt) };
  return { end, running: false, start, stored };
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

export function logTimes(
  when: TimeChoice,
  instant: boolean,
  now = Date.now()
): { _endedAt?: string; _startedAt?: string } {
  const resolved = resolveTime(when, now);
  const at = Number.isFinite(resolved) ? Math.min(resolved, now) : now;
  if (!instant && at >= now) return {};
  const iso = new Date(at).toISOString();
  return instant ? { _endedAt: iso, _startedAt: iso } : { _startedAt: iso };
}
