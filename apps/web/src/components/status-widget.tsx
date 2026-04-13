"use client";

import { useEffect, useMemo, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

/* ── Helpers ──────────────────────────────────────────────── */

const formatElapsed = (minutes: number): string => {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
};

/* ── CSS variable glow colors per event type ─────────────── */

const glowColors: Record<string, string> = {
  feed: "var(--color-feed-200)",
  sleep: "var(--color-sleep-200)",
  diaper: "var(--color-diaper-200)",
};

/* ── Card state ──────────────────────────────────────────── */

interface CardState {
  type: string;
  /** Today's total (e.g. "54m", "4oz", "3x") */
  total: string;
  /** Detail from last event (e.g. "Bottle", "Wet") */
  detail: string | null;
  /** Elapsed since last event */
  elapsed: string;
  isActive: boolean;
}

function getLastEventDetail(type: string, metadata: string): string | null {
  try {
    const meta = JSON.parse(metadata);
    switch (type) {
      case "feed": {
        if (meta.method === "breast") return "Breast";
        if (meta.method === "bottle") return "Bottle";
        if (meta.method === "formula") return "Formula";
        if (meta.method === "solid") return "Solid";
        return null;
      }
      case "diaper": {
        const parts: string[] = [];
        if (meta.wet) parts.push("Wet");
        if (meta.soiled) parts.push("Soiled");
        return parts.join(" + ") || null;
      }
      default: {
        return null;
      }
    }
  } catch {
    return null;
  }
}

/* ── Component ────────────────────────────────────────────── */

export const StatusWidget = () => {
  const { events, loading } = useBabyContext();
  const { unit } = useVolumeUnit();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const cards = useMemo(() => {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEvents = events.filter(
      (e) => new Date(e.startedAt) >= todayStart
    );

    const states: CardState[] = [];

    for (const eventType of ["feed", "sleep", "diaper"] as const) {
      // ── Today's total ──
      let total: string;
      if (eventType === "sleep") {
        let mins = 0;
        for (const e of todayEvents) {
          if (e.type !== "sleep") continue;
          const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
          mins += (end - new Date(e.startedAt).getTime()) / 60_000;
        }
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        total = m > 0 ? `${h}h ${m}m` : `${h}h`;
      } else if (eventType === "feed") {
        let totalMl = 0;
        for (const e of todayEvents) {
          if (e.type !== "feed") continue;
          try {
            const meta = JSON.parse(e.metadata);
            totalMl += meta.amountMl || 0;
          } catch {
            /* ignore */
          }
        }
        total =
          totalMl > 0
            ? formatVolume(totalMl, unit)
            : `${todayEvents.filter((e) => e.type === "feed").length}x`;
      } else {
        const count = todayEvents.filter((e) => e.type === "diaper").length;
        total = `${count}x`;
      }

      // ── Last event timing + detail ──
      const lastEvent = events.find(
        (e) => e.type === eventType && e.endedAt !== null
      );
      const activeEvent = events.find(
        (e) => e.type === eventType && e.endedAt === null
      );
      const referenceEvent = activeEvent ?? lastEvent;

      let elapsed = "—";
      let detail: string | null = null;
      let isActive = false;

      if (referenceEvent) {
        const minutesAgo =
          (now - new Date(referenceEvent.startedAt).getTime()) / 60_000;
        elapsed = formatElapsed(minutesAgo);
        detail = getLastEventDetail(eventType, referenceEvent.metadata);
        isActive = activeEvent !== undefined;
      }

      states.push({
        type: eventType,
        total,
        detail,
        elapsed,
        isActive,
      });
    }

    return states;
  }, [events, now, unit]);

  if (loading) return null;
  if (cards.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2">
      {cards.map((card) => {
        const style = getEventStyle(card.type);
        const glow = glowColors[card.type] ?? "transparent";

        return (
          <div
            key={card.type}
            className={`relative flex flex-1 flex-col items-center overflow-hidden rounded-xl border px-2 py-3 ${style.bg}`}
          >
            {/* Gradient glow */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${glow}, transparent 70%)`,
              }}
            />

            <div className="relative flex flex-col items-center">
              <EventIcon type={card.type} />
              <span
                className={`mt-1.5 text-base font-semibold tabular-nums ${style.iconColor}`}
              >
                {card.total}
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-neutral-400">
                {card.elapsed}
              </span>
              {card.isActive && (
                <span
                  className={`mt-0.5 text-[10px] font-medium ${style.iconColor}`}
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
