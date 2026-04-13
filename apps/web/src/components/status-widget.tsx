"use client";

import { useEffect, useMemo, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";

/* Thresholds in minutes: feed/sleep 2h→3h, diaper 1.5h→2.5h */
const thresholds: Record<string, { overdue: number; soon: number }> = {
  diaper: { overdue: 150, soon: 90 },
  feed: { overdue: 180, soon: 120 },
  sleep: { overdue: 180, soon: 120 },
};

const labels: Record<string, string> = {
  diaper: "Diaper",
  feed: "Feed",
  sleep: "Sleep",
};

const getUrgency = (
  type: string,
  minutesAgo: number
): "ok" | "soon" | "overdue" => {
  const t = thresholds[type];
  if (!t) return "ok";
  if (minutesAgo >= t.overdue) return "overdue";
  if (minutesAgo >= t.soon) return "soon";
  return "ok";
};

const formatElapsed = (minutes: number): string => {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const urgencyColors: Record<string, string> = {
  ok: "text-urgency-ok",
  overdue: "text-urgency-overdue",
  soon: "text-urgency-soon",
};

const urgencyBg: Record<string, string> = {
  ok: "bg-success-50 border-success-200",
  overdue: "bg-danger-50 border-danger-200",
  soon: "bg-warning-50 border-warning-200",
};

export const StatusWidget = () => {
  const { events, loading } = useBabyContext();

  // Tick every minute to update elapsed times
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Derive timer states from the shared event data
  const timers = useMemo(() => {
    const states: {
      type: string;
      label: string;
      minutesAgo: number;
      urgency: "ok" | "soon" | "overdue";
    }[] = [];

    for (const eventType of ["feed", "sleep", "diaper"] as const) {
      // Find the most recent completed event of this type
      const lastEvent = events.find(
        (e) => e.type === eventType && e.endedAt !== null
      );
      // Also check for in-progress events (they count as "just started")
      const activeEvent = events.find(
        (e) => e.type === eventType && e.endedAt === null
      );

      const referenceEvent = activeEvent ?? lastEvent;

      if (referenceEvent) {
        const elapsed =
          (now - new Date(referenceEvent.startedAt).getTime()) / 60_000;
        states.push({
          label: labels[eventType],
          minutesAgo: elapsed,
          type: eventType,
          urgency: activeEvent ? "ok" : getUrgency(eventType, elapsed),
        });
      } else {
        states.push({
          label: labels[eventType],
          minutesAgo: -1,
          type: eventType,
          urgency: "overdue",
        });
      }
    }

    return states;
  }, [events, now]);

  if (loading) return null;
  if (timers.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2">
      {timers.map((timer) => (
        <div
          key={timer.type}
          className={`flex flex-1 flex-col items-center rounded-md border px-2 py-2 ${urgencyBg[timer.urgency]}`}
        >
          <EventIcon type={timer.type} />
          <span
            className={`text-sm font-semibold tabular-nums ${urgencyColors[timer.urgency]}`}
          >
            {timer.minutesAgo < 0 ? "—" : formatElapsed(timer.minutesAgo)}
          </span>
          <span className="text-xs text-neutral-400">{timer.label}</span>
        </div>
      ))}
    </div>
  );
};
