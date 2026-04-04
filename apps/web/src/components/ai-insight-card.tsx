"use client";

import { useMemo } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";

interface Insight {
  icon: string;
  message: string;
  tone: "calm" | "gentle-nudge" | "encouragement";
}

const toneStyles: Record<string, string> = {
  calm: "bg-neutral-50 border-neutral-200 text-neutral-600",
  "gentle-nudge": "bg-warning-50 border-warning-200 text-neutral-700",
  encouragement: "bg-success-50 border-success-200 text-neutral-700",
};

const minutesSince = (iso: string): number =>
  (Date.now() - new Date(iso).getTime()) / 60_000;

function lateNightInsight(
  todayEvents: BabyEvent[],
  hour: number
): Insight | null {
  if (hour >= 0 && hour < 6 && todayEvents.length > 0) {
    return {
      icon: "\u{1F31F}",
      message: "You're doing amazing. Hang in there.",
      tone: "encouragement",
    };
  }
  return null;
}

function overdueFeedInsight(feedMinutes: number): Insight | null {
  if (feedMinutes > 180 && feedMinutes < Infinity) {
    const h = Math.floor(feedMinutes / 60);
    const m = Math.floor(feedMinutes % 60);
    return {
      icon: "\u{1F37C}",
      message: `Last feed was ${h}h ${m}m ago \u2014 might be getting hungry`,
      tone: "gentle-nudge",
    };
  }
  return null;
}

function feedingDayInsight(feedsToday: number): Insight | null {
  if (feedsToday >= 6) {
    return {
      icon: "\u2728",
      message: `${feedsToday} feeds today \u2014 great rhythm`,
      tone: "encouragement",
    };
  }
  return null;
}

function napWindowInsight(sleepMinutes: number, hour: number): Insight | null {
  if (
    sleepMinutes > 120 &&
    sleepMinutes < Infinity &&
    hour >= 12 &&
    hour <= 16
  ) {
    return {
      icon: "\u{1F634}",
      message: "Afternoon nap window \u2014 she usually sleeps around now",
      tone: "calm",
    };
  }
  return null;
}

function dailySummaryInsight(
  feedsToday: number,
  diapersToday: number,
  todayEvents: BabyEvent[],
  hour: number
): Insight | null {
  if (todayEvents.length === 0 || hour < 8) return null;
  const parts: string[] = [];
  if (feedsToday > 0)
    parts.push(`${feedsToday} feed${feedsToday > 1 ? "s" : ""}`);
  if (diapersToday > 0)
    parts.push(`${diapersToday} diaper${diapersToday > 1 ? "s" : ""}`);
  if (parts.length > 0) {
    return {
      icon: "\u{1F4CB}",
      message: `Today so far: ${parts.join(", ")}`,
      tone: "calm",
    };
  }
  return null;
}

export const AIInsightCard = () => {
  const { events, baby, loading } = useBabyContext();

  const insight = useMemo((): Insight | null => {
    if (!baby || events.length === 0) return null;

    const hour = new Date().getHours();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEvents = events.filter(
      (e) => new Date(e.startedAt) >= todayStart
    );
    const feedsToday = todayEvents.filter((e) => e.type === "feed").length;
    const diapersToday = todayEvents.filter((e) => e.type === "diaper").length;

    const lastFeed = events.find((e) => e.type === "feed");
    const lastSleep = events.find((e) => e.type === "sleep");

    const feedMinutes = lastFeed ? minutesSince(lastFeed.startedAt) : Infinity;
    const sleepMinutes = lastSleep
      ? minutesSince(lastSleep.startedAt)
      : Infinity;

    return (
      lateNightInsight(todayEvents, hour) ??
      overdueFeedInsight(feedMinutes) ??
      feedingDayInsight(feedsToday) ??
      napWindowInsight(sleepMinutes, hour) ??
      dailySummaryInsight(feedsToday, diapersToday, todayEvents, hour)
    );
  }, [events, baby]);

  if (loading || !insight) return null;

  return (
    <div className="px-4">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${toneStyles[insight.tone]}`}
      >
        <span className="text-base">{insight.icon}</span>
        <p className="flex-1 text-sm leading-snug">{insight.message}</p>
      </div>
    </div>
  );
};
