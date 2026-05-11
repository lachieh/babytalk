"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WeekChart, getWeekStart } from "@/components/week-chart";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { gqlRequest } from "@/lib/tambo/graphql";

import { useHistorySheet } from "../_context";

const EVENTS_IN_RANGE_QUERY = `
  query EventsInRange($babyId: String!, $startedAfter: String!, $startedBefore: String!) {
    eventsInRange(babyId: $babyId, startedAfter: $startedAfter, startedBefore: $startedBefore) {
      id type startedAt endedAt metadata
    }
  }
`;

const pad2 = (n: number) => String(n).padStart(2, "0");

function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYmd(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const startFmt: Intl.DateTimeFormatOptions = sameMonth
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric" };
  const endFmt: Intl.DateTimeFormatOptions = sameMonth
    ? { day: "numeric", year: sameYear ? undefined : "numeric" }
    : {
        month: "short",
        day: "numeric",
        year: sameYear ? undefined : "numeric",
      };
  return `${weekStart.toLocaleDateString([], startFmt)} – ${weekEnd.toLocaleDateString([], endFmt)}${sameYear ? `, ${weekStart.getFullYear()}` : ""}`;
}

function isCurrentWeek(weekStart: Date): boolean {
  const now = getWeekStart(new Date());
  return now.getTime() === weekStart.getTime();
}

/* ── Calendar picker ─────────────────────────────────────── */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

function dayCellClass(
  inSelectedWeek: boolean,
  inMonth: boolean,
  isToday: boolean
): string {
  let base: string;
  if (inSelectedWeek) {
    base = "bg-primary-500 text-white";
  } else if (inMonth) {
    base = "text-neutral-700 hover:bg-neutral-100";
  } else {
    base = "text-neutral-300 hover:bg-neutral-50";
  }
  const todayClass =
    isToday && !inSelectedWeek ? "font-bold text-primary-600" : "";
  return `flex h-9 w-full items-center justify-center text-xs tabular-nums transition-colors ${base} ${todayClass}`;
}

const DayCell = ({
  date,
  selectedTime,
  viewMonth,
  todayTime,
  onSelect,
}: {
  date: Date;
  selectedTime: number;
  viewMonth: number;
  todayTime: number;
  onSelect: (d: Date) => void;
}) => {
  const handleClick = useCallback(() => onSelect(date), [date, onSelect]);
  const inMonth = date.getMonth() === viewMonth;
  const isToday = date.getTime() === todayTime;
  const inSelectedWeek = getWeekStart(date).getTime() === selectedTime;
  return (
    <button
      className={dayCellClass(inSelectedWeek, inMonth, isToday)}
      onClick={handleClick}
      type="button"
    >
      {date.getDate()}
    </button>
  );
};

const WeekPicker = ({
  selected,
  onSelect,
  onClose,
}: {
  selected: Date;
  onSelect: (weekStart: Date) => void;
  onClose: () => void;
}) => {
  const [view, setView] = useState(() => new Date(selected));

  const monthStart = useMemo(
    () => new Date(view.getFullYear(), view.getMonth(), 1),
    [view]
  );
  // Calendar grid starts on the Sunday on or before the 1st.
  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [gridStart]
  );

  const goPrevMonth = useCallback(
    () => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1)),
    []
  );
  const goNextMonth = useCallback(
    () => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1)),
    []
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const handleSelectDay = useCallback(
    (d: Date) => onSelect(getWeekStart(d)),
    [onSelect]
  );

  return (
    <button
      aria-label="Close week picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4"
      onClick={onClose}
      type="button"
    >
      <button
        className="w-full max-w-sm rounded-2xl bg-surface-raised p-5 shadow-xl"
        onClick={stopPropagation}
        type="button"
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            aria-label="Previous month"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
            onClick={goPrevMonth}
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
                d="M15 19l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <p className="font-medium text-neutral-700 text-sm">
            {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
          </p>
          <button
            aria-label="Next month"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
            onClick={goNextMonth}
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
                d="M9 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center font-medium text-[10px] text-neutral-400 uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {days.map((d) => (
            <DayCell
              date={d}
              key={d.toISOString()}
              onSelect={handleSelectDay}
              selectedTime={selected.getTime()}
              todayTime={today.getTime()}
              viewMonth={view.getMonth()}
            />
          ))}
        </div>
      </button>
    </button>
  );
};

/* ── Week page ───────────────────────────────────────────── */

export default function HistoryWeekPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { baby } = useBabyContext();
  const { openEdit } = useHistorySheet();

  const weekParam = searchParams?.get("week") ?? null;
  const weekStart = useMemo(() => {
    const parsed = parseYmd(weekParam);
    return getWeekStart(parsed ?? new Date());
  }, [weekParam]);

  // If the URL didn't have a week param, sync it once so links stay shareable.
  useEffect(() => {
    if (!weekParam) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("week", ymd(getWeekStart(new Date())));
      router.replace(`/history/week?${params.toString()}`, { scroll: false });
    }
  }, [weekParam, router, searchParams]);

  const setWeek = useCallback(
    (next: Date) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("week", ymd(getWeekStart(next)));
      router.replace(`/history/week?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const goPrev = useCallback(() => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeek(prev);
  }, [weekStart, setWeek]);

  const goNext = useCallback(() => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeek(next);
  }, [weekStart, setWeek]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const handlePick = useCallback(
    (next: Date) => {
      setWeek(next);
      setPickerOpen(false);
    },
    [setWeek]
  );

  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!baby) return;
    let cancelled = false;
    const startedAfter = weekStart.toISOString();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const startedBefore = weekEnd.toISOString();

    const load = async () => {
      setEventsLoading(true);
      try {
        const data = await gqlRequest<{ eventsInRange: BabyEvent[] }>(
          EVENTS_IN_RANGE_QUERY,
          { babyId: baby.id, startedAfter, startedBefore }
        );
        if (!cancelled) {
          setEvents(data.eventsInRange.filter((e) => e.type !== "pump"));
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [baby, weekStart]);

  const atCurrentWeek = isCurrentWeek(weekStart);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
      <div className="mx-2 mb-2 flex shrink-0 items-center justify-between gap-2">
        <button
          aria-label="Previous week"
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
          onClick={goPrev}
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
              d="M15 19l-7-7 7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="min-h-[40px] flex-1 rounded-lg px-3 text-center font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-100"
          onClick={openPicker}
          type="button"
        >
          {atCurrentWeek ? "This week" : formatRange(weekStart)}
        </button>
        <button
          aria-label="Next week"
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
          disabled={atCurrentWeek}
          onClick={goNext}
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
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {eventsLoading && events.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-breathe rounded-full bg-primary-200" />
          </div>
        ) : (
          <WeekChart
            events={events}
            onTapEvent={openEdit}
            weekStart={weekStart}
          />
        )}
      </div>

      {pickerOpen && (
        <WeekPicker
          onClose={closePicker}
          onSelect={handlePick}
          selected={weekStart}
        />
      )}
    </div>
  );
}
