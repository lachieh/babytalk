"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { startOfDay } from "@/lib/daily-totals";
import { eventsOverlappingDay } from "@/lib/event-time";
import { coverageCaption, recapDays, ymd } from "@/lib/history-days";

import { DailySummary } from "./daily-summary";
import { EmptyIllustration } from "./empty-illustration";

const RECAP_DAYS = 14;

export const NothingLoggedYet = () => (
  <div className="px-6 py-10 text-center">
    <EmptyIllustration className="mx-auto mb-4" variant="rest" />
    <p className="text-neutral-500 text-sm">
      Nothing logged yet. Tap Feed, Sleep or Diaper on Home when it happens.
    </p>
    <Link
      className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 font-medium text-primary-ink text-sm transition-colors hover:bg-neutral-100"
      href="/dashboard"
    >
      Go to Home
    </Link>
  </div>
);

function sameYmd(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

function formatDayHeading(date: Date, today: Date): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameYmd(date, today)) return "Today";
  if (sameYmd(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export const DaysRecap = ({ events }: { events: BabyEvent[] }) => {
  const today = useMemo(() => startOfDay(new Date()), []);

  const { rows, covered } = useMemo(() => {
    const recap = recapDays({ events, maxDays: RECAP_DAYS, today });
    return {
      covered: recap.covered,
      rows: recap.days.map((date) => ({
        date,
        pumps: eventsOverlappingDay(events, date).filter(
          (e) => e.type === "pump"
        ).length,
      })),
    };
  }, [events, today]);

  if (events.length === 0) {
    return <NothingLoggedYet />;
  }

  return (
    <div className="pb-4">
      <ul className="space-y-2">
        {rows.map(({ date, pumps }) => (
          <li key={ymd(date)}>
            <Link
              className="mx-2 block min-h-[44px] rounded-2xl px-2 py-2 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-500 active:bg-neutral-100"
              href={`/history/list?date=${ymd(date)}`}
            >
              <span className="mx-2 mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-neutral-500 text-xs uppercase tracking-widest">
                  {formatDayHeading(date, today)}
                </span>
                <span className="flex items-center gap-1 text-neutral-500 text-xs">
                  Entries
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
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
                </span>
              </span>
              <DailySummary
                className="px-0"
                compact
                date={date}
                events={events}
              />
              {pumps > 0 && (
                <span className="mx-2 mt-2 block text-neutral-500 text-xs">
                  {pumps === 1 ? "1 pump session" : `${pumps} pump sessions`}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-4 text-center text-neutral-400 text-xs">
        {coverageCaption(rows.length, covered)}
      </p>
    </div>
  );
};
