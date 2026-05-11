"use client";

import { useCallback } from "react";

import type { PumpHint } from "@/lib/pump-hint-bus";

export const PumpHintCard = ({
  hint,
  onRefresh,
  refreshing = false,
}: {
  hint: PumpHint | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) => {
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    onRefresh?.();
  }, [onRefresh, refreshing]);

  if (!(hint || onRefresh)) return null;

  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-pump-100 bg-pump-50/60 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-pump-500"
        />
        <p className="flex-1 text-sm leading-snug text-neutral-700">
          {hint?.hint ?? "Tap refresh for a personalized tip."}
        </p>
        {onRefresh && (
          <button
            aria-label="Refresh hint"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-pump-500 transition-colors hover:bg-pump-100 disabled:opacity-40"
            disabled={refreshing}
            onClick={handleRefresh}
            type="button"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0013.803 3.7l3.181-3.181M2.985 9.348L6.166 6.166a8.25 8.25 0 0113.803 3.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
