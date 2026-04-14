"use client";

import { useCallback, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { formatVolume, getVolumeUnit } from "@/lib/use-volume-unit";

import { EventEditSheet } from "./event-edit-sheet";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDuration = (start: string, end: string | null): string | null => {
  if (!end) return "in progress";
  if (start === end) return null;
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000
  );
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatPumpMeta = (raw: string): string => {
  try {
    const meta = JSON.parse(raw);
    const parts: string[] = [];
    if (meta.side) parts.push(meta.side);
    if (meta.amountMl) parts.push(formatVolume(meta.amountMl, getVolumeUnit()));
    return parts.join(" · ");
  } catch {
    return "";
  }
};

const PumpRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit: (event: BabyEvent) => void;
}) => {
  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const duration = formatDuration(event.startedAt, event.endedAt);
  const meta = formatPumpMeta(event.metadata);

  return (
    <button
      className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-left transition-colors active:bg-neutral-50"
      onClick={handleClick}
      type="button"
    >
      <span className="w-12 shrink-0 text-xs tabular-nums text-neutral-400">
        {formatTime(event.startedAt)}
      </span>
      <EventIcon type="pump" />
      <div className="min-w-0 flex-1">
        {(duration || meta) && (
          <p className="text-xs text-neutral-500">
            {[duration, meta].filter(Boolean).join(" · ")}
          </p>
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

export const PumpLog = () => {
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
  const pumpEvents = events.filter(
    (e) => e.type === "pump" && new Date(e.startedAt) >= todayStart
  );

  if (pumpEvents.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="px-4 text-xs font-medium uppercase tracking-wider text-neutral-400">
        Pump sessions today
      </p>
      <div className="mt-1">
        {pumpEvents.map((event) => (
          <PumpRow event={event} key={event.id} onEdit={handleEdit} />
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
