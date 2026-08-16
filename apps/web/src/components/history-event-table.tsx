"use client";

import { useCallback } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { isDurationEvent } from "@/lib/event-time";
import { formatEventNotes, formatEventParts } from "@/lib/format-event";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const EventRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit?: (event: BabyEvent) => void;
}) => {
  const handleClick = useCallback(() => onEdit?.(event), [onEdit, event]);
  const { label, detail } = formatEventParts(event);
  const notes = formatEventNotes(event);
  const inProgress = isDurationEvent(event) && event.endedAt === null;
  const hasDistinctEndTime =
    event.endedAt !== null && event.endedAt !== event.startedAt;
  const showSingleTimeCell = !hasDistinctEndTime && !inProgress;
  const endTimeLabel =
    hasDistinctEndTime && event.endedAt ? formatTime(event.endedAt) : "—";

  return (
    <button
      className="flex w-full items-center gap-3 border-neutral-100 border-b px-4 py-3 text-left transition-colors active:bg-neutral-50"
      onClick={onEdit ? handleClick : undefined}
      type="button"
    >
      <div className="grid w-28 shrink-0 grid-cols-2 gap-x-1 text-neutral-400 text-xs tabular-nums">
        {showSingleTimeCell ? (
          <span className="col-span-2 whitespace-nowrap">
            {formatTime(event.startedAt)}
          </span>
        ) : (
          <>
            <span className="whitespace-nowrap">
              {formatTime(event.startedAt)}
            </span>
            <span className="whitespace-nowrap">{endTimeLabel}</span>
          </>
        )}
      </div>
      <EventIcon type={event.type} />
      <div className="min-w-0 flex-1">
        <p className="text-neutral-700 text-sm">
          <span className="font-medium">{label}</span>
          {detail && <span className="text-neutral-500"> · {detail}</span>}
          {inProgress && (
            <span className="ml-1.5 font-normal text-primary-400 text-xs">
              in progress
            </span>
          )}
        </p>
        {notes && (
          <p className="mt-0.5 truncate text-neutral-400 text-xs">{notes}</p>
        )}
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-neutral-300"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

export const HistoryEventTable = ({
  events,
  onEdit,
}: {
  events: BabyEvent[];
  onEdit?: (event: BabyEvent) => void;
}) => (
  <div className="space-y-0.5">
    {events.map((event) => (
      <EventRow event={event} key={event.id} onEdit={onEdit} />
    ))}
  </div>
);
