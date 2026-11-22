"use client";

import { useCallback, useId, useState } from "react";

import { AmountInput } from "@/components/amount-input";
import { ChoiceChips, Sheet } from "@/components/sheet";
import type { BabyEvent } from "@/lib/baby-context";
import { methodTakesAmount } from "@/lib/daily-totals";
import { EVENT_TYPE_LABELS, parseMeta } from "@/lib/event-meta";
import { BACKDATE_MINUTES, logTimes } from "@/lib/event-time";
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

export const VARIANTS_BY_TYPE: Record<StationActionKey, Variant[]> = {
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
  let lastSide: string | null = null;
  let lastNonBreast: string | null = null;

  for (const feed of recent) {
    try {
      const meta = JSON.parse(feed.metadata);
      if (meta.method === "bottle" || meta.method === "formula") {
        nonBreastCount += 1;
        lastNonBreast ??= meta.method;
      } else if (meta.method === "breast") {
        breastCount += 1;
      }
      if (meta.side) lastSide ??= meta.side;
    } catch {
      /* ignore */
    }
  }

  if (nonBreastCount > breastCount) return lastNonBreast ?? "bottle";
  return (lastSide ?? "left") === "left" ? "breast-r" : "breast-l";
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

export const inferDefault = (
  type: StationActionKey,
  events: BabyEvent[]
): string => {
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

export const amountLabelFor = (event: BabyEvent): string => {
  if (event.type === "pump") return "Amount pumped";
  return parseMeta(event.metadata).method === "formula"
    ? "Formula amount"
    : "Bottle amount";
};

export interface LogRequest {
  amountMl?: number;
  finished: boolean;
  minutesAgo: number;
}

export const requestMeta = (
  meta: Record<string, unknown>,
  request: LogRequest
): Record<string, unknown> => ({
  ...meta,
  ...(request.amountMl ? { amountMl: request.amountMl } : {}),
  ...logTimes(request.minutesAgo, request.finished),
});

const WHEN_LEGEND: Record<StationActionKey, string> = {
  diaper: "Changed",
  feed: "Started",
  note: "Logged",
  pump: "Started",
  sleep: "Fell asleep",
};

const WHEN_OPTIONS = BACKDATE_MINUTES.map((minutes) => ({
  label: minutes === 0 ? "Now" : `${minutes}m`,
  value: String(minutes),
}));

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className="hidden h-5 w-5 shrink-0 text-primary-ink peer-checked:block"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
  >
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VariantRow = ({
  groupName,
  isSelected,
  onSelect,
  variant,
}: {
  groupName: string;
  isSelected: boolean;
  onSelect: (key: string) => void;
  variant: Variant;
}) => {
  const handleChange = useCallback(
    () => onSelect(variant.key),
    [onSelect, variant.key]
  );
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-5 text-base text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100 has-checked:bg-neutral-100 has-checked:font-semibold has-checked:text-neutral-800 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-primary-ink">
      <input
        checked={isSelected}
        className="peer sr-only focus-visible:outline-none"
        name={groupName}
        onChange={handleChange}
        type="radio"
        value={variant.key}
      />
      <span className="flex-1">{variant.label}</span>
      <CheckIcon />
    </label>
  );
};

export const LogSheet = ({
  type,
  selected,
  lastAmountMl: lastAmount,
  onSelect,
  onLog,
  onClose,
  startAtAmount,
}: {
  type: StationActionKey;
  selected: string;
  startAtAmount: boolean;
  lastAmountMl: number | null;
  onSelect: (key: string) => void;
  onLog: (request: LogRequest) => void;
  onClose: () => void;
}) => {
  const variantGroup = useId();
  const variants = VARIANTS_BY_TYPE[type];
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [askingAmount, setAskingAmount] = useState(startAtAmount);

  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];
  const takesAmount = methodTakesAmount(selectedVariant.meta);
  const isInstant = type === "diaper";
  const typeLabel = EVENT_TYPE_LABELS[type];

  const handleWhen = useCallback(
    (value: string) => setMinutesAgo(Number(value)),
    []
  );

  const handlePrimary = useCallback(() => {
    onLog({ finished: isInstant, minutesAgo });
  }, [isInstant, minutesAgo, onLog]);

  const handleFinished = useCallback(() => {
    if (takesAmount) {
      setAskingAmount(true);
      return;
    }
    onLog({ finished: true, minutesAgo });
  }, [minutesAgo, onLog, takesAmount]);

  const handleAmountConfirm = useCallback(
    (amountMl: number) => onLog({ amountMl, finished: true, minutesAgo }),
    [minutesAgo, onLog]
  );

  const handleAmountSkip = useCallback(
    () => onLog({ finished: true, minutesAgo }),
    [minutesAgo, onLog]
  );

  const clock =
    minutesAgo > 0
      ? new Date(Date.now() - minutesAgo * 60_000).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
  const whenLegend = clock
    ? `${WHEN_LEGEND[type]} ${minutesAgo} minutes ago, at ${clock}`
    : `${WHEN_LEGEND[type]} just now`;

  if (askingAmount) {
    return (
      <Sheet
        onClose={onClose}
        open
        title={`${selectedVariant.label}, finished`}
      >
        <div className="px-5 pb-1">
          <AmountInput
            cancelLabel="Skip amount"
            confirmLabel="Save feed"
            label={clock ? `How much? Logged at ${clock}.` : "How much?"}
            lastAmountMl={lastAmount}
            onCancel={handleAmountSkip}
            onConfirm={handleAmountConfirm}
          />
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      footer={
        <div className="flex gap-2">
          {type === "feed" && (
            <button
              className="min-h-[52px] flex-1 rounded-xl border border-neutral-300 px-3 font-medium text-neutral-700 text-sm leading-tight transition-colors hover:bg-neutral-100 active:bg-neutral-200"
              onClick={handleFinished}
              type="button"
            >
              Already finished
            </button>
          )}
          <button
            className="min-h-[52px] flex-1 rounded-xl bg-primary-500 px-3 font-semibold text-base text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] motion-reduce:active:scale-100"
            onClick={handlePrimary}
            type="button"
          >
            {isInstant ? `Log ${typeLabel.toLowerCase()}` : "Start timer"}
          </button>
        </div>
      }
      onClose={onClose}
      open
      title={typeLabel}
    >
      {variants.length > 1 && (
        <fieldset>
          <legend className="sr-only">{typeLabel} type</legend>
          {variants.map((v) => (
            <VariantRow
              groupName={variantGroup}
              isSelected={v.key === selectedVariant.key}
              key={v.key}
              onSelect={onSelect}
              variant={v}
            />
          ))}
        </fieldset>
      )}
      <div className="px-5 pt-4 pb-1">
        <ChoiceChips
          legend={whenLegend}
          onChange={handleWhen}
          options={WHEN_OPTIONS}
          value={String(minutesAgo)}
        />
      </div>
    </Sheet>
  );
};

export const VariantButton = ({
  type,
  label,
  isOpen,
  disabled = false,
  onOpen,
}: {
  type: StationActionKey;
  label: string;
  isOpen: boolean;
  disabled?: boolean;
  onOpen: () => void;
}) => (
  <button
    aria-expanded={isOpen}
    aria-haspopup="dialog"
    aria-label={`${EVENT_TYPE_LABELS[type]} options: ${label}. Change type or time`}
    className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-neutral-300 bg-surface-raised px-1.5 text-neutral-700 text-xs font-medium leading-tight transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:border-neutral-200 disabled:bg-transparent disabled:text-neutral-400"
    disabled={disabled}
    onClick={onOpen}
    type="button"
  >
    <span>{label}</span>
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);
