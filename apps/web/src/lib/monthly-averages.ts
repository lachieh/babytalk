import type { BabyEvent } from "./baby-context";
import {
  eventsForDay,
  totalFedMl,
  totalSleepMinutesForDay,
} from "./daily-totals";

export interface MonthlyAverage {
  diaperChangesPerDay: number;
  feedingsPerDay: number;
  feedVolumeMlPerDay: number;
  month: string;
  sleepHoursPerDay: number;
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

  let feeds = 0;
  let feedVolumeMl = 0;
  let diapers = 0;
  let sleepMinutes = 0;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const dayEvents = eventsForDay(events, date);
    feeds += dayEvents.filter((event) => event.type === "feed").length;
    feedVolumeMl += totalFedMl(dayEvents);
    diapers += dayEvents.filter((event) => event.type === "diaper").length;
    sleepMinutes += totalSleepMinutesForDay(events, date, through.getTime());
  }

  return {
    diaperChangesPerDay: diapers / days,
    feedingsPerDay: feeds / days,
    feedVolumeMlPerDay: feedVolumeMl / days,
    month: monthLabel(start),
    sleepHoursPerDay: sleepMinutes / days / 60,
  };
}

export function monthStartsThrough(count: number, now = new Date()): Date[] {
  return Array.from({ length: count }, (_, index) => {
    const month = startOfMonth(now);
    month.setMonth(month.getMonth() - index);
    return month;
  });
}
