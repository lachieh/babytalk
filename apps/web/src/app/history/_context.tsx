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
