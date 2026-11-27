"use client";

import { usePathname } from "next/navigation";
import {
  Suspense,
  ViewTransition,
  useCallback,
  useMemo,
  useState,
} from "react";

import { EventEditSheet } from "@/components/event-edit-sheet";
import type { BabyEvent } from "@/lib/baby-context";
import { pageEnter, pageExit } from "@/lib/page-transition";

import { HistorySheetContext } from "./_context";
import { HistoryTabs, historyTabFor } from "./tabs";

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openEdit = useCallback((event: BabyEvent) => {
    setEditingEvent(event);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const openAdd = useCallback(() => {
    setEditingEvent(null);
    setIsNew(true);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetOpen(false);
    setEditingEvent(null);
    setIsNew(false);
  }, []);

  const ctxValue = useMemo(() => ({ openAdd, openEdit }), [openEdit, openAdd]);

  return (
    <HistorySheetContext.Provider value={ctxValue}>
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <HistoryTabs />

        <ViewTransition
          default="none"
          enter={pageEnter}
          exit={pageExit}
          key={historyTabFor(pathname)}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <Suspense>{children}</Suspense>
          </div>
        </ViewTransition>
      </div>

      <EventEditSheet
        event={isNew ? null : editingEvent}
        onClose={handleClose}
        open={sheetOpen}
      />
    </HistorySheetContext.Provider>
  );
}
