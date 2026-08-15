"use client";

import { useMemo } from "react";

import { HistoryEventTable } from "@/components/history-event-table";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";

import { useHistorySheet } from "../_context";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

function dayLabel(iso: string): string {
  if (isToday(iso)) return "Today";
  if (isYesterday(iso)) return "Yesterday";
  return formatDate(iso);
}

function groupByDay(events: BabyEvent[]): Map<string, BabyEvent[]> {
  const groups = new Map<string, BabyEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.startedAt).toLocaleDateString();
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return groups;
}

export default function HistoryListPage() {
  const { events, loading } = useBabyContext();
  const { openAdd, openEdit } = useHistorySheet();

  const nonPumpEvents = useMemo(
    () => events.filter((e) => e.type !== "pump"),
    [events]
  );
  const grouped = useMemo(() => groupByDay(nonPumpEvents), [nonPumpEvents]);

  if (loading) return null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4">
      <button
        className="mb-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 border-dashed px-4 py-3 font-medium text-neutral-500 text-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
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

      {nonPumpEvents.length === 0 ? (
        <p className="py-8 text-center text-neutral-400 text-sm">
          No events logged yet
        </p>
      ) : (
        [...grouped.entries()].map(([dateKey, dayEvents]) => (
          <div className="mb-4" key={dateKey}>
            <p className="mb-1 font-medium text-neutral-400 text-xs uppercase tracking-wider">
              {dayLabel(dayEvents[0].startedAt)}
            </p>
            <HistoryEventTable events={dayEvents} onEdit={openEdit} />
          </div>
        ))
      )}
    </div>
  );
}
