"use client";

interface TimelineEvent {
  endedAt?: string | null;
  id: string;
  metadata: string;
  startedAt: string;
  type: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

const typeEmoji: Record<string, string> = {
  diaper: "\u{1F6BC}",
  feed: "\u{1F37C}",
  note: "\u{1F4DD}",
  sleep: "\u{1F634}",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatMeta = (type: string, raw: string) => {
  try {
    const meta = JSON.parse(raw);
    switch (type) {
      case "feed": {
        const parts = [meta.method];
        if (meta.amountMl) parts.push(`${meta.amountMl}ml`);
        if (meta.side) parts.push(meta.side);
        return parts.join(", ");
      }
      case "sleep": {
        return meta.location || "sleep";
      }
      case "diaper": {
        const parts = [];
        if (meta.wet) parts.push("wet");
        if (meta.soiled) parts.push("soiled");
        return parts.join(" + ") || "diaper";
      }
      case "note": {
        return meta.text || "";
      }
      default: {
        return "";
      }
    }
  } catch {
    return "";
  }
};

export const Timeline = ({ events }: TimelineProps) => {
  if (events.length === 0) {
    return (
      <div className="rounded-radius-md bg-neutral-50 px-spacing-lg py-spacing-2xl text-center">
        <p className="text-[var(--font-size-sm)] font-medium text-neutral-500">
          Nothing logged yet today
        </p>
        <p className="mt-spacing-xs text-[var(--font-size-xs)] text-neutral-300">
          Say &quot;baby just ate&quot; or tap a quick action to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-spacing-xs">
      {events.map((event, i) => (
        <div
          className="animate-fade-up flex items-center gap-spacing-md rounded-radius-md bg-surface-raised px-spacing-md py-spacing-sm"
          key={event.id}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="text-base">{typeEmoji[event.type] ?? ""}</span>
          <span className="text-[var(--font-size-xs)] text-neutral-400 tabular-nums">
            {formatTime(event.startedAt)}
          </span>
          <span className="flex-1 text-[var(--font-size-sm)] font-medium capitalize text-neutral-700">
            {event.type}
          </span>
          <span className="text-[var(--font-size-sm)] text-neutral-500">
            {formatMeta(event.type, event.metadata)}
          </span>
        </div>
      ))}
    </div>
  );
};
