"use client";

import { useCallback, useMemo } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { formatEventNotes, formatEventParts } from "@/lib/format-event";

import { useHistorySheet } from "../_context";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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

const EventRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit: (event: BabyEvent) => void;
}) => {
  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const { label, detail } = formatEventParts(event);
  const notes = formatEventNotes(event);
  const inProgress =
    !event.endedAt && event.type !== "diaper" && event.type !== "note";

  return (
    <button
      className="flex w-full items-center gap-3 border-neutral-100 border-b px-4 py-3 text-left transition-colors active:bg-neutral-50"
      onClick={handleClick}
      type="button"
    >
      <span className="w-14 shrink-0 text-neutral-400 text-xs tabular-nums">
        {formatTime(event.startedAt)}
      </span>
      <EventIcon type={event.type} />
      <div className="min-w-0 flex-1">
        <p className="text-neutral-700 text-sm">
          <span className="font-medium">{label}</span>
          {detail && <span className="text-neutral-500"> · {detail}</span>}
          {inProgress && (
            <span className="ml-1.5 font-normal text-primary-400 text-xs">
              in progress
            </span>
          )}
        </p>
        {notes && (
          <p className="mt-0.5 truncate text-neutral-400 text-xs">{notes}</p>
        )}
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-neutral-300"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

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
            <div className="space-y-0.5">
              {dayEvents.map((event) => (
                <EventRow event={event} key={event.id} onEdit={openEdit} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
