import type { ReactNode } from "react";

import { Icon } from "@/components/icons";

const SIZE = "h-4 w-4";

const FeedIcon = () => <Icon className={SIZE} name="feed" />;
const SleepIcon = () => <Icon className={SIZE} name="sleep" />;
const DiaperIcon = () => <Icon className={SIZE} name="diaper" />;
const PumpIcon = () => <Icon className={SIZE} name="pump" />;
const NoteIcon = () => <Icon className={SIZE} name="note" />;

/* ── Public API ───────────────────────────────────────────── */

export type EventType = "feed" | "pump" | "sleep" | "diaper" | "note";

interface EventStyle {
  icon: () => ReactNode;
  /** Tailwind text color for the icon */
  iconColor: string;
  /** Tailwind classes for tinted backgrounds (cards, chips) */
  bg: string;
  /** Tailwind classes for interactive buttons (with hover/active) */
  buttonBg: string;
}

const EVENT_STYLES: Record<EventType, EventStyle> = {
  feed: {
    icon: FeedIcon,
    iconColor: "text-feed-500",
    bg: "bg-feed-50 border-feed-200",
    buttonBg:
      "bg-feed-50 border-feed-200 hover:bg-feed-100 text-feed-600 active:bg-feed-200",
  },
  pump: {
    icon: PumpIcon,
    iconColor: "text-pump-500",
    bg: "bg-pump-50 border-pump-200",
    buttonBg:
      "bg-pump-50 border-pump-200 hover:bg-pump-100 text-pump-600 active:bg-pump-200",
  },
  sleep: {
    icon: SleepIcon,
    iconColor: "text-sleep-500",
    bg: "bg-sleep-50 border-sleep-200",
    buttonBg:
      "bg-sleep-50 border-sleep-200 hover:bg-sleep-100 text-sleep-600 active:bg-sleep-200",
  },
  diaper: {
    icon: DiaperIcon,
    iconColor: "text-diaper-500",
    bg: "bg-diaper-50 border-diaper-200",
    buttonBg:
      "bg-diaper-50 border-diaper-200 hover:bg-diaper-100 text-diaper-600 active:bg-diaper-200",
  },
  note: {
    icon: NoteIcon,
    iconColor: "text-neutral-400",
    bg: "bg-neutral-50 border-neutral-200",
    buttonBg:
      "bg-note-50 border-note-200 hover:bg-note-100 text-neutral-600 active:bg-note-200",
  },
};

export function getEventStyle(type: string): EventStyle {
  return EVENT_STYLES[type as EventType] ?? EVENT_STYLES.note;
}

/** Render the icon for an event type — returns a small SVG wrapped in a colored span */
export function EventIcon({
  type,
  className = "",
}: {
  type: string;
  className?: string;
}) {
  const style = getEventStyle(type);
  const Glyph = style.icon;
  return (
    <span className={`${style.iconColor} ${className}`}>
      <Glyph />
    </span>
  );
}
