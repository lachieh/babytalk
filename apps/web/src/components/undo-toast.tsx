"use client";

import { useCallback, useEffect, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";

export const UndoToast = () => {
  const { undoableAction, dismissUndo, deleteEvent } = useBabyContext();
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!undoableAction) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setProgress(100);

    const interval = setInterval(() => {
      const remaining = undoableAction.expiresAt - Date.now();
      if (remaining <= 0) {
        setVisible(false);
        clearInterval(interval);
        return;
      }
      setProgress((remaining / 5000) * 100);
    }, 50);

    return () => clearInterval(interval);
  }, [undoableAction]);

  const handleUndo = useCallback(() => {
    if (!undoableAction) return;
    triggerFeedback("logged");
    deleteEvent(undoableAction.eventId);
    dismissUndo();
  }, [undoableAction, deleteEvent, dismissUndo]);

  if (!visible || !undoableAction) return null;

  return (
    <div className="animate-fade-up fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-surface-raised shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <EventIcon type={undoableAction.label} />
          <span className="flex-1 text-sm font-medium capitalize text-neutral-700">
            {undoableAction.label} logged
          </span>
          <button
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-50 active:scale-[0.96]"
            onClick={handleUndo}
            type="button"
          >
            Undo
          </button>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-primary-100 w-full">
          <div
            className="h-full bg-primary-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
