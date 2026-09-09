import type { BabyEvent } from "./baby-context";
import { eventsForDay, totalFedMl } from "./daily-totals";

export interface MonthlyAverage {
  daytimeSleepHoursPerDay: number;
  diaperChangesPerDay: number;
  feedingsPerDay: number;
  feedVolumeMlPerDay: number;
  month: string;
  napsPerDay: number;
  nighttimeSleepHoursPerDay: number;
}

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const startOfMonth = (date: Date): Date => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfMonth = (date: Date): Date => {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + 1);
  return result;
};

const monthLabel = (date: Date): string =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

function sleepMinutesByPeriod(
  events: BabyEvent[],
  rangeStart: Date,
  rangeEnd: Date
): { daytime: number; nighttime: number } {
  let daytime = 0;
  let nighttime = 0;
  for (const event of events) {
    if (event.type !== "sleep" || !event.endedAt) continue;
    let cursor = new Date(event.startedAt);
    const end = new Date(event.endedAt);
    if (end <= rangeStart || cursor >= rangeEnd) continue;
    if (cursor < rangeStart) cursor = new Date(rangeStart);
    const clippedEnd = end < rangeEnd ? end : rangeEnd;

    while (cursor < clippedEnd) {
      const boundary = new Date(cursor);
      const hour = cursor.getHours();
      if (hour < 6) {
        boundary.setHours(6, 0, 0, 0);
      } else if (hour < 19) {
        boundary.setHours(19, 0, 0, 0);
      } else {
        boundary.setDate(boundary.getDate() + 1);
        boundary.setHours(6, 0, 0, 0);
      }
      const segmentEnd = boundary < clippedEnd ? boundary : clippedEnd;
      const minutes = (segmentEnd.getTime() - cursor.getTime()) / 60_000;
      if (hour >= 19 || hour < 6) nighttime += minutes;
      else daytime += minutes;
      cursor = segmentEnd;
    }
  }
  return { daytime, nighttime };
}

export function calculateMonthlyAverages(
  events: BabyEvent[],
  month: Date,
  now = new Date()
): MonthlyAverage {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const isCurrentMonth = startOfMonth(now).getTime() === start.getTime();
  const through = isCurrentMonth ? now : new Date(end.getTime() - 1);
  const days = Math.max(
    1,
    Math.ceil((startOfDay(through).getTime() - start.getTime()) / 86_400_000) +
      1
  );
  const sleep = sleepMinutesByPeriod(events, start, through);
  let feeds = 0;
  let feedVolumeMl = 0;
  let diapers = 0;
  let naps = 0;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const dayEvents = eventsForDay(events, date);
    feeds += dayEvents.filter((event) => event.type === "feed").length;
    feedVolumeMl += totalFedMl(dayEvents);
    diapers += dayEvents.filter((event) => event.type === "diaper").length;
    naps += dayEvents.filter((event) => {
      if (event.type !== "sleep") return false;
      const hour = new Date(event.startedAt).getHours();
      return hour >= 6 && hour < 19;
    }).length;
  }

  return {
    daytimeSleepHoursPerDay: sleep.daytime / days / 60,
    diaperChangesPerDay: diapers / days,
    feedingsPerDay: feeds / days,
    feedVolumeMlPerDay: feedVolumeMl / days,
    month: monthLabel(start),
    napsPerDay: naps / days,
    nighttimeSleepHoursPerDay: sleep.nighttime / days / 60,
  };
}

export function monthStartsThrough(count: number, now = new Date()): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const month = startOfMonth(now);
    month.setMonth(month.getMonth() - index);
    return month;
  });
}
