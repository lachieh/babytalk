"use client";

import { useCallback, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";

import { EventEditSheet } from "./event-edit-sheet";

const typeEmoji: Record<string, string> = {
  feed: "🍼",
  pump: "🤱",
  sleep: "😴",
  diaper: "🚼",
  note: "📝",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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

const formatDuration = (start: string, end: string | null): string | null => {
  if (!end) return null;
  // Instant events (startedAt === endedAt) have no duration to display
  if (start === end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const TimelineRow = ({
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
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <span className="text-base">{typeEmoji[event.type] ?? "📋"}</span>
      <span className="w-14 text-xs tabular-nums text-neutral-400">
        {formatTime(event.startedAt)}
      </span>
      <span className="flex-1 text-sm font-medium capitalize text-neutral-700">
        {event.type}
      </span>
      <span className="text-right text-xs text-neutral-400">
        {duration && (
          <span className="mr-1.5 text-neutral-500">{duration}</span>
        )}
        {meta}
      </span>
      <svg
        className="h-3.5 w-3.5 text-neutral-300"
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

export const PersistentTimeline = () => {
  const { events, loading } = useBabyContext();
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleEdit = useCallback((event: BabyEvent) => {
    setEditingEvent(event);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetOpen(false);
    setEditingEvent(null);
  }, []);

  if (loading) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter((e) => new Date(e.startedAt) >= todayStart);

  if (todayEvents.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-center text-sm text-neutral-400">
          Nothing logged yet today
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
        Today
      </p>
      <div className="space-y-0.5">
        {todayEvents.slice(0, 10).map((event) => (
          <TimelineRow event={event} key={event.id} onEdit={handleEdit} />
        ))}
      </div>

      <EventEditSheet
        event={editingEvent}
        onClose={handleClose}
        open={sheetOpen}
      />
    </div>
  );
};
