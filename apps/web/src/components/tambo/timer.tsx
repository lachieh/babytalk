"use client";

import { useTamboComponentState, useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useState } from "react";

interface TimerProps {
  eventId?: string;
  startTime: string;
  type: string;
}

const typeLabels: Record<string, string> = {
  feed: "Feed",
  sleep: "Nap",
};

const typeColors: Record<
  string,
  { border: string; bg: string; text: string; btn: string }
> = {
  feed: {
    bg: "bg-feed-50",
    border: "border-feed-200",
    btn: "bg-feed-500 hover:bg-feed-600",
    text: "text-feed-600",
  },
  sleep: {
    bg: "bg-sleep-50",
    border: "border-sleep-200",
    btn: "bg-sleep-500 hover:bg-sleep-600",
    text: "text-sleep-600",
  },
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

export const Timer = ({ eventId, startTime, type }: TimerProps) => {
  const [running, setRunning] = useTamboComponentState("running", true);
  const [elapsed, setElapsed] = useState(0);
  const { setValue, submit } = useTamboThreadInput();

  useEffect(() => {
    if (!running) return;

    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running, startTime]);

  const handleStop = useCallback(() => {
    setRunning(false);
    if (eventId) {
      setValue(`stop the ${type} timer for event ${eventId}`);
      submit();
    }
  }, [setRunning, setValue, submit, eventId, type]);

  const colors = typeColors[type] ?? typeColors.feed;

  return (
    <div
      className={`animate-fade-up rounded-radius-lg border-2 p-spacing-lg ${colors.border} ${colors.bg}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`text-[var(--font-size-sm)] font-medium ${colors.text}`}
          >
            {typeLabels[type] ?? type} Timer
          </p>
          <p className="mt-spacing-xs font-mono text-[var(--font-size-2xl)] font-bold tabular-nums text-neutral-800">
            {formatElapsed(elapsed)}
          </p>
        </div>
        {running ? (
          <button
            className={`min-h-[44px] rounded-radius-md px-spacing-xl py-spacing-sm text-[var(--font-size-sm)] font-medium text-white transition-[background-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] active:scale-[0.96] ${colors.btn}`}
            onClick={handleStop}
            type="button"
          >
            Stop
          </button>
        ) : (
          <span className="text-[var(--font-size-sm)] font-medium text-neutral-400">
            Stopped
          </span>
        )}
      </div>
    </div>
  );
};
