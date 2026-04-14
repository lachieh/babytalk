"use client";

import { useCallback, useEffect, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export const ActiveTimer = ({
  event,
  onStop,
  onCancel,
}: {
  event: BabyEvent;
  onStop: (id: string) => void;
  onCancel: (id: string) => void;
}) => {
  const [elapsed, setElapsed] = useState(
    () => Date.now() - new Date(event.startedAt).getTime()
  );

  useEffect(() => {
    const start = new Date(event.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event.startedAt]);

  const handleStop = useCallback(() => {
    triggerFeedback("logged");
    onStop(event.id);
  }, [onStop, event.id]);

  const handleCancel = useCallback(
    () => onCancel(event.id),
    [onCancel, event.id]
  );

  let label = event.type;
  try {
    const meta = JSON.parse(event.metadata);
    if (event.type === "feed" && meta.side) {
      label = `${meta.side} side`;
    }
    if (event.type === "sleep" && meta.location) {
      label = meta.location;
    }
    if (event.type === "pump" && meta.side) {
      label = `${meta.side} side`;
    }
  } catch {
    /* ignore */
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-xl font-bold tabular-nums text-neutral-800">
        {formatTimer(elapsed)}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
      <button
        className="min-h-[44px] w-full rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] active:scale-[0.96]"
        onClick={handleStop}
        type="button"
      >
        Done
      </button>
      <button
        className="min-h-[36px] px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
        onClick={handleCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
};
