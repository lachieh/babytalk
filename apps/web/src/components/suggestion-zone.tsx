"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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

const minutesSince = (iso: string): number =>
  (Date.now() - new Date(iso).getTime()) / 60_000;

function formatAgo(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const SHORT_TO_LONG: Record<string, string> = {
  L: "Breast \u00B7 Left",
  R: "Breast \u00B7 Right",
};

function expandLabel(label: string): string {
  return SHORT_TO_LONG[label] ?? label;
}

/* ── Variant definitions ───────────────────────────────────── */

const FEED_VARIANTS: Variant[] = [
  { key: "breast-l", label: "L", meta: { method: "breast", side: "left" } },
  { key: "breast-r", label: "R", meta: { method: "breast", side: "right" } },
  { key: "bottle", label: "Bottle", meta: { method: "bottle" } },
  { key: "solid", label: "Solid", meta: { method: "solid" } },
];

const DIAPER_VARIANTS: Variant[] = [
  { key: "wet", label: "Wet", meta: { wet: true, soiled: false } },
  { key: "soiled", label: "Soiled", meta: { wet: false, soiled: true } },
  { key: "wet-soiled", label: "Both", meta: { wet: true, soiled: true } },
];

const SLEEP_VARIANTS: Variant[] = [
  { key: "crib", label: "Crib", meta: { location: "crib" } },
  { key: "bassinet", label: "Bass.", meta: { location: "bassinet" } },
  { key: "held", label: "Held", meta: { location: "held" } },
  { key: "carrier", label: "Carrier", meta: { location: "carrier" } },
];

/* ── Styles ────────────────────────────────────────────────── */

const sectionStyles: Record<
  string,
  { bg: string; border: string; chipActive: string }
> = {
  feed: {
    bg: "bg-feed-50",
    border: "border-feed-200",
    chipActive: "bg-feed-200 text-feed-600 border-feed-200",
  },
  diaper: {
    bg: "bg-diaper-50",
    border: "border-diaper-200",
    chipActive: "bg-diaper-200 text-diaper-600 border-diaper-200",
  },
  sleep: {
    bg: "bg-sleep-50",
    border: "border-sleep-200",
    chipActive: "bg-sleep-200 text-sleep-600 border-sleep-200",
  },
};

const chipInactive = "bg-transparent text-neutral-400 border-neutral-200";

/* ── Chip Row ──────────────────────────────────────────────── */

const ChipButton = ({
  variantKey,
  label,
  isSelected,
  activeStyle,
  onSelect,
}: {
  variantKey: string;
  label: string;
  isSelected: boolean;
  activeStyle: string;
  onSelect: (key: string) => void;
}) => {
  const handleClick = useCallback(
    () => onSelect(variantKey),
    [onSelect, variantKey]
  );

  return (
    <button
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${isSelected ? activeStyle : chipInactive}`}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
};

const ChipRow = ({
  variants,
  selected,
  activeStyle,
  onSelect,
}: {
  variants: Variant[];
  selected: string;
  activeStyle: string;
  onSelect: (key: string) => void;
}) => (
  <div className="flex gap-1">
    {variants.map((v) => (
      <ChipButton
        activeStyle={activeStyle}
        isSelected={v.key === selected}
        key={v.key}
        label={v.label}
        onSelect={onSelect}
        variantKey={v.key}
      />
    ))}
  </div>
);

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
    <div className="animate-fade-up mt-2 flex items-center gap-2">
      <input
        ref={inputRef}
        autoFocus
        className="min-h-[40px] w-20 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-center text-sm tabular-nums text-neutral-800 focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
        inputMode="decimal"
        onChange={handleChange}
        placeholder={unit}
        type="number"
        value={amount}
      />
      <div className="flex rounded-md border border-neutral-200 text-xs">
        <button
          className={`px-2 py-1 font-medium transition-colors ${unit === "oz" ? "bg-primary-500 text-white rounded-l-md" : "text-neutral-400"}`}
          onClick={handleSelectOz}
          type="button"
        >
          oz
        </button>
        <button
          className={`px-2 py-1 font-medium transition-colors ${unit === "ml" ? "bg-primary-500 text-white rounded-r-md" : "text-neutral-400"}`}
          onClick={handleSelectMl}
          type="button"
        >
          ml
        </button>
      </div>
      <button
        className="min-h-[40px] rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-[background-color,transform] active:scale-95 disabled:opacity-40"
        disabled={!amount || Number(amount) <= 0}
        onClick={handleConfirm}
        type="button"
      >
        Log
      </button>
      <button
        className="min-h-[40px] px-2 py-2 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
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
    <div className="animate-fade-up mt-2 flex items-center gap-3">
      <span className="font-mono text-lg font-bold tabular-nums text-neutral-800">
        {formatTimer(elapsed)}
      </span>
      <button
        className="min-h-[40px] rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-[background-color,transform] active:scale-95"
        onClick={handleStop}
        type="button"
      >
        Done
      </button>
      <button
        className="min-h-[40px] px-2 py-2 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
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
  sublabel,
  variants,
  defaultVariant,
  onLog,
  onLogWithDuration,
}: {
  type: string;
  icon: string;
  sublabel: string;
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
        // Breast: start timer
        setFlow({ kind: "timer", type: "feed", meta });
      } else if (method === "bottle") {
        // Bottle: ask for amount
        setFlow({ kind: "amount", type: "feed", baseMeta: meta });
      } else {
        // Solid: log instantly
        onLog(type, meta);
      }
      return;
    }

    if (type === "sleep") {
      // Sleep: start timer
      setFlow({ kind: "timer", type: "sleep", meta });
      return;
    }

    // Diaper: log instantly
    onLog(type, meta);
  }, [type, selectedVariant, onLog]);

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
      className={`flex-1 rounded-2xl border p-3 ${styles?.bg ?? ""} ${styles?.border ?? "border-neutral-200"}`}
    >
      {/* Header: icon + chip row */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <ChipRow
          activeStyle={styles?.chipActive ?? ""}
          onSelect={setSelected}
          selected={selected}
          variants={variants}
        />
      </div>

      {/* Main tap area */}
      {!isActive && (
        <button
          className="mt-2 flex w-full items-center justify-between rounded-xl bg-white/60 px-3 py-2.5 text-left transition-[background-color,transform] duration-[var(--duration-fast)] active:scale-[0.97]"
          onClick={handleMainTap}
          type="button"
        >
          <span className="text-sm font-semibold text-neutral-800">
            {expandLabel(selectedVariant.label)}
          </span>
          <span className="text-xs text-neutral-400">{sublabel}</span>
        </button>
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

  const lastFeed = events.find((e) => e.type === "feed");
  const lastDiaper = events.find((e) => e.type === "diaper");
  const lastSleep = events.find((e) => e.type === "sleep");

  const feedAgo = lastFeed ? formatAgo(minutesSince(lastFeed.startedAt)) : "";
  const diaperAgo = lastDiaper
    ? formatAgo(minutesSince(lastDiaper.startedAt))
    : "";
  const sleepAgo = lastSleep
    ? formatAgo(minutesSince(lastSleep.startedAt))
    : "";

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
      // Override startedAt/endedAt via the meta — baby-context will merge
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
        sublabel={feedAgo ? `${feedAgo} ago` : ""}
        type="feed"
        variants={FEED_VARIANTS}
      />
      <ActionSection
        defaultVariant={diaperDefault}
        icon="🚼"
        onLog={handleLog}
        onLogWithDuration={handleLogWithDuration}
        sublabel={diaperAgo ? `${diaperAgo} ago` : ""}
        type="diaper"
        variants={DIAPER_VARIANTS}
      />
      <ActionSection
        defaultVariant={sleepDefault}
        icon="😴"
        onLog={handleLog}
        onLogWithDuration={handleLogWithDuration}
        sublabel={sleepAgo ? `${sleepAgo} ago` : ""}
        type="sleep"
        variants={SLEEP_VARIANTS}
      />
    </div>
  );
};
