"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { WeekChart } from "@/components/week-chart";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { startOfDay } from "@/lib/daily-totals";
import { gqlRequest } from "@/lib/gql-request";
import { parseYmd, ymd } from "@/lib/history-days";
import { useCachedQuery } from "@/lib/use-cached-query";

import { useHistorySheet } from "../_context";
import { filterWeekEvents, getWeekStart } from "./week-data";
import type { WeekEventsResponse } from "./week-data";

const EVENTS_OVERLAPPING_RANGE_QUERY = `
  query EventsOverlappingRange($babyId: String!, $rangeStart: String!, $rangeEnd: String!) {
    eventsOverlappingRange(babyId: $babyId, rangeStart: $rangeStart, rangeEnd: $rangeEnd) {
      id type startedAt endedAt metadata
    }
  }
`;

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

function dayCellClass(
  inSelectedWeek: boolean,
  inMonth: boolean,
  isToday: boolean,
  isFuture: boolean
): string {
  let base: string;
  if (isFuture) {
    base = inSelectedWeek
      ? "bg-primary-500/40 text-white"
      : "text-neutral-300 cursor-default";
  } else if (inSelectedWeek) {
    base = "bg-primary-500 text-white";
  } else if (inMonth) {
    base = "text-neutral-700 hover:bg-neutral-100";
  } else {
    base = "text-neutral-400 hover:bg-neutral-50";
  }
  const todayClass =
    isToday && !inSelectedWeek ? "font-bold text-primary-ink" : "";
  return `flex h-11 w-full items-center justify-center text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 ${base} ${todayClass}`;
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
  const isFuture = date.getTime() > todayTime;
  const inSelectedWeek = getWeekStart(date).getTime() === selectedTime;
  return (
    <button
      aria-label={date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
      aria-pressed={inSelectedWeek}
      className={dayCellClass(inSelectedWeek, inMonth, isToday, isFuture)}
      data-selected-week={inSelectedWeek || undefined}
      disabled={isFuture}
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
  const gridStart = useMemo(() => getWeekStart(monthStart), [monthStart]);

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

  const today = useMemo(() => startOfDay(new Date()), []);

  const atCurrentMonth =
    view.getFullYear() * 12 + view.getMonth() >=
    today.getFullYear() * 12 + today.getMonth();

  const handleSelectDay = useCallback(
    (d: Date) => onSelect(getWeekStart(d)),
    [onSelect]
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const initial =
      dialog.querySelector<HTMLElement>("[data-selected-week]") ??
      dialog.querySelector<HTMLElement>("button:not(:disabled)");
    initial?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ];
      const [first] = focusable;
      const last = focusable.at(-1);
      if (!(first && last)) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        aria-label="Close week picker"
        className="absolute inset-0 bg-neutral-900/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl bg-surface-raised p-5 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
            onClick={goPrevMonth}
            type="button"
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
          </button>
          <h2 className="font-medium text-neutral-700 text-sm" id={titleId}>
            <span className="sr-only">Choose a week, </span>
            {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
          </h2>
          <button
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            disabled={atCurrentMonth}
            onClick={goNextMonth}
            type="button"
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
                d="M9 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-7 text-center font-medium text-neutral-400 text-xs uppercase tracking-wider"
        >
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
      </div>
    </div>
  );
};

const NO_EVENTS: BabyEvent[] = [];

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
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
    pickerTriggerRef.current?.focus();
  }, []);
  const handlePick = useCallback(
    (next: Date) => {
      setWeek(next);
      closePicker();
    },
    [setWeek, closePicker]
  );

  const babyId = baby?.id ?? null;
  const loadWeek = useCallback(async () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const data = await gqlRequest<WeekEventsResponse>(
      EVENTS_OVERLAPPING_RANGE_QUERY,
      {
        babyId,
        rangeEnd: weekEnd.toISOString(),
        rangeStart: weekStart.toISOString(),
      }
    );
    return filterWeekEvents(data);
  }, [babyId, weekStart]);
  const week = useCachedQuery(
    babyId && `week:${babyId}:${ymd(weekStart)}`,
    loadWeek
  );
  const events = week.data ?? NO_EVENTS;
  const eventsLoading = week.data === undefined && !week.failed;

  const atCurrentWeek = isCurrentWeek(weekStart);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
      <div className="mx-2 mb-2 flex shrink-0 items-center justify-between gap-2">
        <button
          aria-label="Previous week"
          className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
          onClick={goPrev}
          type="button"
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
        </button>
        <button
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          className="min-h-[44px] flex-1 rounded-lg px-3 text-center font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-100"
          onClick={openPicker}
          ref={pickerTriggerRef}
          type="button"
        >
          <span className="sr-only">Choose week: </span>
          {atCurrentWeek ? "This week" : formatRange(weekStart)}
        </button>
        <button
          aria-label="Next week"
          className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
          disabled={atCurrentWeek}
          onClick={goNext}
          type="button"
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
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <WeekChart
          events={events}
          loading={eventsLoading}
          onTapEvent={openEdit}
          weekStart={weekStart}
        />
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
