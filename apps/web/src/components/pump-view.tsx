"use client";

import { useCallback, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { eventAwaitingAmount, lastAmountMl } from "@/lib/daily-totals";
import { EventIcon } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

import { ActiveTimer } from "./active-timer";
import { AmountInput, useDismissedAmountPrompts } from "./amount-input";
import { EventEditSheet } from "./event-edit-sheet";
import { PumpStartSegments } from "./pump-start-segments";

/* ── Helpers ──────────────────────────────────────────────── */

interface SessionMeta {
  amountMl?: number;
  method?: string;
  side?: string;
}

function parseMeta(metadata: string): SessionMeta {
  try {
    return JSON.parse(metadata) as SessionMeta;
  } catch {
    return {};
  }
}

function formatDuration(startedAt: string, endedAt: string): string | null {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const SIDE_LABELS: Record<string, string> = {
  both: "Both sides",
  left: "Left",
  right: "Right",
};

const BREAST_LABELS: Record<string, string> = {
  both: "Both breasts",
  left: "Left breast",
  right: "Right breast",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const isBreastFeed = (e: BabyEvent) =>
  e.type === "feed" && parseMeta(e.metadata).method === "breast";

/* ── Session Row ──────────────────────────────────────────── */

const SessionRow = ({
  event,
  onEdit,
}: {
  event: BabyEvent;
  onEdit: (event: BabyEvent) => void;
}) => {
  const { unit } = useVolumeUnit();
  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const { amountMl, side } = parseMeta(event.metadata);
  const duration = event.endedAt
    ? formatDuration(event.startedAt, event.endedAt)
    : null;

  const label =
    event.type === "feed"
      ? (BREAST_LABELS[side ?? ""] ?? "Breast")
      : (SIDE_LABELS[side ?? ""] ?? "Pump");
  const detail = [amountMl ? formatVolume(amountMl, unit) : null, duration]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <button
        className="flex min-h-[56px] w-full items-center gap-3 border-neutral-100 border-b px-4 py-2 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
        onClick={handleClick}
        type="button"
      >
        <span className="w-16 shrink-0 text-neutral-500 text-xs tabular-nums">
          {formatTime(event.startedAt)}
        </span>
        <span aria-hidden="true">
          <EventIcon type={event.type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-neutral-700 text-sm">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block text-neutral-500 text-xs">
              {detail}
            </span>
          )}
        </span>
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  );
};

const sectionHeading =
  "font-medium text-neutral-500 text-xs uppercase tracking-wider";

/* ── Pump View ────────────────────────────────────────────── */

export const PumpView = () => {
  const {
    baby,
    events,
    activeEvents,
    completeAmount,
    discardEvent,
    logEventDirect,
    stopEvent,
  } = useBabyContext();
  const { unit } = useVolumeUnit();
  const { dismissed, dismiss } = useDismissedAmountPrompts();

  const activePump = activeEvents.find((e) => e.type === "pump") ?? null;
  const awaitingAmount = eventAwaitingAmount(
    events,
    "pump",
    Date.now(),
    dismissed
  );

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const handleEdit = useCallback((event: BabyEvent) => {
    setEditingEvent(event);
    setEditSheetOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditSheetOpen(false);
    setEditingEvent(null);
  }, []);

  const finishedToday = useMemo(
    () =>
      events.filter(
        (e) => e.endedAt !== null && new Date(e.startedAt) >= todayStart
      ),
    [events, todayStart]
  );
  const pumpSessions = useMemo(
    () => finishedToday.filter((e) => e.type === "pump"),
    [finishedToday]
  );
  const breastfeeds = useMemo(
    () => finishedToday.filter(isBreastFeed),
    [finishedToday]
  );

  const pumpedTotal = useMemo(() => {
    let total = 0;
    for (const e of pumpSessions) {
      total += parseMeta(e.metadata).amountMl ?? 0;
    }
    return total;
  }, [pumpSessions]);

  const lastPumpAmount = useMemo(() => lastAmountMl(events, "pump"), [events]);

  const handleStart = useCallback(
    (side: "left" | "right" | "both") => {
      triggerFeedback("logged");
      logEventDirect("pump", { side });
    },
    [logEventDirect]
  );

  const handleStop = useCallback(
    (event: BabyEvent) => {
      stopEvent(event.id);
    },
    [stopEvent]
  );

  const handleDiscard = useCallback(
    (event: BabyEvent) => discardEvent(event.id),
    [discardEvent]
  );

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      if (!awaitingAmount) return;
      completeAmount(awaitingAmount.id, amountMl);
      dismiss(awaitingAmount.id);
    },
    [awaitingAmount, completeAmount, dismiss]
  );

  const handleAmountSkip = useCallback(() => {
    if (!awaitingAmount) return;
    completeAmount(awaitingAmount.id, null);
    dismiss(awaitingAmount.id);
  }, [awaitingAmount, completeAmount, dismiss]);

  let action: React.ReactNode;
  if (activePump) {
    action = (
      <ActiveTimer
        event={activePump}
        onDiscard={handleDiscard}
        onStop={handleStop}
      />
    );
  } else if (awaitingAmount) {
    action = (
      <div className="rounded-2xl border border-neutral-200 bg-surface-raised p-4">
        <AmountInput
          label="How much did you pump?"
          lastAmountMl={lastPumpAmount}
          onCancel={handleAmountSkip}
          onConfirm={handleAmountConfirm}
        />
      </div>
    );
  } else {
    action = (
      <section aria-labelledby="pump-start-heading">
        <h2
          className="pb-3 text-center font-serif text-lg text-neutral-600 italic"
          id="pump-start-heading"
        >
          Start pumping
        </h2>
        <PumpStartSegments disabled={baby === null} onStart={handleStart} />
      </section>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 pt-2 pb-4">
        <section aria-labelledby="pumped-today-heading">
          <div className="flex items-baseline justify-between px-4 pb-2">
            <h2 className={sectionHeading} id="pumped-today-heading">
              Pumped today
            </h2>
            {pumpedTotal > 0 && (
              <p className="font-medium text-pump-600 text-sm tabular-nums">
                {formatVolume(pumpedTotal, unit)} total
              </p>
            )}
          </div>
          {pumpSessions.length === 0 && activePump ? (
            <p className="px-6 py-6 text-center text-neutral-600 text-sm">
              Pumping now. The session is listed here once you tap Done.
            </p>
          ) : null}
          {pumpSessions.length === 0 && !activePump ? (
            <div className="px-6 py-6 text-center">
              <p className="text-neutral-600 text-sm">
                No pumping logged today.
              </p>
              <p className="mx-auto mt-1 max-w-xs text-neutral-500 text-sm">
                Choose a side below to start a timer. Finished sessions are
                listed here with their amounts.
              </p>
            </div>
          ) : (
            <ul>
              {pumpSessions.map((e) => (
                <SessionRow event={e} key={e.id} onEdit={handleEdit} />
              ))}
            </ul>
          )}
        </section>

        {breastfeeds.length > 0 && (
          <section aria-labelledby="breastfed-today-heading" className="mt-6">
            <h2
              className={`px-4 pb-2 ${sectionHeading}`}
              id="breastfed-today-heading"
            >
              Breastfed today
            </h2>
            <ul>
              {breastfeeds.map((e) => (
                <SessionRow event={e} key={e.id} onEdit={handleEdit} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-neutral-200 border-t bg-surface px-4 pt-4 pb-[4.75rem]">
        {action}
      </div>

      <EventEditSheet
        event={editingEvent}
        onClose={handleEditClose}
        open={editSheetOpen}
      />
    </div>
  );
};
