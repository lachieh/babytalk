"use client";

import { useCallback, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { formatVolume, getVolumeUnit } from "@/lib/use-volume-unit";

import { EventEditSheet } from "./event-edit-sheet";
import { DayView, WeekView } from "./timeline-charts";

/* ── Helpers ───────────────────────────────────────────────── */

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const INSTANT_TYPES = new Set(["diaper"]);

const formatDuration = (
  start: string,
  end: string | null,
  type: string
): string | null => {
  if (INSTANT_TYPES.has(type)) return null;
  if (!end) return "in progress";
  if (start === end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins <= 0) return null;
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
        if (meta.amountMl)
          parts.push(formatVolume(meta.amountMl, getVolumeUnit()));
        if (meta.side) parts.push(meta.side);
        return parts.join(", ");
      }
      case "pump": {
        const parts = [meta.side];
        if (meta.amountMl)
          parts.push(formatVolume(meta.amountMl, getVolumeUnit()));
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
  const duration = formatDuration(event.startedAt, event.endedAt, event.type);
  const meta = formatMeta(event.type, event.metadata);

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
        <p className="text-sm font-medium capitalize text-neutral-700">
          {event.type}
        </p>
        {(meta || duration) && (
          <p className="mt-0.5 text-xs text-neutral-400">
            {[meta, duration].filter(Boolean).join(" · ")}
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

/* ── History View ──────────────────────────────────────────── */

type HistoryTab = "list" | "day" | "week";

const TabButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-primary-500 text-white"
        : "text-neutral-400 hover:text-neutral-600"
    }`}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

export const HistoryView = () => {
  const { events, loading } = useBabyContext();
  const [tab, setTab] = useState<HistoryTab>("list");
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

  const handleSetDay = useCallback(() => setTab("day"), []);
  const handleSetWeek = useCallback(() => setTab("week"), []);
  const handleSetList = useCallback(() => setTab("list"), []);

  if (loading) return null;

  return (
    <div className="py-2">
      {/* Sub-tab switcher */}
      <div className="mx-4 mb-3 flex gap-1 rounded-xl bg-neutral-100 p-1">
        <TabButton active={tab === "day"} label="Day" onClick={handleSetDay} />
        <TabButton
          active={tab === "week"}
          label="Week"
          onClick={handleSetWeek}
        />
        <TabButton
          active={tab === "list"}
          label="List"
          onClick={handleSetList}
        />
      </div>

      {/* Day timeline view */}
      {tab === "day" && <DayView events={events} onTapEvent={handleEdit} />}

      {/* Week timeline view */}
      {tab === "week" && <WeekView events={events} onTapEvent={handleEdit} />}

      {/* List view */}
      {tab === "list" && (
        <div className="px-4">
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
                    <EventRow
                      event={event}
                      key={event.id}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
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
