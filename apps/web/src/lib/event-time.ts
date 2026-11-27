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

export function editShape(
  stored: Pick<BabyEvent, "endedAt" | "startedAt"> | null,
  type: string,
  method?: unknown
): EntryShape {
  if (!stored || type !== "feed") return entryShape(type, method);
  return stored.endedAt === stored.startedAt ? "instant" : "span";
}

export type TimeChoice =
  | { kind: "ago"; minutes: number }
  | { kind: "at"; local: string };

export type LengthChoice =
  | { kind: "minutes"; minutes: number }
  | { kind: "start"; local: string };

interface StoredTiming {
  endedAt: string | null;
  startedAt: string;
}

export interface EntryTiming {
  running: boolean;
  time: TimeChoice | null;
  length: LengthChoice | null;
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

export type TimingField = "time" | "length";

export type ResolvedTiming =
  | { ok: true; endedAt: string | null; startedAt: string }
  | { field: TimingField; message: string; ok: false };

const FUTURE_TOLERANCE_MS = 60_000;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(iso: string | number): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function resolveTime(choice: TimeChoice, now: number): number {
  if (choice.kind === "ago") return now - choice.minutes * 60_000;
  return choice.local ? new Date(choice.local).getTime() : Number.NaN;
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
  if (!timing.time) return fail("time", "Pick a time.");
  const at = resolveTime(timing.time, now);
  if (!Number.isFinite(at)) return fail("time", "Pick a time.");
  const inFuture = at > now + FUTURE_TOLERANCE_MS;

  if (shape === "instant") {
    if (inFuture) return fail("time", "That time hasn't happened yet.");
    const iso = new Date(at).toISOString();
    return { endedAt: iso, ok: true, startedAt: iso };
  }

  if (timing.running) {
    if (inFuture) return fail("time", "Start can't be in the future.");
    return { endedAt: null, ok: true, startedAt: new Date(at).toISOString() };
  }

  if (inFuture) return fail("time", "End can't be in the future.");
  if (!timing.length) return fail("length", "Choose how long it lasted.");
  const start =
    timing.length.kind === "minutes"
      ? at - timing.length.minutes * 60_000
      : resolveTime({ kind: "at", local: timing.length.local }, now);
  if (!Number.isFinite(start)) return fail("length", "Pick a start time.");
  if (start >= at) return fail("length", "Start must be before the end.");

  return {
    endedAt: new Date(at).toISOString(),
    ok: true,
    startedAt: new Date(start).toISOString(),
  };
}

export function timingFromEvent(
  event: Pick<BabyEvent, "endedAt" | "startedAt">,
  shape: EntryShape,
  presets: readonly number[] = []
): EntryTiming {
  const stored = { endedAt: event.endedAt, startedAt: event.startedAt };
  const start: TimeChoice = {
    kind: "at",
    local: toLocalInput(event.startedAt),
  };
  if (shape === "instant") {
    return { length: null, running: false, stored, time: start };
  }
  if (!event.endedAt) {
    return { length: null, running: true, stored, time: start };
  }

  const end = toLocalInput(event.endedAt);
  const minutes =
    (new Date(end).getTime() - new Date(start.local).getTime()) / 60_000;
  const length: LengthChoice = presets.includes(minutes)
    ? { kind: "minutes", minutes }
    : { kind: "start", local: start.local };
  return { length, running: false, stored, time: { kind: "at", local: end } };
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

export const BACKDATE_MINUTES = [0, 5, 10, 15, 30] as const;

export function logTimes(
  minutesAgo: number,
  instant: boolean,
  now = Date.now()
): { _endedAt?: string; _startedAt?: string } {
  if (!instant && minutesAgo <= 0) return {};
  const at = new Date(now - Math.max(0, minutesAgo) * 60_000).toISOString();
  return instant ? { _endedAt: at, _startedAt: at } : { _startedAt: at };
}
