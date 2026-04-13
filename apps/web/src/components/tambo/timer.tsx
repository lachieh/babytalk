"use client";

import { useTamboComponentState, useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useState } from "react";

import { getEventStyle } from "@/lib/event-styles";

interface TimerProps {
  eventId?: string;
  startTime: string;
  type: string;
}

const typeLabels: Record<string, string> = {
  feed: "Feed",
  sleep: "Nap",
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

  const style = getEventStyle(type);

  return (
    <div className={`animate-fade-up rounded-lg border-2 p-4 ${style.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${style.iconColor}`}>
            {typeLabels[type] ?? type} Timer
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-neutral-800">
            {formatElapsed(elapsed)}
          </p>
        </div>
        {running ? (
          <button
            className="min-h-[44px] rounded-md bg-primary-500 px-6 py-2 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.96]"
            onClick={handleStop}
            type="button"
          >
            Stop
          </button>
        ) : (
          <span className="text-sm font-medium text-neutral-400">Stopped</span>
        )}
      </div>
    </div>
  );
};
