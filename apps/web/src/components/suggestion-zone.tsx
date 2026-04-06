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
  const recentFeeds = events.filter((e) => e.type === "feed").slice(0, 5);
  if (recentFeeds.length === 0) return "breast-l";

  let breastCount = 0;
  let bottleCount = 0;
  let lastSide = "left";

  for (const feed of recentFeeds) {
    try {
      const meta = JSON.parse(feed.metadata);
      if (meta.method === "bottle") bottleCount += 1;
      else breastCount += 1;
      if (meta.side) lastSide = meta.side;
    } catch {
      /* ignore */
    }
  }

  if (bottleCount > breastCount) return "bottle";
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

const sectionStyles: Record<
  string,
  { bg: string; border: string; optionActive: string }
> = {
  feed: {
    bg: "bg-feed-50",
    border: "border-feed-200",
    optionActive: "bg-feed-200 text-feed-600",
  },
  diaper: {
    bg: "bg-diaper-50",
    border: "border-diaper-200",
    optionActive: "bg-diaper-200 text-diaper-600",
  },
  sleep: {
    bg: "bg-sleep-50",
    border: "border-sleep-200",
    optionActive: "bg-sleep-200 text-sleep-600",
  },
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="animate-fade-up mt-3 flex items-center gap-2">
      <input
        ref={inputRef}
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
          className={`min-h-[44px] px-3 py-2 font-medium transition-colors ${unit === "oz" ? "bg-primary-500 text-white rounded-l-lg" : "text-neutral-400"}`}
          onClick={handleSelectOz}
          type="button"
        >
          oz
        </button>
        <button
          className={`min-h-[44px] px-3 py-2 font-medium transition-colors ${unit === "ml" ? "bg-primary-500 text-white rounded-r-lg" : "text-neutral-400"}`}
          onClick={handleSelectMl}
          type="button"
        >
          ml
        </button>
      </div>
      <button
        className="min-h-[44px] rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-[background-color,transform] active:scale-95 disabled:opacity-40"
        disabled={!amount || Number(amount) <= 0}
        onClick={handleConfirm}
        type="button"
      >
        Log
      </button>
      <button
        className="min-h-[44px] px-2 py-2 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
};

/* ── Inline Timer ──────────────────────────────────────────── */

const InlineTimer = ({
  type,
  meta,
  onStop,
  onCancel,
}: {
  type: string;
  meta: Record<string, unknown>;
  onStop: (
    type: string,
    meta: Record<string, unknown>,
    durationMs: number
  ) => void;
  onCancel: () => void;
}) => {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!tickRef.current) {
    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 1000);
  }

  const handleStop = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    onStop(type, meta, Date.now() - startRef.current);
  }, [onStop, type, meta]);

  const handleCancel = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    onCancel();
  }, [onCancel]);

  return (
    <div className="animate-fade-up mt-3 flex items-center gap-3">
      <span className="font-mono text-lg font-bold tabular-nums text-neutral-800">
        {formatTimer(elapsed)}
      </span>
      <button
        className="min-h-[44px] rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-[background-color,transform] active:scale-95"
        onClick={handleStop}
        type="button"
      >
        Done
      </button>
      <button
        className="min-h-[44px] px-2 py-2 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={handleCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
};

/* ── Action Section ────────────────────────────────────────── */

type ActiveFlow =
  | { kind: "idle" }
  | { kind: "timer"; type: string; meta: Record<string, unknown> }
  | { kind: "amount"; type: string; baseMeta: Record<string, unknown> };

const ActionSection = ({
  type,
  icon,
  variants,
  defaultVariant,
  onLog,
  onLogWithDuration,
}: {
  type: string;
  icon: string;
  variants: Variant[];
  defaultVariant: string;
  onLog: (type: string, meta: Record<string, unknown>) => void;
  onLogWithDuration: (
    type: string,
    meta: Record<string, unknown>,
    durationMs: number
  ) => void;
}) => {
  const [selected, setSelected] = useState(defaultVariant);
  const [expanded, setExpanded] = useState(false);
  const [flow, setFlow] = useState<ActiveFlow>({ kind: "idle" });
  const styles = sectionStyles[type];

  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];

  const handleMainTap = useCallback(() => {
    triggerFeedback("logged");
    const { meta } = selectedVariant;

    if (type === "feed") {
      const method = meta.method as string;
      if (method === "breast") {
        setFlow({ kind: "timer", type: "feed", meta });
      } else if (method === "bottle") {
        setFlow({ kind: "amount", type: "feed", baseMeta: meta });
      } else {
        onLog(type, meta);
      }
      return;
    }

    if (type === "sleep") {
      setFlow({ kind: "timer", type: "sleep", meta });
      return;
    }

    onLog(type, meta);
  }, [type, selectedVariant, onLog]);

  const handleVariantTap = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleOptionSelect = useCallback((key: string) => {
    setSelected(key);
    setExpanded(false);
  }, []);

  const handleTimerStop = useCallback(
    (_type: string, meta: Record<string, unknown>, durationMs: number) => {
      setFlow({ kind: "idle" });
      onLogWithDuration(_type, meta, durationMs);
    },
    [onLogWithDuration]
  );

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      if (flow.kind !== "amount") return;
      setFlow({ kind: "idle" });
      onLog(flow.type, { ...flow.baseMeta, amountMl });
    },
    [flow, onLog]
  );

  const handleFlowCancel = useCallback(() => setFlow({ kind: "idle" }), []);

  const isActive = flow.kind !== "idle";

  return (
    <div
      className={`flex-1 rounded-2xl border p-3 transition-all ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
    >
      {/* Main tap area — logs with current variant */}
      {!isActive && (
        <button
          className="flex w-full flex-col items-center gap-1 rounded-xl bg-surface-raised/80 px-3 py-3 text-center transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.96]"
          onClick={handleMainTap}
          type="button"
        >
          <span className="text-2xl">{icon}</span>
        </button>
      )}

      {/* Variant label — tappable to open dropdown */}
      {!isActive && (
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
      )}

      {/* Active flows */}
      {flow.kind === "timer" && (
        <InlineTimer
          meta={flow.meta}
          onCancel={handleFlowCancel}
          onStop={handleTimerStop}
          type={flow.type}
        />
      )}
      {flow.kind === "amount" && (
        <AmountInput
          onCancel={handleFlowCancel}
          onConfirm={handleAmountConfirm}
        />
      )}
    </div>
  );
};

/* ── SuggestionZone ────────────────────────────────────────── */

export const SuggestionZone = () => {
  const { events, logEventDirect, loading } = useBabyContext();

  const feedDefault = useMemo(() => inferFeedVariant(events), [events]);
  const diaperDefault = useMemo(() => inferDiaperVariant(events), [events]);
  const sleepDefault = useMemo(() => inferSleepLocation(events), [events]);

  const handleLog = useCallback(
    (type: string, meta: Record<string, unknown>) => {
      triggerFeedback("logged");
      logEventDirect(type, meta);
    },
    [logEventDirect]
  );

  const handleLogWithDuration = useCallback(
    (type: string, meta: Record<string, unknown>, durationMs: number) => {
      triggerFeedback("logged");
      const startedAt = new Date(Date.now() - durationMs).toISOString();
      const endedAt = new Date().toISOString();
      logEventDirect(type, {
        ...meta,
        _startedAt: startedAt,
        _endedAt: endedAt,
      });
    },
    [logEventDirect]
  );

  if (loading) return null;

  return (
    <div className="flex gap-2 px-4 py-3">
      <ActionSection
        defaultVariant={feedDefault}
        icon="🍼"
        onLog={handleLog}
        onLogWithDuration={handleLogWithDuration}
        type="feed"
        variants={FEED_VARIANTS}
      />
      <ActionSection
        defaultVariant={diaperDefault}
        icon="🚼"
        onLog={handleLog}
        onLogWithDuration={handleLogWithDuration}
        type="diaper"
        variants={DIAPER_VARIANTS}
      />
      <ActionSection
        defaultVariant={sleepDefault}
        icon="😴"
        onLog={handleLog}
        onLogWithDuration={handleLogWithDuration}
        type="sleep"
        variants={SLEEP_VARIANTS}
      />
    </div>
  );
};
