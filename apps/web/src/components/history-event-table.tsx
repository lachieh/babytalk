"use client";

import { useCallback } from "react";

import type { BabyEvent, SyncState } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import {
  formatEventNotes,
  formatEventParts,
  formatEventTimes,
} from "@/lib/format-event";
import type { EventTimes } from "@/lib/format-event";

type RowSync = SyncState | null;

function rowSummary(
  event: BabyEvent,
  times: EventTimes,
  sync: RowSync
): string {
  const { label, detail } = formatEventParts(event);
  const notes = formatEventNotes(event);
  const parts = [detail ? `${label}, ${detail}` : label];
  if (times.inProgress) parts.push(`started ${times.start}, in progress`);
  else if (times.distinctEnd) {
    parts.push(`${times.start} to ${times.distinctEnd}`);
  } else parts.push(times.start);
  if (notes) parts.push(`Note: ${notes}`);
  if (sync === "pending") parts.push("Saving");
  if (sync === "failed") parts.push("Not saved");
  return `${parts.join(". ")}.`;
}

const RowContent = ({
  event,
  times,
  sync,
  interactive,
}: {
  event: BabyEvent;
  interactive: boolean;
  sync: RowSync;
  times: EventTimes;
}) => {
  const { label, detail } = formatEventParts(event);
  const notes = formatEventNotes(event);
  const showEnd = times.inProgress || times.distinctEnd !== null;

  return (
    <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
      <span className="grid w-28 shrink-0 grid-cols-2 gap-x-1 text-neutral-400 text-xs tabular-nums">
        <span className={`whitespace-nowrap ${showEnd ? "" : "col-span-2"}`}>
          {times.start}
        </span>
        {showEnd && (
          <span className="whitespace-nowrap">{times.distinctEnd ?? "—"}</span>
        )}
      </span>
      <EventIcon type={event.type} />
      <span className="min-w-0 flex-1">
        <span className="block text-neutral-700 text-sm">
          <span className="font-medium">{label}</span>
          {detail && <span className="text-neutral-500"> · {detail}</span>}
          {times.inProgress && (
            <span className="ml-1.5 font-normal text-primary-400 text-xs">
              in progress
            </span>
          )}
          {sync === "pending" && (
            <span className="ml-1.5 font-normal text-neutral-400 text-xs">
              Saving…
            </span>
          )}
        </span>
        {notes && (
          <span className="mt-0.5 block truncate text-neutral-400 text-xs">
            {notes}
          </span>
        )}
      </span>
      {interactive && (
        <svg
          className="h-3.5 w-3.5 shrink-0 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
};

const ROW_CLASS =
  "flex min-h-[44px] min-w-0 flex-1 items-center px-4 py-3 text-left";

const EventRow = ({
  event,
  onEdit,
  onRetry,
}: {
  event: BabyEvent;
  onEdit?: (event: BabyEvent) => void;
  onRetry: (id: string) => void;
}) => {
  const handleEdit = useCallback(() => onEdit?.(event), [onEdit, event]);
  const handleRetry = useCallback(() => onRetry(event.id), [onRetry, event.id]);
  const sync = event.syncState ?? null;
  const times = formatEventTimes(event);
  const summary = rowSummary(event, times, sync);
  const content = (
    <>
      <span className="sr-only">{summary}</span>
      <RowContent
        event={event}
        interactive={Boolean(onEdit)}
        sync={sync}
        times={times}
      />
    </>
  );

  return (
    <li className="flex items-center border-neutral-100 border-b">
      {onEdit ? (
        <button
          className={`${ROW_CLASS} transition-colors active:bg-neutral-50`}
          onClick={handleEdit}
          type="button"
        >
          {content}
        </button>
      ) : (
        <div className={ROW_CLASS}>{content}</div>
      )}
      {sync === "failed" && (
        <button
          aria-label={`Not saved. Retry saving ${formatEventParts(event).label.toLowerCase()} at ${times.start}`}
          className="mr-2 flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-lg px-3 font-medium text-danger-500 text-xs transition-colors hover:bg-danger-50"
          onClick={handleRetry}
          type="button"
        >
          Not saved · Retry
        </button>
      )}
    </li>
  );
};

export const HistoryEventTable = ({
  events,
  onEdit,
}: {
  events: BabyEvent[];
  onEdit?: (event: BabyEvent) => void;
}) => {
  const { retryEvent } = useBabyContext();
  return (
    <ul className="space-y-0.5">
      {events.map((event) => (
        <EventRow
          event={event}
          key={event.id}
          onEdit={onEdit}
          onRetry={retryEvent}
        />
      ))}
    </ul>
  );
};
