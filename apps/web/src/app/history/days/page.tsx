"use client";

import { useMemo } from "react";

import { DaysRecap } from "@/components/days-recap";
import { useBabyContext } from "@/lib/baby-context";

import { useHistorySheet } from "../_context";

export default function HistoryDaysPage() {
  const { events, loading } = useBabyContext();
  const { openAdd } = useHistorySheet();

  const nonPumpEvents = useMemo(
    () => events.filter((e) => e.type !== "pump"),
    [events]
  );

  if (loading) return null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <button
        className="mx-4 mb-3 flex min-h-[44px] w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-neutral-200 border-dashed px-4 py-3 font-medium text-neutral-500 text-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
        onClick={openAdd}
        type="button"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            d="M12 4v16m8-8H4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Add past entry
      </button>
      <DaysRecap events={nonPumpEvents} />
    </div>
  );
}
