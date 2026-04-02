"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback } from "react";

interface EventConfirmationProps {
  endedAt?: string | null;
  eventId: string;
  metadata: string;
  startedAt: string;
  type: string;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatMetadata = (type: string, raw: string) => {
  try {
    const meta = JSON.parse(raw);
    switch (type) {
      case "feed": {
        const parts = [meta.method];
        if (meta.amountMl) parts.push(`${meta.amountMl}ml`);
        if (meta.side) parts.push(meta.side);
        if (meta.foodDesc) parts.push(meta.foodDesc);
        return parts.join(", ");
      }
      case "sleep": {
        const parts = [];
        if (meta.location) parts.push(meta.location);
        if (meta.quality) parts.push(meta.quality);
        return parts.join(", ") || "sleep";
      }
      case "diaper": {
        const parts = [];
        if (meta.wet) parts.push("wet");
        if (meta.soiled) parts.push("soiled");
        if (meta.color) parts.push(meta.color);
        return parts.join(", ");
      }
      case "note": {
        return meta.text || "";
      }
      default: {
        return raw;
      }
    }
  } catch {
    return raw;
  }
};

const typeEmoji: Record<string, string> = {
  diaper: "\u{1F6BC}",
  feed: "\u{1F37C}",
  note: "\u{1F4DD}",
  sleep: "\u{1F634}",
};

const typeColors: Record<string, string> = {
  diaper: "border-diaper-200 bg-diaper-50",
  feed: "border-feed-200 bg-feed-50",
  note: "border-neutral-200 bg-neutral-50",
  sleep: "border-sleep-200 bg-sleep-50",
};

export const EventConfirmation = ({
  endedAt,
  eventId,
  metadata,
  startedAt,
  type,
}: EventConfirmationProps) => {
  const { setValue, submit } = useTamboThreadInput();

  const handleDelete = useCallback(() => {
    setValue(`delete the event ${eventId}`);
    submit();
  }, [setValue, submit, eventId]);

  const handleEdit = useCallback(() => {
    setValue(`edit the event ${eventId}: `);
  }, [setValue, eventId]);

  const colorClass = typeColors[type] ?? "border-success-200 bg-success-50";

  return (
    <div className={`animate-fade-up rounded-md border p-3 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{typeEmoji[type] ?? "\u2705"}</span>
          <span className="text-sm font-medium capitalize text-neutral-700">
            {type}
          </span>
          <span className="text-xs text-neutral-400">
            {formatTime(startedAt)}
          </span>
          {endedAt && (
            <span className="text-xs text-neutral-400">
              — {formatTime(endedAt)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            className="min-h-[44px] min-w-[44px] rounded-sm px-2 py-1 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={handleEdit}
            type="button"
          >
            Edit
          </button>
          <button
            className="min-h-[44px] min-w-[44px] rounded-sm px-2 py-1 text-xs font-medium text-danger-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            onClick={handleDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        {formatMetadata(type, metadata)}
      </p>
    </div>
  );
};
