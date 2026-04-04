"use client";

import { useCallback, useMemo } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";

/* ── Smart defaults: what to log when user taps a card ──── */

interface SuggestionCard {
  key: string;
  type: string;
  icon: string;
  label: string;
  sublabel: string;
  meta: Record<string, unknown>;
}

const inferFeedSide = (
  events: { type: string; metadata: string }[]
): string => {
  const lastFeed = events.find((e) => e.type === "feed");
  if (!lastFeed) return "left";
  try {
    const meta = JSON.parse(lastFeed.metadata);
    if (meta.side === "left") return "right";
    if (meta.side === "right") return "left";
  } catch {
    /* ignore */
  }
  return "left";
};

const inferSleepLocation = (
  events: { type: string; metadata: string }[]
): string => {
  const lastSleep = events.find((e) => e.type === "sleep");
  if (!lastSleep) return "crib";
  try {
    const meta = JSON.parse(lastSleep.metadata);
    return meta.location || "crib";
  } catch {
    return "crib";
  }
};

const minutesSince = (iso: string): number =>
  (Date.now() - new Date(iso).getTime()) / 60_000;

function formatAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const cardStyles: Record<
  string,
  { bg: string; iconBg: string; border: string }
> = {
  feed: {
    bg: "bg-feed-50",
    iconBg: "bg-feed-100",
    border: "border-feed-200",
  },
  sleep: {
    bg: "bg-sleep-50",
    iconBg: "bg-sleep-100",
    border: "border-sleep-200",
  },
  diaper: {
    bg: "bg-diaper-50",
    iconBg: "bg-diaper-100",
    border: "border-diaper-200",
  },
};

const SuggestionButton = ({
  card,
  isPrimary,
  onTap,
}: {
  card: SuggestionCard;
  isPrimary: boolean;
  onTap: (card: SuggestionCard) => void;
}) => {
  const handleClick = useCallback(() => onTap(card), [onTap, card]);
  const styles = cardStyles[card.type];

  if (isPrimary) {
    return (
      <button
        className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.98] ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
        onClick={handleClick}
        type="button"
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${styles?.iconBg ?? "bg-neutral-100"}`}
        >
          {card.icon}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-neutral-800">
            {card.label}
          </p>
          <p className="text-sm text-neutral-400">{card.sublabel}</p>
        </div>
        <svg
          className="h-5 w-5 text-neutral-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <button
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
      onClick={handleClick}
      type="button"
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${styles?.iconBg ?? "bg-neutral-100"}`}
      >
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-700">{card.label}</p>
        <p className="truncate text-xs text-neutral-400">{card.sublabel}</p>
      </div>
    </button>
  );
};

export const SuggestionZone = () => {
  const { events, logEventDirect, loading } = useBabyContext();

  const suggestions = useMemo((): SuggestionCard[] => {
    const cards: SuggestionCard[] = [];
    const hour = new Date().getHours();

    // Determine time since last event of each type
    const lastFeed = events.find((e) => e.type === "feed");
    const lastSleep = events.find((e) => e.type === "sleep");
    const lastDiaper = events.find((e) => e.type === "diaper");

    const feedMinutes = lastFeed ? minutesSince(lastFeed.startedAt) : Infinity;
    const sleepMinutes = lastSleep
      ? minutesSince(lastSleep.startedAt)
      : Infinity;
    const diaperMinutes = lastDiaper
      ? minutesSince(lastDiaper.startedAt)
      : Infinity;

    const side = inferFeedSide(events);
    const location = inferSleepLocation(events);

    // Feed card — always show, prioritize if overdue
    cards.push({
      key: "feed",
      type: "feed",
      icon: "\u{1F37C}",
      label: "Log Feed",
      sublabel:
        feedMinutes < Infinity
          ? `${side} side \u00B7 ${formatAgo(feedMinutes)} ago`
          : `${side} side`,
      meta: { method: "breast", side },
    });

    // Diaper card
    cards.push({
      key: "diaper",
      type: "diaper",
      icon: "\u{1F6BC}",
      label: "Diaper",
      sublabel:
        diaperMinutes < Infinity
          ? `${formatAgo(diaperMinutes)} ago`
          : "No changes logged",
      meta: { wet: true, soiled: false },
    });

    // Sleep card — more prominent in evening/night
    cards.push({
      key: "sleep",
      type: "sleep",
      icon: "\u{1F634}",
      label: hour >= 19 || hour < 7 ? "Bedtime" : "Start Nap",
      sublabel:
        sleepMinutes < Infinity
          ? `${location} \u00B7 ${formatAgo(sleepMinutes)} ago`
          : location,
      meta: { location },
    });

    // Sort: most overdue first (highest minutes since last)
    const urgencyOrder: Record<string, number> = {
      feed: feedMinutes,
      diaper: diaperMinutes,
      sleep: sleepMinutes,
    };

    cards.sort(
      (a, b) => (urgencyOrder[b.type] ?? 0) - (urgencyOrder[a.type] ?? 0)
    );

    return cards;
  }, [events]);

  const handleTap = useCallback(
    (card: SuggestionCard) => {
      triggerFeedback("logged");
      logEventDirect(card.type, card.meta);
    },
    [logEventDirect]
  );

  if (loading) return null;

  // First card is primary (most urgent), rest are secondary
  const [primary, ...secondary] = suggestions;

  return (
    <div className="px-4 py-3">
      {/* Primary action — large, prominent */}
      {primary && (
        <SuggestionButton card={primary} isPrimary onTap={handleTap} />
      )}

      {/* Secondary actions — compact row */}
      {secondary.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {secondary.map((card) => (
            <SuggestionButton
              card={card}
              isPrimary={false}
              key={card.key}
              onTap={handleTap}
            />
          ))}
        </div>
      )}
    </div>
  );
};
