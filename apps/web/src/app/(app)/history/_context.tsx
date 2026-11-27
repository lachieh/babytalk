"use client";

import { createContext, useContext } from "react";

import type { BabyEvent } from "@/lib/baby-context";

interface HistorySheetContextValue {
  openEdit: (event: BabyEvent) => void;
  openAdd: () => void;
}

export const HistorySheetContext =
  createContext<HistorySheetContextValue | null>(null);

export const useHistorySheet = (): HistorySheetContextValue => {
  const ctx = useContext(HistorySheetContext);
  if (!ctx) {
    throw new Error("useHistorySheet must be used within HistorySheetProvider");
  }
  return ctx;
};

export const AddPastEntryButton = () => {
  const { openAdd } = useHistorySheet();
  return (
    <button
      className="mx-4 mb-3 flex min-h-[44px] w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-neutral-200 border-dashed px-4 py-3 font-medium text-neutral-500 text-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
      onClick={openAdd}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Add past entry
    </button>
  );
};
