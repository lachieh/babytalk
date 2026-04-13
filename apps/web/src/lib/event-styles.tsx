import type { ReactNode } from "react";

/* ── SVG Line Icons ───────────────────────────────────────── */

const iconProps = {
  className: "h-4 w-4",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Bottle icon — Feed */
const FeedIcon = () => (
  <svg {...iconProps}>
    <path d="M6 8h8v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8z" />
    <path d="M6 8l1-4h6l1 4" />
    <path d="M6 12h8" />
  </svg>
);

/** Moon icon — Sleep */
const SleepIcon = () => (
  <svg {...iconProps}>
    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
  </svg>
);

/** Droplet icon — Diaper */
const DiaperIcon = () => (
  <svg {...iconProps}>
    <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z" />
  </svg>
);

/** Heart-pulse icon — Pump */
const PumpIcon = () => (
  <svg {...iconProps}>
    <path d="M20.42 4.58a5.4 5.4 0 00-7.65 0L12 5.36l-.77-.78a5.4 5.4 0 00-7.65 7.65l1.06 1.06L12 20.64l7.36-7.36 1.06-1.06a5.4 5.4 0 000-7.64z" />
  </svg>
);

/** Pencil/note icon — Note */
const NoteIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

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

export const EVENT_STYLES: Record<EventType, EventStyle> = {
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
  const Icon = style.icon;
  return (
    <span className={`${style.iconColor} ${className}`}>
      <Icon />
    </span>
  );
}
