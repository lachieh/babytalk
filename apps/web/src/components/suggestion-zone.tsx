"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";

/* ── Types ─────────────────────────────────────────────────── */

interface Variant {
  key: string;
  label: string;
  meta: Record<string, unknown>;
}

/* ── Inference ─────────────────────────────────────────────── */

function inferFeedVariant(events: BabyEvent[]): string {
  const recentFeeds = events
    .filter((e) => e.type === "feed" && e.endedAt !== null)
    .slice(0, 5);
  if (recentFeeds.length === 0) return "breast-l";

  let breastCount = 0;
  let nonBreastCount = 0;
  let lastSide = "left";
  let lastNonBreastMethod = "bottle";

  for (const feed of recentFeeds) {
    try {
      const meta = JSON.parse(feed.metadata);
      if (meta.method === "bottle" || meta.method === "formula") {
        nonBreastCount += 1;
        lastNonBreastMethod = meta.method;
      } else if (meta.method === "breast") {
        breastCount += 1;
      }
      if (meta.side) lastSide = meta.side;
    } catch {
      /* ignore */
    }
  }

  if (nonBreastCount > breastCount) return lastNonBreastMethod;
  return lastSide === "left" ? "breast-r" : "breast-l";
}

function inferDiaperVariant(events: BabyEvent[]): string {
  const recent = events.filter((e) => e.type === "diaper").slice(0, 5);
  let soiledCount = 0;
  for (const d of recent) {
    try {
      if (JSON.parse(d.metadata).soiled) soiledCount += 1;
    } catch {
      /* ignore */
    }
  }
  return soiledCount > recent.length / 2 ? "wet-soiled" : "wet";
}

function inferSleepLocation(events: BabyEvent[]): string {
  const last = events.find((e) => e.type === "sleep");
  if (!last) return "crib";
  try {
    return JSON.parse(last.metadata).location || "crib";
  } catch {
    return "crib";
  }
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/* ── Variant definitions ───────────────────────────────────── */

const FEED_VARIANTS: Variant[] = [
  {
    key: "breast-l",
    label: "Breast \u00B7 Left",
    meta: { method: "breast", side: "left" },
  },
  {
    key: "breast-r",
    label: "Breast \u00B7 Right",
    meta: { method: "breast", side: "right" },
  },
  { key: "bottle", label: "Bottle", meta: { method: "bottle" } },
  { key: "formula", label: "Formula", meta: { method: "formula" } },
  { key: "solid", label: "Solid", meta: { method: "solid" } },
];

const DIAPER_VARIANTS: Variant[] = [
  { key: "wet", label: "Wet", meta: { wet: true, soiled: false } },
  { key: "soiled", label: "Soiled", meta: { wet: false, soiled: true } },
  {
    key: "wet-soiled",
    label: "Wet + Soiled",
    meta: { wet: true, soiled: true },
  },
];

const SLEEP_VARIANTS: Variant[] = [
  { key: "crib", label: "Crib", meta: { location: "crib" } },
  { key: "bassinet", label: "Bassinet", meta: { location: "bassinet" } },
  { key: "held", label: "Held", meta: { location: "held" } },
  { key: "carrier", label: "Carrier", meta: { location: "carrier" } },
];

const PUMP_VARIANTS: Variant[] = [
  { key: "left", label: "Left", meta: { side: "left" } },
  { key: "right", label: "Right", meta: { side: "right" } },
  { key: "both", label: "Both", meta: { side: "both" } },
];

/* ── Styles ────────────────────────────────────────────────── */

const sectionStyles: Record<string, { bg: string; border: string }> = {
  feed: { bg: "bg-feed-50", border: "border-feed-200" },
  pump: { bg: "bg-feed-50", border: "border-feed-200" },
  diaper: { bg: "bg-diaper-50", border: "border-diaper-200" },
  sleep: { bg: "bg-sleep-50", border: "border-sleep-200" },
};

/* ── Dropdown Popover ─────────────────────────────────────── */

const PopoverOption = ({
  variant,
  isSelected,
  onSelect,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: (key: string) => void;
}) => {
  const handleClick = useCallback(
    () => onSelect(variant.key),
    [onSelect, variant.key]
  );

  return (
    <button
      className="flex min-h-[44px] w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <span>{variant.label}</span>
      {isSelected && (
        <svg
          className="h-4 w-4 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  );
};

const VariantPopover = ({
  variants,
  selected,
  onSelect,
  onClose,
}: {
  variants: Variant[];
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="animate-fade-up absolute bottom-full left-1/2 z-50 mb-2 min-w-[160px] -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-surface-raised shadow-lg"
      ref={popoverRef}
    >
      {variants.map((v) => (
        <PopoverOption
          isSelected={v.key === selected}
          key={v.key}
          onSelect={onSelect}
          variant={v}
        />
      ))}
    </div>
  );
};

/* ── Active Timer Display (DB-backed, shared across devices) ── */

const ActiveTimer = ({
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

  let label = event.type;
  try {
    const meta = JSON.parse(event.metadata);
    if (event.type === "feed" && meta.side) {
      label = `${meta.side} side`;
    }
    if (event.type === "sleep" && meta.location) {
      label = meta.location;
    }
  } catch {
    /* ignore */
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-xl font-bold tabular-nums text-neutral-800">
        {formatTimer(elapsed)}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
      <button
        className="min-h-[44px] w-full rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] active:scale-[0.96]"
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

/* ── Amount Input (for bottle feeds) ───────────────────────── */

const AmountInput = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: (amountMl: number) => void;
  onCancel: () => void;
}) => {
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"ml" | "oz">("oz");

  const handleConfirm = useCallback(() => {
    const val = Number(amount);
    if (val <= 0) return;
    const ml = unit === "oz" ? Math.round(val * 29.5735) : val;
    onConfirm(ml);
  }, [amount, unit, onConfirm]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value),
    []
  );

  const handleSelectMl = useCallback(() => setUnit("ml"), []);
  const handleSelectOz = useCallback(() => setUnit("oz"), []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="min-h-[44px] w-20 rounded-xl border border-neutral-200 bg-surface px-3 py-2 text-center text-sm tabular-nums text-neutral-800 focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          inputMode="decimal"
          onChange={handleChange}
          placeholder={unit}
          type="number"
          value={amount}
        />
        <div className="flex rounded-lg border border-neutral-200 text-xs">
          <button
            className={`min-h-[36px] px-2.5 py-1.5 font-medium transition-colors ${unit === "oz" ? "bg-primary-500 text-white rounded-l-lg" : "text-neutral-400"}`}
            onClick={handleSelectOz}
            type="button"
          >
            oz
          </button>
          <button
            className={`min-h-[36px] px-2.5 py-1.5 font-medium transition-colors ${unit === "ml" ? "bg-primary-500 text-white rounded-r-lg" : "text-neutral-400"}`}
            onClick={handleSelectMl}
            type="button"
          >
            ml
          </button>
        </div>
      </div>
      <button
        className="min-h-[44px] w-full rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] active:scale-95 disabled:opacity-40"
        disabled={!amount || Number(amount) <= 0}
        onClick={handleConfirm}
        type="button"
      >
        Log
      </button>
      <button
        className="min-h-[36px] px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
};

/* ── Action Section ────────────────────────────────────────── */

const ActionSection = ({
  type,
  icon,
  variants,
  defaultVariant,
  activeEvent,
  onLog,
  onStop,
  onUpdateMeta,
  onCancel,
}: {
  type: string;
  icon: string;
  variants: Variant[];
  defaultVariant: string;
  activeEvent: BabyEvent | null;
  onLog: (type: string, meta: Record<string, unknown>) => void;
  onStop: (id: string) => void;
  onUpdateMeta: (id: string, meta: Record<string, unknown>) => void;
  onCancel: (id: string) => void;
}) => {
  const [selected, setSelected] = useState(defaultVariant);
  const [expanded, setExpanded] = useState(false);
  const [showAmountInput, setShowAmountInput] = useState(false);

  // Sync selected variant when the inferred default changes (e.g. after logging)
  useEffect(() => {
    setSelected(defaultVariant);
  }, [defaultVariant]);
  // For pump: after stopping timer, capture amount before finalizing
  const [pumpStoppedEventId, setPumpStoppedEventId] = useState<string | null>(
    null
  );
  const styles = sectionStyles[type];

  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];

  const handleMainTap = useCallback(() => {
    triggerFeedback("logged");
    const { meta } = selectedVariant;

    if (type === "feed") {
      const method = meta.method as string;
      if (method === "bottle" || method === "formula") {
        setShowAmountInput(true);
        return;
      }
      // Breast: log with endedAt=null (starts timer). Solid: log instantly.
      onLog(type, meta);
      return;
    }

    if (type === "pump") {
      // Pump: always starts a timer (endedAt=null)
      onLog(type, meta);
      return;
    }

    // Sleep + diaper: log immediately (sleep with endedAt=null starts timer)
    onLog(type, meta);
  }, [type, selectedVariant, onLog]);

  const handleTimerStop = useCallback(
    (id: string) => {
      if (type === "pump") {
        // Pump: stop the timer, then ask for amount
        onStop(id);
        setPumpStoppedEventId(id);
      } else {
        onStop(id);
      }
    },
    [type, onStop]
  );

  const handlePumpAmountConfirm = useCallback(
    (amountMl: number) => {
      if (!pumpStoppedEventId) return;
      onUpdateMeta(pumpStoppedEventId, { ...selectedVariant.meta, amountMl });
      setPumpStoppedEventId(null);
    },
    [pumpStoppedEventId, selectedVariant, onUpdateMeta]
  );

  const handlePumpAmountCancel = useCallback(() => {
    setPumpStoppedEventId(null);
  }, []);

  const handleVariantTap = useCallback(() => setExpanded((prev) => !prev), []);
  const handleOptionSelect = useCallback((key: string) => {
    setSelected(key);
    setExpanded(false);
  }, []);

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      setShowAmountInput(false);
      onLog(type, { ...selectedVariant.meta, amountMl });
    },
    [type, selectedVariant, onLog]
  );

  const handleAmountCancel = useCallback(() => setShowAmountInput(false), []);

  const hasTimer = activeEvent !== null;
  const showPumpAmount = pumpStoppedEventId !== null;
  const showActions = !hasTimer && !showAmountInput && !showPumpAmount;

  return (
    <div
      className={`flex-1 rounded-2xl border p-3 transition-all ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
    >
      {/* Active timer from DB — visible to both parents, survives refresh */}
      {hasTimer && (
        <ActiveTimer
          event={activeEvent}
          onStop={handleTimerStop}
          onCancel={onCancel}
        />
      )}

      {/* Pump: amount input after timer stops */}
      {showPumpAmount && (
        <AmountInput
          onConfirm={handlePumpAmountConfirm}
          onCancel={handlePumpAmountCancel}
        />
      )}

      {/* Bottle/formula amount input (local flow, not a timer) */}
      {showAmountInput && (
        <AmountInput
          onConfirm={handleAmountConfirm}
          onCancel={handleAmountCancel}
        />
      )}

      {/* Normal state: tap to log */}
      {showActions && (
        <>
          <button
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-surface-raised/80 px-3 py-3 text-center transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.96]"
            onClick={handleMainTap}
            type="button"
          >
            <span className="text-2xl">{icon}</span>
          </button>
          <div className="relative mt-2">
            <button
              className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-surface-raised"
              onClick={handleVariantTap}
              type="button"
            >
              <span>{selectedVariant.label}</span>
              <svg
                className={`h-3 w-3 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expanded && (
              <VariantPopover
                onClose={handleVariantTap}
                onSelect={handleOptionSelect}
                selected={selected}
                variants={variants}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ── SuggestionZone ────────────────────────────────────────── */

export const SuggestionZone = () => {
  const {
    events,
    activeEvents,
    logEventDirect,
    stopEvent,
    updateEventMeta,
    deleteEvent,
    loading,
  } = useBabyContext();

  const feedDefault = useMemo(() => inferFeedVariant(events), [events]);
  const diaperDefault = useMemo(() => inferDiaperVariant(events), [events]);
  const sleepDefault = useMemo(() => inferSleepLocation(events), [events]);

  // Find active (in-progress) events for each type
  const activeFeed = activeEvents.find((e) => e.type === "feed") ?? null;
  const activeSleep = activeEvents.find((e) => e.type === "sleep") ?? null;
  const activePump = activeEvents.find((e) => e.type === "pump") ?? null;

  const handleLog = useCallback(
    (type: string, meta: Record<string, unknown>) => {
      triggerFeedback("logged");
      logEventDirect(type, meta);
    },
    [logEventDirect]
  );

  const handleStop = useCallback(
    (id: string) => {
      stopEvent(id);
    },
    [stopEvent]
  );

  const handleUpdateMeta = useCallback(
    (id: string, meta: Record<string, unknown>) => {
      // Determine event type from active events
      const event =
        activeEvents.find((e) => e.id === id) ??
        events.find((e) => e.id === id);
      if (event) {
        updateEventMeta(id, event.type, meta);
      }
    },
    [activeEvents, events, updateEventMeta]
  );

  const handleCancel = useCallback(
    (id: string) => {
      deleteEvent(id);
    },
    [deleteEvent]
  );

  if (loading) return null;

  return (
    <div className="flex gap-2 px-4 py-3">
      <ActionSection
        activeEvent={activeFeed}
        defaultVariant={feedDefault}
        icon="🍼"
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="feed"
        variants={FEED_VARIANTS}
      />
      <ActionSection
        activeEvent={activePump}
        defaultVariant="left"
        icon="🤱"
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="pump"
        variants={PUMP_VARIANTS}
      />
      <ActionSection
        activeEvent={null}
        defaultVariant={diaperDefault}
        icon="🚼"
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="diaper"
        variants={DIAPER_VARIANTS}
      />
      <ActionSection
        activeEvent={activeSleep}
        defaultVariant={sleepDefault}
        icon="😴"
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="sleep"
        variants={SLEEP_VARIANTS}
      />
    </div>
  );
};
