"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

import { AmountInput } from "./amount-input";

/* ── Helpers ──────────────────────────────────────────────── */

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function parseSide(metadata: string): string | null {
  try {
    return (JSON.parse(metadata) as { side?: string }).side ?? null;
  } catch {
    return null;
  }
}

function parseAmount(metadata: string): number | null {
  try {
    return (JSON.parse(metadata) as { amountMl?: number }).amountMl ?? null;
  } catch {
    return null;
  }
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Suggest the next side: opposite of last single-side pump, or "left" after "both" */
function suggestNextSide(events: BabyEvent[]): string {
  const lastPump = events.find((e) => e.type === "pump" && e.endedAt);
  if (!lastPump) return "left";
  const side = parseSide(lastPump.metadata);
  if (side === "left") return "right";
  if (side === "right") return "left";
  // After "both", default to left
  return "left";
}

/* ── Context Card ─────────────────────────────────────────── */

const ContextCard = ({
  events,
  suggestedSide,
}: {
  events: BabyEvent[];
  suggestedSide: string;
}) => {
  const { unit } = useVolumeUnit();
  const now = Date.now();

  const pumpEvents = useMemo(
    () => events.filter((e) => e.type === "pump" && e.endedAt),
    [events]
  );

  const lastLeft = pumpEvents.find((e) => parseSide(e.metadata) === "left");
  const lastRight = pumpEvents.find((e) => parseSide(e.metadata) === "right");

  const formatSideInfo = (event: BabyEvent | undefined) => {
    if (!event) return { label: "--", ago: "" };
    const amount = parseAmount(event.metadata);
    const mins = (now - new Date(event.startedAt).getTime()) / 60_000;
    const parts: string[] = [];
    if (amount) parts.push(formatVolume(amount, unit));
    parts.push(formatElapsed(mins));
    return {
      label: parts[0] ?? "--",
      ago: parts.length > 1 ? parts[1] : parts[0],
    };
  };

  const left = formatSideInfo(lastLeft);
  const right = formatSideInfo(lastRight);

  return (
    <div className="mx-4 rounded-xl border border-pump-200 bg-pump-50 px-4 py-3">
      <div className="flex gap-4">
        <div className="flex-1 text-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
            Left
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-700">
            {left.label}
          </p>
          {left.ago && (
            <p className="text-[10px] text-neutral-400">{left.ago}</p>
          )}
        </div>
        <div className="w-px bg-pump-200" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
            Right
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-700">
            {right.label}
          </p>
          {right.ago && (
            <p className="text-[10px] text-neutral-400">{right.ago}</p>
          )}
        </div>
      </div>
      <div className="mt-2 border-t border-pump-200 pt-2 text-center">
        <p className="text-[10px] text-neutral-400">
          Suggested next:{" "}
          <span className="font-medium capitalize text-pump-500">
            {suggestedSide}
          </span>
        </p>
      </div>
    </div>
  );
};

/* ── Side Pills ───────────────────────────────────────────── */

const SIDES = ["left", "right", "both"] as const;

const SidePill = ({
  side,
  active,
  onSelect,
}: {
  side: string;
  active: boolean;
  onSelect: (side: string) => void;
}) => {
  const handleClick = useCallback(() => onSelect(side), [onSelect, side]);
  return (
    <button
      className={`min-h-[44px] flex-1 rounded-lg border text-sm font-medium capitalize transition-colors ${
        active
          ? "border-pump-500 bg-pump-100 text-pump-600"
          : "border-neutral-200 text-neutral-400"
      }`}
      onClick={handleClick}
      type="button"
    >
      {side}
    </button>
  );
};

const SidePills = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (side: string) => void;
}) => (
  <div className="flex gap-2">
    {SIDES.map((side) => (
      <SidePill
        active={selected === side}
        key={side}
        onSelect={onSelect}
        side={side}
      />
    ))}
  </div>
);

/* ── Active Timer ─────────────────────────────────────────── */

const PumpTimer = ({
  event,
  onStop,
  onCancel,
}: {
  event: BabyEvent;
  onStop: (id: string) => void;
  onCancel: (id: string) => void;
}) => {
  const [elapsed, setElapsed] = useState(
    () => Date.now() - new Date(event.startedAt).getTime()
  );

  useEffect(() => {
    const start = new Date(event.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event.startedAt]);

  const handleStop = useCallback(() => {
    triggerFeedback("logged");
    onStop(event.id);
  }, [onStop, event.id]);

  const handleCancel = useCallback(
    () => onCancel(event.id),
    [onCancel, event.id]
  );

  const side = parseSide(event.metadata) ?? "pump";

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-pump-200 bg-pump-50 px-4 py-6">
      <p className="text-xs font-medium capitalize text-pump-600">
        {side} side
      </p>
      <p className="font-mono text-4xl font-bold tabular-nums text-neutral-800">
        {formatTimer(elapsed)}
      </p>
      <button
        className="min-h-[48px] w-full rounded-xl bg-pump-500 px-6 py-3 text-base font-semibold text-white transition-[background-color,transform] hover:bg-pump-600 active:scale-[0.97]"
        onClick={handleStop}
        type="button"
      >
        Done
      </button>
      <button
        className="min-h-[36px] px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={handleCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
};

/* ── Session Row ──────────────────────────────────────────── */

const SessionRow = ({ event }: { event: BabyEvent }) => {
  const { unit } = useVolumeUnit();
  const side = parseSide(event.metadata);
  const amount = parseAmount(event.metadata);
  const duration = event.endedAt
    ? formatDuration(event.startedAt, event.endedAt)
    : null;

  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
      <span className="w-14 shrink-0 text-xs tabular-nums text-neutral-400">
        {formatTime(event.startedAt)}
      </span>
      <EventIcon type="pump" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium capitalize text-neutral-700">
          {side ?? "Pump"}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {[amount ? formatVolume(amount, unit) : null, duration]
            .filter(Boolean)
            .join(" \u00B7 ")}
        </p>
      </div>
    </div>
  );
};

/* ── Pump View ────────────────────────────────────────────── */

export const PumpView = () => {
  const {
    events,
    activeEvents,
    logEventDirect,
    stopEvent,
    updateEventMeta,
    deleteEvent,
    loading,
  } = useBabyContext();
  const { unit } = useVolumeUnit();

  const suggested = useMemo(() => suggestNextSide(events), [events]);
  const [selectedSide, setSelectedSide] = useState(suggested);

  // Sync the selected side when the suggestion changes (e.g. after logging)
  useEffect(() => {
    setSelectedSide(suggested);
  }, [suggested]);
  const [pumpStoppedEventId, setPumpStoppedEventId] = useState<string | null>(
    null
  );

  const activePump = activeEvents.find((e) => e.type === "pump") ?? null;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todaySessions = useMemo(
    () =>
      events.filter(
        (e) =>
          e.type === "pump" &&
          e.endedAt !== null &&
          new Date(e.startedAt) >= todayStart
      ),
    [events, todayStart]
  );

  const todayTotal = useMemo(() => {
    let total = 0;
    for (const e of todaySessions) {
      const amt = parseAmount(e.metadata);
      if (amt) total += amt;
    }
    return total;
  }, [todaySessions]);

  const handleStart = useCallback(() => {
    triggerFeedback("logged");
    logEventDirect("pump", { side: selectedSide });
  }, [selectedSide, logEventDirect]);

  const handleStop = useCallback(
    (id: string) => {
      stopEvent(id);
      setPumpStoppedEventId(id);
    },
    [stopEvent]
  );

  const handleCancel = useCallback(
    (id: string) => {
      deleteEvent(id);
    },
    [deleteEvent]
  );

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      if (!pumpStoppedEventId) return;
      const event = events.find((e) => e.id === pumpStoppedEventId);
      if (event) {
        try {
          const meta = JSON.parse(event.metadata);
          updateEventMeta(pumpStoppedEventId, event.type, {
            ...meta,
            amountMl,
          });
        } catch {
          updateEventMeta(pumpStoppedEventId, "pump", { amountMl });
        }
      }
      setPumpStoppedEventId(null);
    },
    [pumpStoppedEventId, events, updateEventMeta]
  );

  const handleAmountCancel = useCallback(() => {
    setPumpStoppedEventId(null);
  }, []);

  if (loading) return null;

  const showActions = !activePump && !pumpStoppedEventId;

  return (
    <div className="py-2">
      {/* Context card */}
      <ContextCard events={events} suggestedSide={suggested} />

      {/* Action zone */}
      <div className="mt-4 px-4">
        {activePump && (
          <PumpTimer
            event={activePump}
            onStop={handleStop}
            onCancel={handleCancel}
          />
        )}

        {pumpStoppedEventId && (
          <div className="rounded-xl border border-pump-200 bg-pump-50 px-4 py-6">
            <p className="mb-3 text-center text-sm font-medium text-neutral-600">
              How much did you express?
            </p>
            <AmountInput
              cancelLabel="Skip"
              onCancel={handleAmountCancel}
              onConfirm={handleAmountConfirm}
            />
          </div>
        )}

        {showActions && (
          <div className="flex flex-col gap-3">
            <SidePills selected={selectedSide} onSelect={setSelectedSide} />
            <button
              className="min-h-[56px] w-full rounded-xl bg-pump-500 px-6 py-4 text-base font-semibold text-white transition-[background-color,transform] hover:bg-pump-600 active:scale-[0.98]"
              onClick={handleStart}
              type="button"
            >
              Start Pumping
            </button>
          </div>
        )}
      </div>

      {/* Today's sessions */}
      <div className="mt-6">
        <div className="flex items-center justify-between px-4 pb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Today&apos;s Sessions
          </p>
          {todayTotal > 0 && (
            <p className="text-xs font-medium text-pump-500">
              Total: {formatVolume(todayTotal, unit)}
            </p>
          )}
        </div>
        {todaySessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            No pump sessions yet today
          </p>
        ) : (
          todaySessions.map((e) => <SessionRow event={e} key={e.id} />)
        )}
      </div>
    </div>
  );
};
