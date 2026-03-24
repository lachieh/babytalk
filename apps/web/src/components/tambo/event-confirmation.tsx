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

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeEmoji[type] ?? "\u2705"}</span>
          <span className="font-medium capitalize">{type}</span>
          <span className="text-sm text-gray-500">{formatTime(startedAt)}</span>
          {endedAt && (
            <span className="text-sm text-gray-500">
              — {formatTime(endedAt)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-green-100"
            onClick={handleEdit}
            type="button"
          >
            Edit
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50"
            onClick={handleDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-700">
        {formatMetadata(type, metadata)}
      </p>
    </div>
  );
};
