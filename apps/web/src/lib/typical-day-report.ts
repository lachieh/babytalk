import type { BabyEvent } from "./baby-context";
import { recordedAmountMl, startOfDay } from "./daily-totals";

export const MIN_LOGGED_DAYS = 3;
const MAX_WINDOWS = 12;
const MONTH_MODE_FROM_DAYS = 91;

const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const DAY_MS = 86_400_000;
const MAX_FEED_MINUTES = 180;
const MAX_SLEEP_MINUTES = 16 * 60;
const STEADY_SHARE = 0.1;

export type Granularity = "week" | "month";
export type Direction = "up" | "down" | "steady";

export type MetricKey =
  | "feedsPerDay"
  | "feedVolumePerDay"
  | "feedLength"
  | "sleepPerDay"
  | "longestSleep"
  | "diapersPerDay"
  | "pumpsPerDay"
  | "pumpVolumePerDay";

const METRIC_KEYS: MetricKey[] = [
  "feedsPerDay",
  "feedVolumePerDay",
  "feedLength",
  "sleepPerDay",
  "longestSleep",
  "diapersPerDay",
  "pumpsPerDay",
  "pumpVolumePerDay",
];

export interface MetricTrend {
  current: number | null;
  currentDays: number;
  hasData: boolean;
  points: (number | null)[];
  previous: number | null;
}

export interface TrendWindow {
  start: Date;
  end: Date;
}

export interface TypicalDayReport {
  currentLoggedDays: number;
  firstLoggedDay: Date | null;
  granularity: Granularity;
  metrics: Record<MetricKey, MetricTrend>;
  status: "empty" | "thin" | "ready";
  windowDays: number;
  windows: TrendWindow[];
}

interface DayStats {
  diapers: number;
  events: number;
  feedMinutes: number;
  feedMl: number;
  feeds: number;
  feedsWithVolume: number;
  longestSleepMinutes: number;
  pumpMl: number;
  pumps: number;
  pumpsWithVolume: number;
  sleepMinutes: number;
  timedFeeds: number;
}

const emptyDay = (): DayStats => ({
  diapers: 0,
  events: 0,
  feedMinutes: 0,
  feedMl: 0,
  feeds: 0,
  feedsWithVolume: 0,
  longestSleepMinutes: 0,
  pumpMl: 0,
  pumps: 0,
  pumpsWithVolume: 0,
  sleepMinutes: 0,
  timedFeeds: 0,
});

const addDays = (date: Date, count: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

function parseBirthDay(birthDate: string | null | undefined): Date | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : startOfDay(new Date(birthDate));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function historyStart(now: Date, birthDate?: string | null): Date {
  const horizon = addDays(startOfDay(now), -MONTH_DAYS * MAX_WINDOWS);
  const birth = parseBirthDay(birthDate);
  if (!birth || birth.getTime() > now.getTime()) return horizon;
  return birth > horizon ? birth : horizon;
}

function minutesBetween(startMs: number, endedAt: string | null): number {
  if (!endedAt) return 0;
  const minutes = (new Date(endedAt).getTime() - startMs) / 60_000;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function addSleep(
  days: DayStats[],
  origin: Date,
  startMs: number,
  minutes: number
): void {
  const endMs = startMs + minutes * 60_000;
  let cursor = startMs;
  let index = daysBetween(origin, startOfDay(startMs));
  while (cursor < endMs && index < days.length) {
    const nextDay = addDays(origin, index + 1).getTime();
    const sliceEnd = Math.min(endMs, nextDay);
    const day = days[index];
    if (day) {
      day.sleepMinutes += (sliceEnd - cursor) / 60_000;
      day.events += 1;
    }
    cursor = sliceEnd;
    index += 1;
  }
  const wakeDay = days[daysBetween(origin, startOfDay(endMs - 1))];
  if (wakeDay && minutes > wakeDay.longestSleepMinutes) {
    wakeDay.longestSleepMinutes = minutes;
  }
}

function addEvent(days: DayStats[], origin: Date, event: BabyEvent): void {
  const startMs = new Date(event.startedAt).getTime();
  const day = days[daysBetween(origin, startOfDay(startMs))];
  if (!day) return;

  if (event.type === "sleep") {
    const minutes = minutesBetween(startMs, event.endedAt);
    if (minutes > 0 && minutes <= MAX_SLEEP_MINUTES) {
      addSleep(days, origin, startMs, minutes);
    }
    return;
  }

  day.events += 1;
  if (event.type === "diaper") {
    day.diapers += 1;
  } else if (event.type === "feed") {
    day.feeds += 1;
    const ml = recordedAmountMl(event);
    if (ml > 0) {
      day.feedMl += ml;
      day.feedsWithVolume += 1;
    }
    const minutes = minutesBetween(startMs, event.endedAt);
    if (minutes > 0 && minutes <= MAX_FEED_MINUTES) {
      day.feedMinutes += minutes;
      day.timedFeeds += 1;
    }
  } else if (event.type === "pump") {
    day.pumps += 1;
    const ml = recordedAmountMl(event);
    if (ml > 0) {
      day.pumpMl += ml;
      day.pumpsWithVolume += 1;
    }
  }
}

interface MetricRule {
  divisor?: (day: DayStats) => number;
  logged: (day: DayStats) => boolean;
  total: (day: DayStats) => number;
}

const RULES: Record<MetricKey, MetricRule> = {
  diapersPerDay: {
    logged: (day) => day.diapers > 0,
    total: (day) => day.diapers,
  },
  feedLength: {
    divisor: (day) => day.timedFeeds,
    logged: (day) => day.timedFeeds > 0,
    total: (day) => day.feedMinutes,
  },
  feedVolumePerDay: {
    logged: (day) => day.feedsWithVolume > 0,
    total: (day) => day.feedMl,
  },
  feedsPerDay: {
    logged: (day) => day.feeds > 0,
    total: (day) => day.feeds,
  },
  longestSleep: {
    logged: (day) => day.longestSleepMinutes > 0,
    total: (day) => day.longestSleepMinutes,
  },
  pumpVolumePerDay: {
    logged: (day) => day.pumpsWithVolume > 0,
    total: (day) => day.pumpMl,
  },
  pumpsPerDay: {
    logged: (day) => day.pumps > 0,
    total: (day) => day.pumps,
  },
  sleepPerDay: {
    logged: (day) => day.sleepMinutes > 0,
    total: (day) => day.sleepMinutes,
  },
};

function windowValue(
  days: DayStats[],
  rule: MetricRule
): { loggedDays: number; value: number | null } {
  let loggedDays = 0;
  let total = 0;
  let divisor = 0;
  for (const day of days) {
    if (!rule.logged(day)) continue;
    loggedDays += 1;
    total += rule.total(day);
    divisor += rule.divisor ? rule.divisor(day) : 1;
  }
  const value =
    loggedDays >= MIN_LOGGED_DAYS && divisor > 0 ? total / divisor : null;
  return { loggedDays, value };
}

const emptyTrend = (): MetricTrend => ({
  current: null,
  currentDays: 0,
  hasData: false,
  points: [],
  previous: null,
});

function emptyReport(status: "empty" | "thin"): TypicalDayReport {
  const metrics = {} as Record<MetricKey, MetricTrend>;
  for (const key of METRIC_KEYS) metrics[key] = emptyTrend();
  return {
    currentLoggedDays: 0,
    firstLoggedDay: null,
    granularity: "week",
    metrics,
    status,
    windowDays: WEEK_DAYS,
    windows: [],
  };
}

export function buildTypicalDay(
  events: BabyEvent[],
  options: { birthDate?: string | null; now?: Date } = {}
): TypicalDayReport {
  const now = options.now ?? new Date();
  const today = startOfDay(now);
  const floorMs = historyStart(now, options.birthDate).getTime();

  const usable = events.filter((event) => {
    const startMs = new Date(event.startedAt).getTime();
    return Number.isFinite(startMs) && startMs >= floorMs;
  });
  if (usable.length === 0) return emptyReport("empty");

  const complete = usable.filter(
    (event) => new Date(event.startedAt).getTime() < today.getTime()
  );
  if (complete.length === 0) return emptyReport("thin");

  let firstMs = Number.POSITIVE_INFINITY;
  for (const event of complete) {
    firstMs = Math.min(firstMs, new Date(event.startedAt).getTime());
  }
  const origin = startOfDay(firstMs);
  const dayCount = daysBetween(origin, today);
  const days = Array.from({ length: dayCount }, emptyDay);
  for (const event of complete) addEvent(days, origin, event);

  const granularity: Granularity =
    dayCount >= MONTH_MODE_FROM_DAYS ? "month" : "week";
  const windowDays = granularity === "month" ? MONTH_DAYS : WEEK_DAYS;

  const ranges: { from: number; to: number }[] = [];
  for (
    let to = dayCount;
    to > 0 && ranges.length < MAX_WINDOWS;
    to -= windowDays
  ) {
    ranges.unshift({ from: Math.max(0, to - windowDays), to });
  }

  const perWindow = ranges.map((range) => {
    const slice = days.slice(range.from, range.to);
    const values = {} as Record<
      MetricKey,
      { loggedDays: number; value: number | null }
    >;
    for (const key of METRIC_KEYS) values[key] = windowValue(slice, RULES[key]);
    return { range, slice, values };
  });

  const firstUseful = perWindow.findIndex((window) =>
    METRIC_KEYS.some((key) => window.values[key].value !== null)
  );
  const report = emptyReport("thin");
  report.firstLoggedDay = origin;
  report.granularity = granularity;
  report.windowDays = windowDays;
  const newest = perWindow.at(-1);
  report.currentLoggedDays = newest
    ? newest.slice.filter((day) => day.events > 0).length
    : 0;
  if (firstUseful === -1) return report;

  const kept = perWindow.slice(firstUseful);
  report.status = "ready";
  report.windows = kept.map(({ range }) => ({
    end: addDays(origin, range.to),
    start: addDays(origin, range.from),
  }));
  for (const key of METRIC_KEYS) {
    const points = kept.map((window) => window.values[key].value);
    report.metrics[key] = {
      current: points.at(-1) ?? null,
      currentDays: kept.at(-1)?.values[key].loggedDays ?? 0,
      hasData: points.some((point) => point !== null),
      points,
      previous: points.length > 1 ? (points.at(-2) ?? null) : null,
    };
  }
  return report;
}

export function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const stepped = Math.round(whole / 5) * 5;
  const hours = Math.floor(stepped / 60);
  const rest = stepped % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function compareValues(current: number, earlier: number): Direction {
  const threshold = Math.abs(earlier) * STEADY_SHARE;
  if (current - earlier > threshold) return "up";
  if (earlier - current > threshold) return "down";
  return "steady";
}

export function describeSeries(points: (number | null)[]): {
  direction: Direction;
  first: number;
  last: number;
  periods: number;
} | null {
  const values = points.filter((point): point is number => point !== null);
  const first = values.at(0);
  const last = values.at(-1);
  if (values.length < 2 || first === undefined || last === undefined) {
    return null;
  }
  return {
    direction: compareValues(last, first),
    first,
    last,
    periods: values.length,
  };
}
