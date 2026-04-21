"use client";

import { useCallback, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { formatEventNotes, formatEventParts } from "@/lib/format-event";

import { EventEditSheet } from "./event-edit-sheet";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const TimelineRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit: (event: BabyEvent) => void;
}) => {
  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const { label, detail } = formatEventParts(event);
  const notes = formatEventNotes(event);

  return (
    <button
      className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors active:bg-neutral-50"
      onClick={handleClick}
      type="button"
    >
      <span className="w-14 shrink-0 text-xs tabular-nums text-neutral-400">
        {formatTime(event.startedAt)}
      </span>
      <EventIcon type={event.type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-700">
          <span className="font-medium">{label}</span>
          {detail && <span className="text-neutral-500"> · {detail}</span>}
        </p>
        {notes && (
          <p className="mt-0.5 truncate text-xs text-neutral-400">{notes}</p>
        )}
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-neutral-300"
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
  const todayEvents = events.filter(
    (e) => new Date(e.startedAt) >= todayStart && e.type !== "pump"
  );

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
    <div>
      <div>
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
