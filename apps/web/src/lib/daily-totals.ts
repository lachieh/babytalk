import type { BabyEvent } from "./baby-context";
import { capitalize, parseMeta } from "./event-meta";
import { dayRange, durationWithinRange } from "./event-time";
import { formatVolume } from "./use-volume-unit";
import type { VolumeUnit } from "./use-volume-unit";

export function startOfDay(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  d.setMilliseconds(-1);
  return d;
}

export function eventsForDay(events: BabyEvent[], date: Date): BabyEvent[] {
  const range = dayRange(date);
  return events.filter((event) => {
    const startedAt = new Date(event.startedAt).getTime();
    return startedAt >= range.start && startedAt < range.end;
  });
}

export function totalFedMl(events: BabyEvent[]): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== "feed") continue;
    try {
      const meta = JSON.parse(e.metadata);
      total += meta.amountMl || 0;
    } catch {
      /* ignore */
    }
  }
  return total;
}

export function totalSleepMinutes(events: BabyEvent[]): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== "sleep" || !e.endedAt) continue;
    total +=
      (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) /
      60_000;
  }
  return total;
}

export function totalSleepMinutesForDay(
  events: BabyEvent[],
  date: Date,
  now = Date.now()
): number {
  const range = dayRange(date);
  let total = 0;
  for (const event of events) {
    if (event.type !== "sleep") continue;
    total += durationWithinRange(event, range, now) / 60_000;
  }
  return total;
}

export function totalDiapers(events: BabyEvent[]): number {
  return events.filter((e) => e.type === "diaper").length;
}

export const NO_VALUE = "\u2014";

export function formatSleepDuration(minutes: number): string {
  const m = Math.floor(minutes);
  if (m <= 0) return NO_VALUE;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function totalFeeds(events: BabyEvent[]): number {
  return events.filter((e) => e.type === "feed").length;
}

export function recordedAmountMl(event: BabyEvent): number {
  const { amountMl } = parseMeta(event.metadata);
  return typeof amountMl === "number" && amountMl > 0 ? amountMl : 0;
}

const byMostRecentStart = (a: BabyEvent, b: BabyEvent): number =>
  new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();

export function lastAmountMl(
  events: BabyEvent[],
  type: "feed" | "pump"
): number | null {
  const [latest] = events
    .filter((e) => e.type === type && recordedAmountMl(e) > 0)
    .toSorted(byMostRecentStart);
  return latest ? recordedAmountMl(latest) : null;
}

const AMOUNT_PROMPT_WINDOW_MS = 15 * 60_000;

export function methodTakesAmount(meta: Record<string, unknown>): boolean {
  return meta.method === "bottle" || meta.method === "formula";
}

export function takesAmount(event: BabyEvent): boolean {
  if (event.type === "pump") return true;
  return event.type === "feed" && methodTakesAmount(parseMeta(event.metadata));
}

type OneTapAction = "instant" | "amount" | "timer";

export function oneTapAction(
  type: string,
  meta: Record<string, unknown>
): OneTapAction {
  if (type === "diaper" || type === "note") return "instant";
  if (type !== "feed") return "timer";
  if (methodTakesAmount(meta)) return "amount";
  return meta.method === "solid" ? "instant" : "timer";
}

export type LastEventDetail = {
  detail: string | null;
  ago: string;
  active?: boolean;
} | null;

function formatShortAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  return formatSleepDuration(minutes);
}

const agoLine = (ms: number) => {
  const age = formatShortAge(ms);
  return age === "just now" ? age : `${age} ago`;
};

function latestStartedEvent(
  events: BabyEvent[],
  type: string,
  now: number
): BabyEvent | null {
  let latest: BabyEvent | null = null;
  for (const event of events) {
    if (event.type !== type) continue;
    const startedAt = Date.parse(event.startedAt);
    if (startedAt > now) continue;
    if (!latest || startedAt > Date.parse(latest.startedAt)) latest = event;
  }
  return latest;
}

function sleepDetail(event: BabyEvent, now: number): LastEventDetail {
  if (event.endedAt === null) {
    return { active: true, ago: "asleep now", detail: null };
  }
  const endedAt = Date.parse(event.endedAt);
  const slept = formatSleepDuration(
    (endedAt - Date.parse(event.startedAt)) / 60_000
  );
  const awake = formatShortAge(now - endedAt);
  return {
    active: false,
    ago: awake === "just now" ? "just woke" : `awake ${awake}`,
    detail: slept === NO_VALUE ? null : `slept ${slept}`,
  };
}

function feedDetail(
  event: BabyEvent,
  now: number,
  unit: VolumeUnit
): LastEventDetail {
  const meta = parseMeta(event.metadata);
  const parts: string[] = [];
  const amount = recordedAmountMl(event);
  if (amount > 0) parts.push(formatVolume(amount, unit));
  if (meta.method === "breast" && typeof meta.side === "string") {
    parts.push(`${capitalize(meta.side)} breast`);
  } else if (typeof meta.method === "string") {
    parts.push(capitalize(meta.method));
  }
  const feeding = event.endedAt === null;
  return {
    active: feeding,
    ago: feeding ? "feeding now" : agoLine(now - Date.parse(event.startedAt)),
    detail: parts.length > 0 ? parts.join(" · ") : null,
  };
}

function diaperDetail(event: BabyEvent, now: number): LastEventDetail {
  const meta = parseMeta(event.metadata);
  const parts: string[] = [];
  if (meta.wet) parts.push("Wet");
  if (meta.soiled) parts.push("Soiled");
  return {
    ago: agoLine(now - Date.parse(event.startedAt)),
    detail: parts.length > 0 ? parts.join(" + ") : null,
  };
}

export function lastEventDetails(
  events: BabyEvent[],
  now: number,
  unit: VolumeUnit
): { feed: LastEventDetail; sleep: LastEventDetail; diaper: LastEventDetail } {
  const feed = latestStartedEvent(events, "feed", now);
  const sleep = latestStartedEvent(events, "sleep", now);
  const diaper = latestStartedEvent(events, "diaper", now);
  return {
    diaper: diaper ? diaperDetail(diaper, now) : null,
    feed: feed ? feedDetail(feed, now, unit) : null,
    sleep: sleep ? sleepDetail(sleep, now) : null,
  };
}

export function eventAwaitingAmount(
  events: BabyEvent[],
  type: "feed" | "pump",
  now: number,
  dismissedIds: ReadonlySet<string> = new Set()
): BabyEvent | null {
  const candidates = events.filter((event) => {
    if (event.type !== type || !event.endedAt) return false;
    if (dismissedIds.has(event.id) || !takesAmount(event)) return false;
    if (event.endedAt === event.startedAt) return false;
    if (recordedAmountMl(event) > 0) return false;
    const sinceStop = now - new Date(event.endedAt).getTime();
    return sinceStop >= 0 && sinceStop <= AMOUNT_PROMPT_WINDOW_MS;
  });
  return (
    candidates.toSorted(
      (a, b) =>
        new Date(b.endedAt ?? 0).getTime() - new Date(a.endedAt ?? 0).getTime()
    )[0] ?? null
  );
}
