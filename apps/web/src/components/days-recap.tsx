"use client";

import { useMemo } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { eventsForDay, startOfDay } from "@/lib/daily-totals";

import { DailySummary } from "./daily-summary";

const RECAP_DAYS = 14;

function sameYmd(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayHeading(date: Date, today: Date): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameYmd(date, today)) return "Today";
  if (sameYmd(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export const DaysRecap = ({ events }: { events: BabyEvent[] }) => {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: RECAP_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return d;
    });
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);

  const rows = useMemo(
    () =>
      days
        .map((date) => ({ date, dayEvents: eventsForDay(events, date) }))
        .filter(({ date, dayEvents }) =>
          // Always show today, even if empty.
          sameYmd(date, today) ? true : dayEvents.length > 0
        ),
    [days, events, today]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-neutral-400">
        No events logged yet
      </p>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {rows.map(({ date, dayEvents }) => (
        <div key={date.toISOString()}>
          <p className="mx-4 mb-1.5 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            {formatDayHeading(date, today)}
          </p>
          <DailySummary compact events={dayEvents} />
        </div>
      ))}
    </div>
  );
};
