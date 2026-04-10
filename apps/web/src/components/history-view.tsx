"use client";

import { useCallback, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";

import { EventEditSheet } from "./event-edit-sheet";

/* ── Helpers ───────────────────────────────────────────────── */

const typeEmoji: Record<string, string> = {
  feed: "🍼",
  pump: "🤱",
  sleep: "😴",
  diaper: "🚼",
  note: "📝",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatDuration = (start: string, end: string | null): string | null => {
  if (!end) return "in progress";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatMeta = (type: string, raw: string): string => {
  try {
    const meta = JSON.parse(raw);
    switch (type) {
      case "feed": {
        const parts = [meta.method];
        if (meta.amountMl) parts.push(`${meta.amountMl}ml`);
        if (meta.side) parts.push(meta.side);
        return parts.join(", ");
      }
      case "pump": {
        const parts = [meta.side];
        if (meta.amountMl) parts.push(`${meta.amountMl}ml`);
        return parts.join(", ");
      }
      case "sleep": {
        return meta.location || "sleep";
      }
      case "diaper": {
        const parts: string[] = [];
        if (meta.wet) parts.push("wet");
        if (meta.soiled) parts.push("soiled");
        return parts.join(" + ") || "diaper";
      }
      case "note": {
        return meta.text || "";
      }
      default: {
        return "";
      }
    }
  } catch {
    return "";
  }
};

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

/* ── Group events by day ───────────────────────────────────── */

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

/* ── Event Row ─────────────────────────────────────────────── */

const EventRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit: (event: BabyEvent) => void;
}) => {
  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const duration = formatDuration(event.startedAt, event.endedAt);
  const meta = formatMeta(event.type, event.metadata);

  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <span className="text-lg">{typeEmoji[event.type] ?? "📋"}</span>
      <span className="w-14 text-xs tabular-nums text-neutral-400">
        {formatTime(event.startedAt)}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium capitalize text-neutral-700">
          {event.type}
        </span>
        {meta && (
          <span className="ml-1.5 text-xs text-neutral-400">{meta}</span>
        )}
      </div>
      {duration && <span className="text-xs text-neutral-400">{duration}</span>}
      <svg
        className="h-4 w-4 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

/* ── History View ──────────────────────────────────────────── */

export const HistoryView = () => {
  const { events, loading } = useBabyContext();
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const grouped = useMemo(() => groupByDay(events), [events]);

  const handleEdit = useCallback((event: BabyEvent) => {
    setEditingEvent(event);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingEvent(null);
    setIsNew(true);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetOpen(false);
    setEditingEvent(null);
    setIsNew(false);
  }, []);

  if (loading) return null;

  return (
    <div className="px-4 py-2">
      {/* Add button */}
      <button
        className="mb-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
        onClick={handleAdd}
        type="button"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add past entry
      </button>

      {/* Day groups */}
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          No events logged yet
        </p>
      ) : (
        [...grouped.entries()].map(([dateKey, dayEvents]) => (
          <div key={dateKey} className="mb-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
              {dayLabel(dayEvents[0].startedAt)}
            </p>
            <div className="space-y-0.5">
              {dayEvents.map((event) => (
                <EventRow event={event} key={event.id} onEdit={handleEdit} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Edit/Add sheet */}
      <EventEditSheet
        event={isNew ? null : editingEvent}
        onClose={handleClose}
        open={sheetOpen}
      />
    </div>
  );
};
