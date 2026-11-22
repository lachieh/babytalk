"use client";

import { useCallback } from "react";

const SIDES = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "both", label: "Both" },
] as const;
type Side = (typeof SIDES)[number]["key"];

const SideButton = ({
  disabled,
  label,
  onStart,
  side,
}: {
  disabled: boolean;
  label: string;
  onStart: (side: Side) => void;
  side: Side;
}) => {
  const handleClick = useCallback(() => onStart(side), [onStart, side]);
  return (
    <button
      aria-label={
        side === "both"
          ? "Start pumping, both sides"
          : `Start pumping, ${side} side`
      }
      className="flex min-h-[72px] flex-col items-center justify-center rounded-2xl border-2 border-pump-500/60 bg-pump-100 px-2 font-semibold text-base text-neutral-800 shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-pump-200 active:scale-[0.97] active:bg-pump-200 active:shadow-none disabled:border-dashed disabled:border-neutral-300 disabled:bg-transparent disabled:text-neutral-400 disabled:shadow-none disabled:active:scale-100"
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
};

export const PumpStartSegments = ({
  disabled = false,
  onStart,
}: {
  disabled?: boolean;
  onStart: (side: Side) => void;
}) => (
  <div className="grid grid-cols-3 gap-2">
    {SIDES.map(({ key, label }) => (
      <SideButton
        disabled={disabled}
        key={key}
        label={label}
        onStart={onStart}
        side={key}
      />
    ))}
  </div>
);
