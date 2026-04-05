"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";

/* ── Types ─────────────────────────────────────────────────── */

interface ActionOption {
  label: string;
  meta: Record<string, unknown>;
}

interface ActionButton {
  type: string;
  icon: string;
  label: string;
  sublabel: string;
  defaultMeta: Record<string, unknown>;
  options: ActionOption[];
}

/* ── Inference helpers ─────────────────────────────────────── */

function inferFeedMethod(events: { type: string; metadata: string }[]): {
  method: string;
  side?: string;
  label: string;
} {
  const recentFeeds = events.filter((e) => e.type === "feed").slice(0, 5);
  if (recentFeeds.length === 0)
    return { method: "breast", side: "left", label: "Breast \u00B7 L" };

  // Count methods in recent feeds
  let breastCount = 0;
  let bottleCount = 0;
  let lastSide = "left";

  for (const feed of recentFeeds) {
    try {
      const meta = JSON.parse(feed.metadata);
      if (meta.method === "bottle") bottleCount += 1;
      else breastCount += 1;
      if (meta.side) lastSide = meta.side;
    } catch {
      /* ignore */
    }
  }

  // If >50% bottle, default to bottle
  if (bottleCount > breastCount) {
    return { method: "bottle", label: "Bottle" };
  }

  // Alternate breast side
  const nextSide = lastSide === "left" ? "right" : "left";
  const sideAbbrev = nextSide === "left" ? "L" : "R";
  return {
    method: "breast",
    side: nextSide,
    label: `Breast \u00B7 ${sideAbbrev}`,
  };
}

function inferSleepLocation(
  events: { type: string; metadata: string }[]
): string {
  const lastSleep = events.find((e) => e.type === "sleep");
  if (!lastSleep) return "crib";
  try {
    const meta = JSON.parse(lastSleep.metadata);
    return meta.location || "crib";
  } catch {
    return "crib";
  }
}

function inferDiaperType(events: { type: string; metadata: string }[]): {
  wet: boolean;
  soiled: boolean;
  label: string;
} {
  const recentDiapers = events.filter((e) => e.type === "diaper").slice(0, 5);
  let soiledCount = 0;
  for (const d of recentDiapers) {
    try {
      const meta = JSON.parse(d.metadata);
      if (meta.soiled) soiledCount += 1;
    } catch {
      /* ignore */
    }
  }
  // If >50% soiled recently, default to wet+soiled
  if (soiledCount > recentDiapers.length / 2) {
    return { wet: true, soiled: true, label: "Wet + Soiled" };
  }
  return { wet: true, soiled: false, label: "Wet" };
}

const minutesSince = (iso: string): number =>
  (Date.now() - new Date(iso).getTime()) / 60_000;

function formatAgo(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Styles ────────────────────────────────────────────────── */

const typeStyles: Record<
  string,
  { bg: string; iconBg: string; border: string }
> = {
  feed: { bg: "bg-feed-50", iconBg: "bg-feed-100", border: "border-feed-200" },
  diaper: {
    bg: "bg-diaper-50",
    iconBg: "bg-diaper-100",
    border: "border-diaper-200",
  },
  sleep: {
    bg: "bg-sleep-50",
    iconBg: "bg-sleep-100",
    border: "border-sleep-200",
  },
};

/* ── Radial Menu ───────────────────────────────────────────── */

const RadialOption = ({
  option,
  x,
  y,
  delay,
  onSelect,
}: {
  option: ActionOption;
  x: number;
  y: number;
  delay: number;
  onSelect: (option: ActionOption) => void;
}) => {
  const handleClick = useCallback(() => onSelect(option), [onSelect, option]);

  return (
    <button
      className="animate-radial-pop absolute left-1/2 top-full min-h-[40px] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-neutral-200 bg-surface-raised px-3 py-2 text-xs font-medium text-neutral-700 shadow-lg transition-[background-color,transform] active:scale-95"
      onClick={handleClick}
      style={{
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
        animationDelay: `${delay}ms`,
      }}
      type="button"
    >
      {option.label}
    </button>
  );
};

const RadialMenu = ({
  options,
  onSelect,
  onClose,
}: {
  options: ActionOption[];
  onSelect: (option: ActionOption) => void;
  onClose: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [onClose]);

  // Fan options upward in an arc above the button.
  // Arc span in degrees, start angle centered above (270 = up), radius in px.
  const count = options.length;
  const arcSpan = Math.min(count * 40, 160);
  const startAngle = 270 - arcSpan / 2;
  const radius = 80;

  return (
    <div
      className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2"
      ref={menuRef}
    >
      <div className="relative h-24 w-48">
        {options.map((option, i) => {
          const angle =
            startAngle + (count > 1 ? (i * arcSpan) / (count - 1) : 0);
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;

          return (
            <RadialOption
              delay={i * 30}
              key={option.label}
              onSelect={onSelect}
              option={option}
              x={x}
              y={y}
            />
          );
        })}
      </div>
    </div>
  );
};

/* ── Action Button ─────────────────────────────────────────── */

const HOLD_THRESHOLD = 400;

const ActionButton = ({
  button,
  onTap,
  onOptionSelect,
}: {
  button: ActionButton;
  onTap: (type: string, meta: Record<string, unknown>) => void;
  onOptionSelect: (type: string, meta: Record<string, unknown>) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  const styles = typeStyles[button.type];

  const handlePointerDown = useCallback(() => {
    didHoldRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true;
      triggerFeedback("timer");
      setMenuOpen(true);
    }, HOLD_THRESHOLD);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!didHoldRef.current) {
      onTap(button.type, button.defaultMeta);
    }
  }, [onTap, button.type, button.defaultMeta]);

  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleOptionSelect = useCallback(
    (option: ActionOption) => {
      setMenuOpen(false);
      onOptionSelect(button.type, option.meta);
    },
    [onOptionSelect, button.type]
  );

  const handleMenuClose = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="relative flex-1">
      {menuOpen && (
        <RadialMenu
          onClose={handleMenuClose}
          onSelect={handleOptionSelect}
          options={button.options}
        />
      )}
      <button
        className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-[background-color,transform] duration-[var(--duration-fast)] select-none touch-none active:scale-[0.96] ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        type="button"
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${styles?.iconBg ?? "bg-neutral-100"}`}
        >
          {button.icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-800">
            {button.label}
          </p>
          <p className="text-xs text-neutral-400">{button.sublabel}</p>
        </div>
      </button>
    </div>
  );
};

/* ── SuggestionZone ────────────────────────────────────────── */

export const SuggestionZone = () => {
  const { events, logEventDirect, loading } = useBabyContext();

  const buttons = useMemo((): ActionButton[] => {
    const hour = new Date().getHours();

    const lastFeed = events.find((e) => e.type === "feed");
    const lastDiaper = events.find((e) => e.type === "diaper");
    const lastSleep = events.find((e) => e.type === "sleep");

    const feedMinutes = lastFeed ? minutesSince(lastFeed.startedAt) : Infinity;
    const diaperMinutes = lastDiaper
      ? minutesSince(lastDiaper.startedAt)
      : Infinity;
    const sleepMinutes = lastSleep
      ? minutesSince(lastSleep.startedAt)
      : Infinity;

    const feed = inferFeedMethod(events);
    const location = inferSleepLocation(events);
    const diaper = inferDiaperType(events);

    const feedAgo = feedMinutes < Infinity ? formatAgo(feedMinutes) : "";
    const diaperAgo = diaperMinutes < Infinity ? formatAgo(diaperMinutes) : "";
    const sleepAgo = sleepMinutes < Infinity ? formatAgo(sleepMinutes) : "";

    // Fixed order: Feed, Diaper, Sleep — always
    return [
      {
        type: "feed",
        icon: "\u{1F37C}",
        label: feed.label,
        sublabel: feedAgo ? `${feedAgo} ago` : "No feeds yet",
        defaultMeta: {
          method: feed.method,
          ...(feed.side ? { side: feed.side } : {}),
        },
        options: [
          {
            label: "Breast \u00B7 L",
            meta: { method: "breast", side: "left" },
          },
          {
            label: "Breast \u00B7 R",
            meta: { method: "breast", side: "right" },
          },
          { label: "Bottle", meta: { method: "bottle" } },
          { label: "Solid", meta: { method: "solid" } },
        ],
      },
      {
        type: "diaper",
        icon: "\u{1F6BC}",
        label: diaper.label,
        sublabel: diaperAgo ? `${diaperAgo} ago` : "None logged",
        defaultMeta: { wet: diaper.wet, soiled: diaper.soiled },
        options: [
          { label: "Wet", meta: { wet: true, soiled: false } },
          { label: "Soiled", meta: { wet: false, soiled: true } },
          { label: "Wet + Soiled", meta: { wet: true, soiled: true } },
          { label: "Dry", meta: { wet: false, soiled: false } },
        ],
      },
      {
        type: "sleep",
        icon: "\u{1F634}",
        label: hour >= 19 || hour < 7 ? "Bedtime" : "Nap",
        sublabel: sleepAgo ? `${location} \u00B7 ${sleepAgo} ago` : location,
        defaultMeta: { location },
        options: [
          { label: "Crib", meta: { location: "crib" } },
          { label: "Bassinet", meta: { location: "bassinet" } },
          { label: "Held", meta: { location: "held" } },
          { label: "Carrier", meta: { location: "carrier" } },
        ],
      },
    ];
  }, [events]);

  const handleTap = useCallback(
    (type: string, meta: Record<string, unknown>) => {
      triggerFeedback("logged");
      logEventDirect(type, meta);
    },
    [logEventDirect]
  );

  const handleOptionSelect = useCallback(
    (type: string, meta: Record<string, unknown>) => {
      triggerFeedback("logged");
      logEventDirect(type, meta);
    },
    [logEventDirect]
  );

  if (loading) return null;

  return (
    <div className="flex gap-2 px-4 py-3">
      {buttons.map((button) => (
        <ActionButton
          button={button}
          key={button.type}
          onOptionSelect={handleOptionSelect}
          onTap={handleTap}
        />
      ))}
    </div>
  );
};
