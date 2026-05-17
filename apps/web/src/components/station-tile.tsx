"use client";

import { useCallback, useEffect, useState } from "react";

import { ActiveTimer } from "@/components/active-timer";
import { AmountInput } from "@/components/amount-input";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";
import type { StationActionKey } from "@/lib/station-config";

interface Variant {
  key: string;
  label: string;
  meta: Record<string, unknown>;
}

const FEED_VARIANTS: Variant[] = [
  {
    key: "breast-l",
    label: "Breast · Left",
    meta: { method: "breast", side: "left" },
  },
  {
    key: "breast-r",
    label: "Breast · Right",
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
  { key: "both", label: "Both sides", meta: { side: "both" } },
  { key: "left", label: "Left", meta: { side: "left" } },
  { key: "right", label: "Right", meta: { side: "right" } },
];

const NOTE_VARIANTS: Variant[] = [{ key: "note", label: "Note", meta: {} }];

const VARIANTS_BY_TYPE: Record<StationActionKey, Variant[]> = {
  diaper: DIAPER_VARIANTS,
  feed: FEED_VARIANTS,
  note: NOTE_VARIANTS,
  pump: PUMP_VARIANTS,
  sleep: SLEEP_VARIANTS,
};

const inferFeedDefault = (events: BabyEvent[]): string => {
  const recent = events
    .filter((e) => e.type === "feed" && e.endedAt !== null)
    .slice(0, 5);
  if (recent.length === 0) return "breast-l";

  let breastCount = 0;
  let nonBreastCount = 0;
  let lastSide = "left";
  let lastNonBreast = "bottle";

  for (const feed of recent) {
    try {
      const meta = JSON.parse(feed.metadata);
      if (meta.method === "bottle" || meta.method === "formula") {
        nonBreastCount += 1;
        lastNonBreast = meta.method;
      } else if (meta.method === "breast") {
        breastCount += 1;
      }
      if (meta.side) lastSide = meta.side;
    } catch {
      /* ignore */
    }
  }

  if (nonBreastCount > breastCount) return lastNonBreast;
  return lastSide === "left" ? "breast-r" : "breast-l";
};

const inferDiaperDefault = (events: BabyEvent[]): string => {
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
};

const inferSleepDefault = (events: BabyEvent[]): string => {
  const last = events.find((e) => e.type === "sleep");
  if (!last) return "crib";
  try {
    return JSON.parse(last.metadata).location || "crib";
  } catch {
    return "crib";
  }
};

const inferDefault = (type: StationActionKey, events: BabyEvent[]): string => {
  switch (type) {
    case "feed": {
      return inferFeedDefault(events);
    }
    case "diaper": {
      return inferDiaperDefault(events);
    }
    case "sleep": {
      return inferSleepDefault(events);
    }
    default: {
      return VARIANTS_BY_TYPE[type][0].key;
    }
  }
};

type LocalPhase = "idle" | "picking" | "amount" | "note" | "pump-amount";

const VariantOption = ({
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
    [variant.key, onSelect]
  );
  return (
    <button
      className="flex min-h-[56px] w-full items-center justify-between px-5 py-3 text-left text-base text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      onClick={handleClick}
      type="button"
    >
      <span>{variant.label}</span>
      {isSelected && (
        <svg
          aria-hidden="true"
          className="h-5 w-5 text-primary-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

const VariantPicker = ({
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
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );
  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
    >
      <div className="animate-slide-up w-full max-w-md rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <ul className="py-2">
          {variants.map((v) => (
            <li key={v.key}>
              <VariantOption
                isSelected={v.key === selected}
                onSelect={onSelect}
                variant={v}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const StationTile = ({ type }: { type: StationActionKey }) => {
  const {
    events,
    activeEvents,
    logEventDirect,
    stopEvent,
    updateEventMeta,
    deleteEvent,
  } = useBabyContext();

  const [phase, setPhase] = useState<LocalPhase>("idle");
  const [selected, setSelected] = useState<string>(() =>
    inferDefault(type, events)
  );
  const [noteText, setNoteText] = useState("");
  const [pumpEventId, setPumpEventId] = useState<string | null>(null);

  useEffect(() => {
    setSelected(inferDefault(type, events));
  }, [type, events]);

  const variants = VARIANTS_BY_TYPE[type];
  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];

  const activeEvent =
    type === "diaper" || type === "note"
      ? null
      : (activeEvents.find((e) => e.type === type) ?? null);

  const style = getEventStyle(type);

  const handleLog = useCallback(
    (meta: Record<string, unknown>, instant: boolean) => {
      triggerFeedback("logged");
      const now = new Date().toISOString();
      const payload = instant
        ? { ...meta, _endedAt: now, _startedAt: now }
        : meta;
      logEventDirect(type, payload);
    },
    [type, logEventDirect]
  );

  const handleMainTap = useCallback(() => {
    const { meta } = selectedVariant;

    if (type === "feed") {
      const method = meta.method as string;
      if (method === "bottle" || method === "formula") {
        setPhase("amount");
        return;
      }
      if (method === "solid") {
        handleLog(meta, true);
        return;
      }
      handleLog(meta, false);
      return;
    }

    if (type === "diaper") {
      handleLog(meta, true);
      return;
    }

    if (type === "note") {
      setNoteText("");
      setPhase("note");
      return;
    }

    handleLog(meta, false);
  }, [type, selectedVariant, handleLog]);

  const handleTimerStop = useCallback(
    (id: string) => {
      if (type === "pump") {
        stopEvent(id);
        setPumpEventId(id);
        setPhase("pump-amount");
        return;
      }
      stopEvent(id);
    },
    [type, stopEvent]
  );

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      handleLog({ ...selectedVariant.meta, amountMl }, true);
      setPhase("idle");
    },
    [selectedVariant, handleLog]
  );

  const handlePumpAmountConfirm = useCallback(
    (amountMl: number) => {
      if (!pumpEventId) return;
      updateEventMeta(pumpEventId, "pump", {
        ...selectedVariant.meta,
        amountMl,
      });
      setPumpEventId(null);
      setPhase("idle");
    },
    [pumpEventId, selectedVariant, updateEventMeta]
  );

  const handleCancelOverlay = useCallback(() => {
    setPhase("idle");
    setPumpEventId(null);
  }, []);

  const handleNoteSubmit = useCallback(() => {
    if (!noteText.trim()) {
      setPhase("idle");
      return;
    }
    handleLog({ text: noteText.trim() }, true);
    setNoteText("");
    setPhase("idle");
  }, [noteText, handleLog]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value),
    []
  );

  const handlePickerOpen = useCallback(() => setPhase("picking"), []);
  const handlePickerClose = useCallback(() => setPhase("idle"), []);
  const handleOptionSelect = useCallback((key: string) => {
    setSelected(key);
    setPhase("idle");
  }, []);

  if (activeEvent) {
    return (
      <article
        className={`flex h-full flex-col rounded-3xl border-2 p-5 ${style.buttonBg}`}
      >
        <ActiveTimer
          event={activeEvent}
          onCancel={deleteEvent}
          onStop={handleTimerStop}
        />
      </article>
    );
  }

  if (phase === "pump-amount") {
    return (
      <article className="flex h-full flex-col rounded-3xl border-2 border-neutral-200 bg-surface-raised p-5">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
          Pump amount
        </p>
        <AmountInput
          onCancel={handleCancelOverlay}
          onConfirm={handlePumpAmountConfirm}
        />
      </article>
    );
  }

  if (phase === "amount") {
    return (
      <article className="flex h-full flex-col rounded-3xl border-2 border-neutral-200 bg-surface-raised p-5">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
          {selectedVariant.label}
        </p>
        <AmountInput
          onCancel={handleCancelOverlay}
          onConfirm={handleAmountConfirm}
        />
      </article>
    );
  }

  if (phase === "note") {
    return (
      <article className="flex h-full flex-col rounded-3xl border-2 border-neutral-200 bg-surface-raised p-5">
        <label
          className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-neutral-400"
          htmlFor="station-note-text"
        >
          Quick note
        </label>
        <textarea
          autoFocus
          className="min-h-[96px] flex-1 rounded-xl border border-neutral-200 bg-surface px-3 py-2 text-base text-neutral-800 placeholder:text-neutral-400 focus-visible:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          id="station-note-text"
          onChange={handleNoteChange}
          placeholder="Anything to remember..."
          value={noteText}
        />
        <div className="mt-3 flex gap-2">
          <button
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-500"
            onClick={handleCancelOverlay}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-[44px] flex-[2] rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] active:scale-[0.96] disabled:opacity-40"
            disabled={!noteText.trim()}
            onClick={handleNoteSubmit}
            type="button"
          >
            Save note
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex h-full flex-col">
      <button
        className={`flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-2 px-4 py-8 text-center transition-[background-color,transform] active:scale-[0.97] ${style.buttonBg}`}
        onClick={handleMainTap}
        type="button"
      >
        <span className="scale-[2.25]">
          <EventIcon type={type} />
        </span>
        <span className="text-lg font-semibold capitalize tracking-wide">
          {type}
        </span>
      </button>
      {variants.length > 1 && (
        <button
          aria-label={`Change ${type} variant — currently ${selectedVariant.label}`}
          className="mt-2 flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100"
          onClick={handlePickerOpen}
          type="button"
        >
          <span>{selectedVariant.label}</span>
          <svg
            aria-hidden="true"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M19 9l-7 7-7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {phase === "picking" && (
        <VariantPicker
          onClose={handlePickerClose}
          onSelect={handleOptionSelect}
          selected={selected}
          variants={variants}
        />
      )}
    </article>
  );
};
