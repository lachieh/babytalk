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
      <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">
        No events yet today.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
          key={event.id}
        >
          <span className="text-base">{typeEmoji[event.type] ?? ""}</span>
          <span className="text-xs text-gray-400">
            {formatTime(event.startedAt)}
          </span>
          <span className="flex-1 text-sm capitalize">{event.type}</span>
          <span className="text-sm text-gray-600">
            {formatMeta(event.type, event.metadata)}
          </span>
        </div>
      ))}
    </div>
  );
};
