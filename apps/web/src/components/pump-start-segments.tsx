"use client";

import { useCallback } from "react";

const SIDES = ["left", "right", "both"] as const;
type Side = (typeof SIDES)[number];

const SegmentButton = ({
  highlighted,
  isFirst,
  onStart,
  side,
}: {
  highlighted: boolean;
  isFirst: boolean;
  onStart: (side: Side) => void;
  side: Side;
}) => {
  const handleClick = useCallback(() => onStart(side), [onStart, side]);
  return (
    <button
      className={`relative min-h-[56px] flex-1 px-3 py-3 text-white transition-[background-color,transform] active:scale-[0.98] hover:bg-pump-600 ${
        highlighted ? "bg-pump-600" : "bg-pump-500"
      } ${isFirst ? "" : "border-l border-pump-400/50"}`}
      onClick={handleClick}
      type="button"
    >
      <span className="block text-[10px] font-medium uppercase tracking-widest opacity-80">
        Start
      </span>
      <span className="block text-base font-semibold capitalize">{side}</span>
    </button>
  );
};

export const PumpStartSegments = ({
  highlightSide,
  onStart,
}: {
  highlightSide?: Side | null;
  onStart: (side: Side) => void;
}) => (
  <div className="flex w-full overflow-hidden rounded-xl shadow-sm">
    {SIDES.map((side, idx) => (
      <SegmentButton
        highlighted={highlightSide === side}
        isFirst={idx === 0}
        key={side}
        onStart={onStart}
        side={side}
      />
    ))}
  </div>
);
