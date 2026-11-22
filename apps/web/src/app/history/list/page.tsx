"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { NothingLoggedYet } from "@/components/days-recap";
import { HistoryEventTable } from "@/components/history-event-table";
import { useBabyContext } from "@/lib/baby-context";
import { eventsOverlappingDay } from "@/lib/event-time";
import { groupEventsByDay, parseYmd, ymd } from "@/lib/history-days";

import { AddPastEntryButton, useHistorySheet } from "../_context";

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (ymd(date) === ymd(today)) return "Today";
  if (ymd(date) === ymd(yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryListPage() {
  const { events, loading } = useBabyContext();
  const { openEdit } = useHistorySheet();
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get("date") ?? null;

  const { groups, selectedKey } = useMemo(() => {
    const date = parseYmd(dateParam);
    if (!date) return { groups: groupEventsByDay(events), selectedKey: null };
    const key = ymd(date);
    return {
      groups: [{ date, events: eventsOverlappingDay(events, date), key }],
      selectedKey: key,
    };
  }, [events, dateParam]);

  if (loading) return null;

  const isEmpty = groups.every((g) => g.events.length === 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AddPastEntryButton />

      {selectedKey && (
        <div className="mx-4 mb-1 flex justify-start">
          <Link
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 font-medium text-neutral-500 text-sm transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            href="/history/list"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M15 19l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            All days
          </Link>
        </div>
      )}

      {isEmpty && !selectedKey && <NothingLoggedYet />}

      {(selectedKey || !isEmpty) &&
        groups.map((group) => (
          <section className="mb-4" key={group.key}>
            <h2 className="mb-1 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
              {dayLabel(group.date)}
            </h2>
            {group.events.length === 0 ? (
              <p className="px-4 py-6 text-neutral-500 text-sm">
                Nothing logged on this day.
              </p>
            ) : (
              <HistoryEventTable events={group.events} onEdit={openEdit} />
            )}
          </section>
        ))}
    </div>
  );
}
