"use client";

import { useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";

interface EventSummary {
  type: string;
  startedAt: string;
  endedAt: string | null;
}

interface TimerState {
  type: string;
  label: string;
  icon: string;
  minutesAgo: number;
  urgency: "ok" | "soon" | "overdue";
}

const GET_LAST_EVENTS = `
  query LastEvents($babyId: String!) {
    feed: lastEvent(babyId: $babyId, type: "feed") { type startedAt endedAt }
    sleep: lastEvent(babyId: $babyId, type: "sleep") { type startedAt endedAt }
    diaper: lastEvent(babyId: $babyId, type: "diaper") { type startedAt endedAt }
  }
`;

const GET_MY_BABIES = `
  query { myBabies { id } }
`;

/* Thresholds in minutes: feed/sleep 2h→3h, diaper 1.5h→2.5h */
const thresholds: Record<string, { overdue: number; soon: number }> = {
  diaper: { overdue: 150, soon: 90 },
  feed: { overdue: 180, soon: 120 },
  sleep: { overdue: 180, soon: 120 },
};

const icons: Record<string, string> = {
  diaper: "\u{1F6BC}",
  feed: "\u{1F37C}",
  sleep: "\u{1F634}",
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
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const babiesData = await gqlRequest<{
          myBabies: { id: string }[];
        }>(GET_MY_BABIES);

        if (babiesData.myBabies.length === 0) return;
        const babyId = babiesData.myBabies[0].id;

        const data = await gqlRequest<{
          feed: EventSummary | null;
          sleep: EventSummary | null;
          diaper: EventSummary | null;
        }>(GET_LAST_EVENTS, { babyId });

        if (!mounted) return;

        const now = Date.now();
        const states: TimerState[] = [];

        for (const eventType of ["feed", "sleep", "diaper"] as const) {
          const event = data[eventType];
          if (event) {
            const elapsed =
              (now - new Date(event.startedAt).getTime()) / 60_000;
            states.push({
              icon: icons[eventType],
              label: labels[eventType],
              minutesAgo: elapsed,
              type: eventType,
              urgency: getUrgency(eventType, elapsed),
            });
          } else {
            // No event recorded — show as overdue to encourage logging
            states.push({
              icon: icons[eventType],
              label: labels[eventType],
              minutesAgo: -1,
              type: eventType,
              urgency: "overdue",
            });
          }
        }

        setTimers(states);
      } catch {
        // Silently fail — widget is non-critical
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStatus();
    // Refresh every minute
    const interval = setInterval(fetchStatus, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Re-render elapsed times every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;
  if (timers.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2">
      {timers.map((timer) => (
        <div
          key={timer.type}
          className={`flex flex-1 flex-col items-center rounded-md border px-2 py-2 ${urgencyBg[timer.urgency]}`}
        >
          <span className="text-base">{timer.icon}</span>
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
