"use client";

import { useCallback, useState } from "react";

import { useVolumeUnit, displayToMl } from "@/lib/use-volume-unit";
import type { VolumeUnit } from "@/lib/use-volume-unit";

export const AmountInput = ({
  onConfirm,
  onCancel,
  confirmLabel = "Log",
  cancelLabel = "Cancel",
}: {
  onConfirm: (amountMl: number) => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) => {
  const { unit: preferredUnit } = useVolumeUnit();
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<VolumeUnit>(preferredUnit);

  const handleConfirm = useCallback(() => {
    const val = Number(amount);
    if (val <= 0) return;
    onConfirm(displayToMl(val, unit));
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
          step="0.01"
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
        {confirmLabel}
      </button>
      <button
        className="min-h-[36px] px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={onCancel}
        type="button"
      >
        {cancelLabel}
      </button>
    </div>
  );
};
