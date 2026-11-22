"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { floatingBottom } from "@/components/sync-status";
import { UNDO_DURATION, useBabyContext } from "@/lib/baby-context";
import { EventIcon } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";
import { buildToastCopy } from "@/lib/toast-copy";
import { useVolumeUnit } from "@/lib/use-volume-unit";

export const UndoToast = () => {
  const pathname = usePathname();
  const { undoableAction, undo } = useBabyContext();
  const { unit } = useVolumeUnit();
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
      setProgress((remaining / UNDO_DURATION) * 100);
    }, 50);

    return () => clearInterval(interval);
  }, [undoableAction]);

  const handleUndo = useCallback(() => {
    if (!undoableAction) return;
    triggerFeedback("logged");
    undo();
  }, [undoableAction, undo]);

  const action = visible ? undoableAction : null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 z-50 mx-auto max-w-sm"
      role="status"
      style={{ bottom: floatingBottom(pathname) }}
    >
      {action ? (
        <div className="animate-fade-up pointer-events-auto relative overflow-hidden rounded-xl border border-neutral-200 bg-surface-raised shadow-lg">
          <div className="flex min-h-14 items-center gap-3 py-1.5 pl-4 pr-1.5">
            <EventIcon type={action.label} />
            <span className="flex-1 font-medium text-neutral-700 text-sm">
              {buildToastCopy(action.event, action.phase, unit)}
            </span>
            {action.canUndo ? (
              <button
                className="min-h-[44px] rounded-lg px-4 py-2 font-semibold text-primary-ink text-sm transition-colors hover:bg-primary-50 active:scale-[0.96] motion-reduce:active:scale-100"
                onClick={handleUndo}
                type="button"
              >
                Undo
              </button>
            ) : null}
          </div>
          <div className="absolute bottom-0 left-0 h-0.5 w-full bg-primary-100">
            <div
              className="h-full bg-primary-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
