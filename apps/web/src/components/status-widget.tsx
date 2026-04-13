"use client";

import { useEffect, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { formatVolume, getVolumeUnit } from "@/lib/use-volume-unit";

/* ── Helpers ──────────────────────────────────────────────── */

const formatElapsed = (minutes: number): string => {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
};

const formatDuration = (
  startedAt: string,
  endedAt: string | null
): string | null => {
  if (!endedAt) return null;
  if (startedAt === endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

function getEventSummary(type: string, metadata: string): string {
  try {
    const meta = JSON.parse(metadata);
    switch (type) {
      case "feed": {
        if (meta.amountMl) return formatVolume(meta.amountMl, getVolumeUnit());
        if (meta.method) return meta.method;
        return "Feed";
      }
      case "pump": {
        if (meta.amountMl) return formatVolume(meta.amountMl, getVolumeUnit());
        return "Pump";
      }
      case "sleep": {
        return "Sleep";
      }
      case "diaper": {
        const parts: string[] = [];
        if (meta.wet) parts.push("wet");
        if (meta.soiled) parts.push("soiled");
        return parts.join(" + ") || "Diaper";
      }
      default: {
        return type;
      }
    }
  } catch {
    return type;
  }
}

/* ── CSS variable glow colors per event type ─────────────── */

const glowColors: Record<string, string> = {
  feed: "var(--color-feed-200)",
  pump: "var(--color-pump-200)",
  sleep: "var(--color-sleep-200)",
  diaper: "var(--color-diaper-200)",
};

/* ── Timer state ──────────────────────────────────────────── */

interface TimerState {
  type: string;
  label: string;
  summary: string;
  minutesAgo: number;
  duration: string | null;
  isActive: boolean;
  event: BabyEvent;
}

const labels: Record<string, string> = {
  diaper: "Diaper",
  feed: "Feed",
  sleep: "Sleep",
};

/* ── Component ────────────────────────────────────────────── */

export const StatusWidget = () => {
  const { events, loading } = useBabyContext();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const timers = useMemo(() => {
    const states: TimerState[] = [];

    for (const eventType of ["feed", "sleep", "diaper"] as const) {
      const lastEvent = events.find(
        (e) => e.type === eventType && e.endedAt !== null
      );
      const activeEvent = events.find(
        (e) => e.type === eventType && e.endedAt === null
      );

      const referenceEvent = activeEvent ?? lastEvent;
      if (!referenceEvent) continue;

      const elapsed =
        (now - new Date(referenceEvent.startedAt).getTime()) / 60_000;
      const duration = activeEvent
        ? formatDuration(activeEvent.startedAt, new Date(now).toISOString())
        : formatDuration(referenceEvent.startedAt, referenceEvent.endedAt);

      states.push({
        type: eventType,
        label: labels[eventType],
        summary: getEventSummary(eventType, referenceEvent.metadata),
        minutesAgo: elapsed,
        duration,
        isActive: activeEvent !== undefined,
        event: referenceEvent,
      });
    }

    return states;
  }, [events, now]);

  if (loading) return null;
  if (timers.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2">
      {timers.map((timer) => {
        const style = getEventStyle(timer.type);
        const glow = glowColors[timer.type] ?? "transparent";

        return (
          <div
            key={timer.type}
            className={`relative flex flex-1 flex-col items-center overflow-hidden rounded-xl border px-2 py-3 ${style.bg}`}
          >
            {/* Gradient glow behind text */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${glow}, transparent 70%)`,
              }}
            />

            <div className="relative flex flex-col items-center">
              <EventIcon type={timer.type} />
              <span className="mt-1 text-xs font-medium text-neutral-600">
                {timer.label}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${style.iconColor}`}
              >
                {timer.summary}
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-neutral-400">
                {formatElapsed(timer.minutesAgo)}
                {timer.duration ? ` (${timer.duration})` : ""}
              </span>
              {timer.isActive && (
                <span
                  className={`mt-1 text-[10px] font-medium ${style.iconColor}`}
                >
                  in progress
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
