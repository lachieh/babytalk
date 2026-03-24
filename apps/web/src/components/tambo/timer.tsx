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

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">
            {typeLabels[type] ?? type} Timer
          </p>
          <p className="font-mono text-2xl font-bold text-blue-800">
            {formatElapsed(elapsed)}
          </p>
        </div>
        {running && (
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleStop}
            type="button"
          >
            Stop
          </button>
        )}
        {!running && (
          <span className="text-sm font-medium text-gray-500">Stopped</span>
        )}
      </div>
    </div>
  );
};
