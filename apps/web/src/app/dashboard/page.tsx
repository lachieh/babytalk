"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DailySummary } from "@/components/daily-summary";
import { EmptyIllustration } from "@/components/empty-illustration";
import { EventEditSheet } from "@/components/event-edit-sheet";
import { HistoryEventTable } from "@/components/history-event-table";
import { SuggestionZone } from "@/components/suggestion-zone";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { lastEventDetails } from "@/lib/daily-totals";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { isDeviceMode } from "@/lib/use-device-mode";
import { useVolumeUnit } from "@/lib/use-volume-unit";

/* ── Summary Card ─────────────────────────────────────────── */

const SummaryCard = () => {
  const { events } = useBabyContext();
  const { unit } = useVolumeUnit();
  const [, setTick] = useState(0);
  const now = Date.now();

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date(now);

  return (
    <DailySummary
      date={today}
      details={lastEventDetails(events, now, unit)}
      events={events}
    />
  );
};

/* ── Main Dashboard ──────────────────────────────────────── */

export default function DashboardPage() {
  useAutoDarkMode();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const closeEditingEvent = useCallback(() => setEditingEvent(null), []);
  const { events, loading } = useBabyContext();
  const now = Date.now();
  const recentEvents = events.filter((event) => {
    const startedAt = new Date(event.startedAt).getTime();
    return (
      event.type !== "pump" &&
      startedAt <= now &&
      startedAt >= now - 24 * 60 * 60 * 1000
    );
  });

  useEffect(() => {
    if (isDeviceMode()) {
      setRedirecting(true);
      router.replace("/station");
    }
  }, [router]);

  if (redirecting) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  }

  let recent: React.ReactNode;
  if (recentEvents.length > 0) {
    recent = (
      <HistoryEventTable events={recentEvents} onEdit={setEditingEvent} />
    );
  } else if (loading) {
    recent = <div aria-hidden="true" className="h-32" />;
  } else {
    recent = (
      <div className="px-6 py-4 text-center">
        <EmptyIllustration className="mx-auto mb-3" variant="rest" />
        <p className="text-neutral-600 text-sm">
          Nothing logged in the last day.
        </p>
        <p className="mx-auto mt-1 max-w-xs text-neutral-500 text-sm">
          Tap Feed, Sleep or Diaper above and it will show up here.
        </p>
        <Link
          className="mt-2 inline-flex min-h-[44px] items-center rounded-xl px-3 font-medium text-primary-ink text-sm underline underline-offset-4 hover:bg-neutral-100"
          href="/history/list"
        >
          Add something from earlier
        </Link>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col">
          <SummaryCard />

          <div aria-hidden="true" className="max-h-56 min-h-6 flex-1" />

          <SuggestionZone />

          <section aria-labelledby="recent-heading" className="pb-4">
            <h2
              className="mt-8 px-4 text-center font-serif text-lg text-neutral-600 italic"
              id="recent-heading"
            >
              Last 24 Hours
            </h2>

            <div className="mt-3">{recent}</div>
          </section>
        </div>
      </div>
      <EventEditSheet
        event={editingEvent}
        onClose={closeEditingEvent}
        open={editingEvent !== null}
      />
    </AppShell>
  );
}
