"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";

import { ActiveTimer } from "./active-timer";
import { AmountInput } from "./amount-input";

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

/* ── Styles ────────────────────────────────────────────────── */

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
      className="animate-fade-up absolute top-full left-0 z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-neutral-200 bg-surface-raised shadow-lg"
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

/* ── Action Section ────────────────────────────────────────── */

const ActionSection = ({
  type,
  variants,
  defaultVariant,
  activeEvent,
  onLog,
  onStop,
  onUpdateMeta,
  onCancel,
}: {
  type: string;
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
      if (method === "solid") {
        // Solid: instant event
        const now = new Date().toISOString();
        onLog(type, { ...meta, _startedAt: now, _endedAt: now });
        return;
      }
      // Breast: log with endedAt=null (starts timer)
      onLog(type, meta);
      return;
    }

    if (type === "pump") {
      // Pump: always starts a timer (endedAt=null)
      onLog(type, meta);
      return;
    }

    if (type === "diaper") {
      // Diaper: instant event — set endedAt = startedAt (point in time, not duration)
      const now = new Date().toISOString();
      onLog(type, { ...meta, _startedAt: now, _endedAt: now });
      return;
    }

    // Sleep: log with endedAt=null (starts timer)
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
      // Bottle/formula are instant events (known quantity, no timer)
      const now = new Date().toISOString();
      onLog(type, {
        ...selectedVariant.meta,
        amountMl,
        _startedAt: now,
        _endedAt: now,
      });
    },
    [type, selectedVariant, onLog]
  );

  const handleAmountCancel = useCallback(() => setShowAmountInput(false), []);

  const hasTimer = activeEvent !== null;
  const showPumpAmount = pumpStoppedEventId !== null;
  const showActions = !hasTimer && !showAmountInput && !showPumpAmount;
  const style = getEventStyle(type);

  return (
    <div className="flex-1">
      {/* Active timer */}
      {hasTimer && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <ActiveTimer
            event={activeEvent}
            onStop={handleTimerStop}
            onCancel={onCancel}
          />
        </div>
      )}

      {/* Pump: amount input after timer stops */}
      {showPumpAmount && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <AmountInput
            onConfirm={handlePumpAmountConfirm}
            onCancel={handlePumpAmountCancel}
          />
        </div>
      )}

      {/* Bottle/formula amount input */}
      {showAmountInput && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <AmountInput
            onConfirm={handleAmountConfirm}
            onCancel={handleAmountCancel}
          />
        </div>
      )}

      {/* Normal state: bordered square button */}
      {showActions && (
        <>
          <button
            className={`flex w-full flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-[background-color,transform] active:scale-[0.97] ${style.buttonBg}`}
            onClick={handleMainTap}
            type="button"
          >
            <EventIcon type={type} />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em]">
              {type}
            </span>
          </button>
          <div className="relative mt-1.5">
            <button
              className="flex w-full items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-neutral-400 transition-colors hover:text-neutral-600"
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

/* ── Pump Shortcut (navigates to Pump tab) ────────────────── */

const PumpShortcut = ({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) => (
  <div className="flex-1">
    <button
      className="flex w-full flex-col items-center gap-2 rounded-lg border border-pump-200 bg-pump-50 px-3 py-4 text-center text-pump-600 transition-[background-color,transform] active:scale-[0.97] active:bg-pump-100"
      onClick={onClick}
      type="button"
    >
      <EventIcon type="pump" />
      <span className="text-[10px] font-medium uppercase tracking-[0.15em]">
        Pump
      </span>
      {active && (
        <span className="animate-pulse text-[9px] font-medium text-pump-500">
          in progress
        </span>
      )}
    </button>
  </div>
);

/* ── SuggestionZone ────────────────────────────────────────── */

export const SuggestionZone = ({
  onNavigateToPump,
}: {
  onNavigateToPump?: () => void;
}) => {
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
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="feed"
        variants={FEED_VARIANTS}
      />
      {onNavigateToPump && (
        <PumpShortcut
          active={activeEvents.some((e) => e.type === "pump")}
          onClick={onNavigateToPump}
        />
      )}
      <ActionSection
        activeEvent={activeSleep}
        defaultVariant={sleepDefault}
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="sleep"
        variants={SLEEP_VARIANTS}
      />
      <ActionSection
        activeEvent={null}
        defaultVariant={diaperDefault}
        onCancel={handleCancel}
        onLog={handleLog}
        onStop={handleStop}
        onUpdateMeta={handleUpdateMeta}
        type="diaper"
        variants={DIAPER_VARIANTS}
      />
    </div>
  );
};
