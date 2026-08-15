"use client";

import { useMemo } from "react";

import { HistoryEventTable } from "@/components/history-event-table";
import { useBabyContext } from "@/lib/baby-context";
import { startOfDay } from "@/lib/daily-totals";
import { eventsOverlappingDay } from "@/lib/event-time";

import { useHistorySheet } from "../_context";

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

export default function HistoryDaysPage() {
  const { events, loading } = useBabyContext();
  const { openAdd, openEdit } = useHistorySheet();

  const nonPumpEvents = useMemo(
    () => events.filter((e) => e.type !== "pump"),
    [events]
  );

  if (loading) return null;

  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    return date;
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <button
        className="mx-4 mb-3 flex min-h-[44px] w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-neutral-200 border-dashed px-4 py-3 font-medium text-neutral-500 text-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
        onClick={openAdd}
        type="button"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            d="M12 4v16m8-8H4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Add past entry
      </button>
      <div className="space-y-5 pb-4">
        {days.map((date) => {
          const dayEvents = eventsOverlappingDay(nonPumpEvents, date);
          if (dayEvents.length === 0 && date.getTime() !== today.getTime()) {
            return null;
          }

          return (
            <div key={date.toISOString()}>
              <p className="mx-4 mb-2 text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
                {formatDayHeading(date, today)}
              </p>
              <HistoryEventTable events={dayEvents} onEdit={openEdit} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
