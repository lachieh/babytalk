"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";

import { amountChips, displayToMl, useVolumeUnit } from "@/lib/use-volume-unit";
import type { VolumeUnit } from "@/lib/use-volume-unit";

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

const AmountChip = ({
  isSelected,
  onSelect,
  unit,
  value,
}: {
  isSelected: boolean;
  onSelect: (value: number) => void;
  unit: VolumeUnit;
  value: number;
}) => {
  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <button
      aria-label={`${value} ${UNIT_NAMES[unit]}`}
      aria-pressed={isSelected}
      className={`min-h-[48px] rounded-xl border-2 px-2 text-base tabular-nums transition-[background-color,border-color,transform] active:scale-[0.97] ${
        isSelected
          ? "border-primary-ink bg-primary-100 font-semibold text-neutral-800"
          : "border-neutral-200 bg-surface font-medium text-neutral-700 hover:bg-neutral-100"
      }`}
      onClick={handleClick}
      type="button"
    >
      {value} <span className="text-sm">{unit}</span>
    </button>
  );
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
  const fieldId = useId();
  const { unit: preferredUnit } = useVolumeUnit();
  const [unit, setUnit] = useState<VolumeUnit>(preferredUnit);
  const [amount, setAmount] = useState(() =>
    lastAmountMl ? String(amountChips(lastAmountMl, preferredUnit)[1]) : ""
  );

  const chips = amountChips(lastAmountMl, unit);
  const numericAmount = Number(amount);
  const isValid = amount !== "" && numericAmount > 0;

  const handleConfirm = useCallback(() => {
    const value = Number(amount);
    if (!(value > 0)) return;
    onConfirm(displayToMl(value, unit));
  }, [amount, unit, onConfirm]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value),
    []
  );

  const handleChip = useCallback(
    (value: number) => setAmount(String(value)),
    []
  );

  const handleUnit = useCallback(
    (next: VolumeUnit) => {
      if (next === unit) return;
      const pickedIndex = amountChips(lastAmountMl, unit).indexOf(
        Number(amount)
      );
      if (pickedIndex !== -1) {
        setAmount(String(amountChips(lastAmountMl, next)[pickedIndex]));
      }
      setUnit(next);
    },
    [amount, lastAmountMl, unit]
  );

  return (
    <div className="flex flex-col gap-3">
      <label className="font-medium text-neutral-700 text-sm" htmlFor={fieldId}>
        {label}
      </label>

      <div
        aria-label="Quick amounts"
        className="grid grid-cols-3 gap-2"
        role="group"
      >
        {chips.map((value) => (
          <AmountChip
            isSelected={isValid && numericAmount === value}
            key={value}
            onSelect={handleChip}
            unit={unit}
            value={value}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-h-[48px] min-w-[6rem] flex-1 rounded-xl border border-neutral-300 bg-surface px-3 text-base tabular-nums text-neutral-800 caret-primary-ink placeholder:text-neutral-500"
          id={fieldId}
          inputMode="decimal"
          min="0"
          onChange={handleChange}
          placeholder="Other amount"
          step="any"
          type="number"
          value={amount}
        />
        <div
          aria-label="Unit"
          className="flex shrink-0 gap-0.5 rounded-xl border border-neutral-300 p-0.5"
          role="group"
        >
          <UnitButton current={unit} onSelect={handleUnit} unit="oz" />
          <UnitButton current={unit} onSelect={handleUnit} unit="ml" />
        </div>
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
          disabled={!isValid}
          onClick={handleConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};
