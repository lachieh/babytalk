"use client";

import { useBabyContext } from "@/lib/baby-context";

const typeEmoji: Record<string, string> = {
  feed: "\u{1F37C}",
  sleep: "\u{1F634}",
  diaper: "\u{1F6BC}",
  note: "\u{1F4DD}",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatMeta = (type: string, raw: string): string => {
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

const formatDuration = (start: string, end: string | null): string | null => {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const PersistentTimeline = () => {
  const { events, loading } = useBabyContext();

  if (loading) return null;

  // Only show today's events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter((e) => new Date(e.startedAt) >= todayStart);

  if (todayEvents.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-center text-sm text-neutral-400">
          Nothing logged yet today
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
        Today
      </p>
      <div className="space-y-1">
        {todayEvents.slice(0, 10).map((event) => {
          const duration = formatDuration(event.startedAt, event.endedAt);
          const meta = formatMeta(event.type, event.metadata);

          return (
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-50"
              key={event.id}
            >
              <span className="text-base">
                {typeEmoji[event.type] ?? "\u{1F4CB}"}
              </span>
              <span className="w-14 text-xs tabular-nums text-neutral-400">
                {formatTime(event.startedAt)}
              </span>
              <span className="flex-1 text-sm font-medium capitalize text-neutral-700">
                {event.type}
              </span>
              <span className="text-right text-xs text-neutral-400">
                {duration && (
                  <span className="mr-1.5 text-neutral-500">{duration}</span>
                )}
                {meta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
