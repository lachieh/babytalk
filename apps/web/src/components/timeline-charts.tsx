"use client";

import { useCallback, useMemo } from "react";

import type { BabyEvent } from "@/lib/baby-context";

/* ── Constants ─────────────────────────────────────────────── */

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const typeColors: Record<string, { bg: string; border: string }> = {
  feed: { bg: "bg-feed-200", border: "border-feed-500" },
  pump: { bg: "bg-feed-100", border: "border-feed-500" },
  sleep: { bg: "bg-sleep-200", border: "border-sleep-500" },
  diaper: { bg: "bg-diaper-200", border: "border-diaper-500" },
  note: { bg: "bg-neutral-200", border: "border-neutral-400" },
};

/* ── Helpers ───────────────────────────────────────────────── */

function formatHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function isInstantEvent(event: BabyEvent): boolean {
  if (!event.endedAt) return false;
  return event.startedAt === event.endedAt;
}

function eventPosition(event: BabyEvent): { top: number; height: number } {
  const start = new Date(event.startedAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();

  if (isInstantEvent(event)) {
    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: 6,
    };
  }

  const end = event.endedAt ? new Date(event.endedAt) : new Date();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const durationMinutes = Math.max(endMinutes - startMinutes, 15);

  return {
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: Math.max((durationMinutes / 60) * HOUR_HEIGHT, 8),
  };
}

function eventsForDate(events: BabyEvent[], date: Date): BabyEvent[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((e) => {
    const d = new Date(e.startedAt);
    return d >= dayStart && d <= dayEnd;
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: "short" }).slice(0, 2);
}

function formatDayNum(date: Date): string {
  return String(date.getDate());
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function getWeekDates(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function formatMeta(type: string, raw: string): string {
  try {
    const meta = JSON.parse(raw);
    switch (type) {
      case "feed": {
        if (meta.side) return meta.side[0].toUpperCase();
        if (meta.amountMl) return `${meta.amountMl}ml`;
        return meta.method?.[0]?.toUpperCase() ?? "";
      }
      case "pump": {
        return meta.amountMl ? `${meta.amountMl}ml` : "";
      }
      case "diaper": {
        if (meta.wet && meta.soiled) return "W+S";
        if (meta.soiled) return "S";
        return "W";
      }
      case "sleep": {
        return "";
      }
      default: {
        return "";
      }
    }
  } catch {
    return "";
  }
}

/* ── Hour Grid (shared) ────────────────────────────────────── */

const HourLabels = () => (
  <div className="relative w-8 shrink-0">
    {HOURS.map((h) => (
      <div
        className="absolute right-1 text-xs text-neutral-400"
        key={h}
        style={{ top: h * HOUR_HEIGHT - 6 }}
      >
        {formatHour(h)}
      </div>
    ))}
  </div>
);

const HourLines = () => (
  <>
    {HOURS.map((h) => (
      <div
        className="absolute left-0 right-0 border-t border-neutral-100"
        key={h}
        style={{ top: h * HOUR_HEIGHT }}
      />
    ))}
  </>
);

/* ── Event Block ───────────────────────────────────────────── */

const EventBlock = ({
  event,
  onTap,
}: {
  event: BabyEvent;
  onTap?: (event: BabyEvent) => void;
}) => {
  const pos = eventPosition(event);
  const colors = typeColors[event.type] ?? typeColors.note;
  const label = formatMeta(event.type, event.metadata);
  const instant = isInstantEvent(event);
  const handleClick = useCallback(() => onTap?.(event), [onTap, event]);

  return (
    <button
      className={`absolute left-0.5 right-0.5 overflow-hidden text-left text-[10px] leading-tight ${
        instant
          ? `rounded-full ${colors.bg} border ${colors.border}`
          : `rounded-sm border-l-2 px-1 ${colors.bg} ${colors.border}`
      }`}
      onClick={handleClick}
      style={{ top: pos.top, height: pos.height }}
      type="button"
    >
      {!instant && pos.height > 16 && (
        <span className="font-medium text-neutral-700">{label}</span>
      )}
    </button>
  );
};

/* ── Day View ──────────────────────────────────────────────── */

/* ── Current Time Line ─────────────────────────────────────── */

const NowLine = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-10 flex items-center"
      style={{ top }}
    >
      <div className="h-2 w-2 rounded-full bg-primary-500" />
      <div className="h-px flex-1 bg-primary-500" />
    </div>
  );
};

/* ── Day View ──────────────────────────────────────────────── */

export const DayView = ({
  events,
  onTapEvent,
}: {
  events: BabyEvent[];
  onTapEvent?: (event: BabyEvent) => void;
}) => {
  const today = useMemo(() => new Date(), []);
  const dayEvents = useMemo(
    () => eventsForDate(events, today),
    [events, today]
  );
  const gridHeight = 24 * HOUR_HEIGHT;

  return (
    <div className="flex px-2">
      <HourLabels />
      <div
        className="relative flex-1 overflow-hidden"
        style={{ height: gridHeight }}
      >
        <HourLines />
        {dayEvents.map((event) => (
          <EventBlock event={event} key={event.id} onTap={onTapEvent} />
        ))}
        {/* Current time indicator */}
        <NowLine />
      </div>
    </div>
  );
};

/* ── Week View ─────────────────────────────────────────────── */

export const WeekView = ({
  events,
  onTapEvent,
}: {
  events: BabyEvent[];
  onTapEvent?: (event: BabyEvent) => void;
}) => {
  const weekDates = useMemo(() => getWeekDates(new Date()), []);
  const gridHeight = 24 * HOUR_HEIGHT;

  const columns = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        events: eventsForDate(events, date),
        isToday: isToday(date),
      })),
    [weekDates, events]
  );

  return (
    <div>
      {/* Day headers */}
      <div className="flex border-b border-neutral-100 pl-10">
        {columns.map((col) => (
          <div
            className={`flex-1 py-2 text-center ${col.isToday ? "text-primary-500" : "text-neutral-400"}`}
            key={col.date.toISOString()}
          >
            <div className="text-[10px] font-medium uppercase">
              {formatShortDate(col.date)}
            </div>
            <div
              className={`text-sm font-semibold ${col.isToday ? "text-primary-600" : "text-neutral-600"}`}
            >
              {formatDayNum(col.date)}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div className="flex overflow-y-auto px-2" style={{ maxHeight: "60vh" }}>
        <HourLabels />
        <div className="flex flex-1">
          {columns.map((col) => (
            <div
              className="relative flex-1 border-l border-neutral-50"
              key={col.date.toISOString()}
              style={{ height: gridHeight }}
            >
              {col.events.map((event) => (
                <EventBlock event={event} key={event.id} onTap={onTapEvent} />
              ))}
            </div>
          ))}
          {/* Hour lines span the full width */}
          <div
            className="pointer-events-none absolute left-8 right-0"
            style={{ height: gridHeight }}
          >
            <HourLines />
          </div>
        </div>
      </div>
    </div>
  );
};
