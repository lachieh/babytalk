"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { useVolumeUnit } from "@/lib/use-volume-unit";
import type { VolumeUnit } from "@/lib/use-volume-unit";

import { AmountSlider } from "./slider-field";

const DISMISSED_KEY = "bubsie_amount_prompts_skipped";
const DISMISSED_LIMIT = 30;
const NONE_DISMISSED: ReadonlySet<string> = new Set();

let dismissedIds: ReadonlySet<string> | null = null;
let dismissedListeners: (() => void)[] = [];

function readDismissed(): ReadonlySet<string> {
  if (dismissedIds) return dismissedIds;
  let stored: string[] = [];
  try {
    const raw: unknown = JSON.parse(
      window.sessionStorage.getItem(DISMISSED_KEY) ?? "[]"
    );
    if (Array.isArray(raw)) {
      stored = raw.filter((id): id is string => typeof id === "string");
    }
  } catch {
    /* storage unavailable: prompts simply are not remembered */
  }
  dismissedIds = new Set(stored);
  return dismissedIds;
}

function subscribeDismissed(listener: () => void) {
  dismissedListeners = [...dismissedListeners, listener];
  return () => {
    dismissedListeners = dismissedListeners.filter((l) => l !== listener);
  };
}

function dismissAmountPrompt(id: string) {
  const next = [...readDismissed(), id].slice(-DISMISSED_LIMIT);
  dismissedIds = new Set(next);
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  for (const listener of dismissedListeners) listener();
}

const serverDismissed = () => NONE_DISMISSED;

export function useDismissedAmountPrompts() {
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    serverDismissed
  );
  return { dismiss: dismissAmountPrompt, dismissed } as const;
}

const UNIT_NAMES: Record<VolumeUnit, string> = {
  ml: "millilitres",
  oz: "ounces",
};

const UnitButton = ({
  current,
  onSelect,
  unit,
}: {
  current: VolumeUnit;
  onSelect: (unit: VolumeUnit) => void;
  unit: VolumeUnit;
}) => {
  const handleClick = useCallback(() => onSelect(unit), [onSelect, unit]);
  const isOn = current === unit;
  return (
    <button
      aria-label={UNIT_NAMES[unit]}
      aria-pressed={isOn}
      className={`min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm transition-colors ${
        isOn
          ? "bg-primary-500 font-semibold text-white"
          : "font-medium text-neutral-600 hover:bg-neutral-100"
      }`}
      onClick={handleClick}
      type="button"
    >
      {unit}
    </button>
  );
};

export const AmountInput = ({
  onConfirm,
  onCancel,
  label,
  lastAmountMl,
  confirmLabel = "Save",
  cancelLabel = "Skip",
}: {
  onConfirm: (amountMl: number) => void;
  onCancel: () => void;
  label: string;
  lastAmountMl: number | null;
  confirmLabel?: string;
  cancelLabel?: string;
}) => {
  const { unit: preferredUnit } = useVolumeUnit();
  const [unit, setUnit] = useState<VolumeUnit>(preferredUnit);
  const [amountMl, setAmountMl] = useState<number | undefined>(
    lastAmountMl ?? undefined
  );

  const handleConfirm = useCallback(() => {
    if (amountMl) onConfirm(amountMl);
  }, [amountMl, onConfirm]);

  return (
    <div className="flex flex-col gap-3">
      <AmountSlider
        amountMl={amountMl}
        legend={label}
        onChange={setAmountMl}
        unit={unit}
      />
      <div
        aria-label="Unit"
        className="flex shrink-0 self-start gap-0.5 rounded-xl border border-neutral-300 p-0.5"
        role="group"
      >
        <UnitButton current={unit} onSelect={setUnit} unit="oz" />
        <UnitButton current={unit} onSelect={setUnit} unit="ml" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-[48px] flex-1 rounded-xl border border-neutral-300 px-4 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className="min-h-[48px] flex-[2] rounded-xl bg-primary-500 px-4 font-semibold text-base text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-500 disabled:active:scale-100"
          disabled={!amountMl}
          onClick={handleConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};
