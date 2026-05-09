import type { BabyEvent } from "./baby-context";

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function eventsForDay(events: BabyEvent[], date: Date): BabyEvent[] {
  const start = startOfDay(date).getTime();
  const end = endOfDay(date).getTime();
  return events.filter((e) => {
    const t = new Date(e.startedAt).getTime();
    return t >= start && t <= end;
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

export function totalDiapers(events: BabyEvent[]): number {
  return events.filter((e) => e.type === "diaper").length;
}

export function formatSleepDuration(minutes: number): string {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
