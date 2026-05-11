"use client";

import { AIInsightCard } from "@/components/ai-insight-card";
import { AppShell } from "@/components/app-shell";
import { DailySummary } from "@/components/daily-summary";
import { PersistentTimeline } from "@/components/persistent-timeline";
import { SuggestionZone } from "@/components/suggestion-zone";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { eventsForDay } from "@/lib/daily-totals";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

/* ── Summary Card ─────────────────────────────────────────── */

const formatAgo = (minutes: number): string => {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
};

function lastSleepDetail(
  event: BabyEvent,
  now: number
): { detail: string | null; ago: string } {
  let detail: string | null = null;
  if (event.endedAt) {
    const dur = Math.round(
      (new Date(event.endedAt).getTime() -
        new Date(event.startedAt).getTime()) /
        60_000
    );
    if (dur > 0) {
      detail = dur < 60 ? `${dur}m` : `${Math.floor(dur / 60)}h ${dur % 60}m`;
    }
  }
  return {
    detail,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

function lastFeedDetail(
  event: BabyEvent,
  now: number,
  unit: "ml" | "oz"
): { detail: string | null; ago: string } {
  const parts: string[] = [];
  try {
    const meta = JSON.parse(event.metadata);
    if (meta.amountMl) parts.push(formatVolume(meta.amountMl, unit));
    if (meta.method) {
      const m = meta.method as string;
      parts.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
  } catch {
    /* ignore */
  }
  return {
    detail: parts.length > 0 ? parts.join(" · ") : null,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

function lastDiaperDetail(
  event: BabyEvent,
  now: number
): { detail: string | null; ago: string } {
  const parts: string[] = [];
  try {
    const meta = JSON.parse(event.metadata);
    if (meta.wet) parts.push("Wet");
    if (meta.soiled) parts.push("Soiled");
  } catch {
    /* ignore */
  }
  return {
    detail: parts.length > 0 ? parts.join(" + ") : null,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

const SummaryCard = () => {
  const { events } = useBabyContext();
  const { unit } = useVolumeUnit();

  const now = Date.now();
  const todayEvents = eventsForDay(events, new Date(now));

  const lastSleep = events.find((e) => e.type === "sleep");
  const lastFeed = events.find((e) => e.type === "feed");
  const lastDiaper = events.find((e) => e.type === "diaper");

  return (
    <DailySummary
      details={{
        feed: lastFeed ? lastFeedDetail(lastFeed, now, unit) : null,
        sleep: lastSleep ? lastSleepDetail(lastSleep, now) : null,
        diaper: lastDiaper ? lastDiaperDetail(lastDiaper, now) : null,
      }}
      events={todayEvents}
    />
  );
};

/* ── Main Dashboard ──────────────────────────────────────── */

export default function DashboardPage() {
  useAutoDarkMode();

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <SummaryCard />

        <div className="mt-4">
          <AIInsightCard />
        </div>

        <div className="mt-8 px-4">
          <h2 className="text-center font-serif text-lg text-neutral-600 italic">
            Log Activity
          </h2>
        </div>

        <div className="mt-4">
          <SuggestionZone />
        </div>

        <div className="mt-6 px-4">
          <h2 className="text-center font-serif text-lg text-neutral-600 italic">
            Recent Logs
          </h2>
        </div>

        <div className="mt-3">
          <PersistentTimeline />
        </div>
      </div>
    </AppShell>
  );
}
