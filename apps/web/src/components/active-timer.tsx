"use client";

import { useCallback, useEffect, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { formatElapsed } from "@/lib/format-elapsed";
import { timerLabel } from "@/lib/format-event";
import { triggerFeedback } from "@/lib/haptics";

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const useElapsed = (startedAt: string): number => {
  const [elapsed, setElapsed] = useState(
    () => Date.now() - new Date(startedAt).getTime()
  );

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
};

const HOUR_MS = 3_600_000;

export const ActiveTimer = ({
  event,
  onStop,
  onDiscard,
  layout = "card",
}: {
  event: BabyEvent;
  onStop: (event: BabyEvent) => void;
  onDiscard: (event: BabyEvent) => void;
  layout?: "card" | "compact" | "tile";
}) => {
  const elapsed = useElapsed(event.startedAt);

  const handleStop = useCallback(() => {
    triggerFeedback("logged");
    onStop(event);
  }, [onStop, event]);

  const handleDiscard = useCallback(() => onDiscard(event), [onDiscard, event]);

  const label = timerLabel(event);
  const style = getEventStyle(event.type);
  const isLong = elapsed >= HOUR_MS;

  const icon = (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border [&_svg]:h-5 [&_svg]:w-5 ${style.bg}`}
    >
      <EventIcon type={event.type} />
    </span>
  );
  const started = (
    <p className="mt-0.5 text-[13px] text-neutral-600">
      Started {formatClock(event.startedAt)}
    </p>
  );
  const digits = (
    <p
      className={`font-sans leading-none tabular-nums text-neutral-800 ${
        layout === "tile" || !isLong ? "text-4xl" : "text-3xl"
      }`}
      role="timer"
    >
      {formatElapsed(elapsed)}
    </p>
  );
  const discardButton = (
    <button
      aria-label={`Discard ${label} timer`}
      className="min-h-[52px] rounded-xl border border-neutral-300 px-4 font-medium text-neutral-600 text-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200"
      onClick={handleDiscard}
      type="button"
    >
      Discard
    </button>
  );
  const doneButton = (
    <button
      aria-label={`Done, ${label}`}
      className={`flex-1 rounded-xl bg-primary-500 px-4 font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] ${
        layout === "tile" ? "min-h-[64px] text-lg" : "min-h-[52px] text-base"
      }`}
      onClick={handleStop}
      type="button"
    >
      Done
    </button>
  );

  if (layout === "compact") {
    return (
      <section
        aria-label={`${label} timer`}
        className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-surface-raised py-1.5 pr-1.5 pl-3"
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border [&_svg]:h-4 [&_svg]:w-4 ${style.bg}`}
        >
          <EventIcon type={event.type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-800 text-sm leading-tight">
            {label}
          </p>
          <p
            className="text-neutral-700 text-sm tabular-nums leading-tight"
            role="timer"
          >
            {formatElapsed(elapsed)}
            <span className="text-neutral-600">
              {" "}
              · since {formatClock(event.startedAt)}
            </span>
          </p>
        </div>
        <button
          aria-label={`Done, ${label}`}
          className="min-h-[44px] shrink-0 rounded-xl bg-primary-500 px-4 font-semibold text-sm text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] motion-reduce:active:scale-100"
          onClick={handleStop}
          type="button"
        >
          Done
        </button>
        <button
          aria-label={`Discard ${label} timer`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          onClick={handleDiscard}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </section>
    );
  }

  if (layout === "tile") {
    return (
      <section
        aria-label={`${label} timer`}
        className="flex h-full flex-col items-center gap-3 text-center"
      >
        {icon}
        <div>
          <p className="font-semibold text-base text-neutral-800 leading-tight">
            {label}
          </p>
          {started}
        </div>
        <div className="flex flex-1 items-center">{digits}</div>
        <div className="flex w-full flex-col gap-2">
          {doneButton}
          {discardButton}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={`${label} timer`}
      className="rounded-2xl border border-neutral-200 bg-surface-raised p-4"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base text-neutral-800 leading-tight">
            {label}
          </p>
          {started}
        </div>
        {digits}
      </div>
      <div className="mt-4 flex gap-2">
        {discardButton}
        {doneButton}
      </div>
    </section>
  );
};
