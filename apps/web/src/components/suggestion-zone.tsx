"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import {
  eventAwaitingAmount,
  lastAmountMl,
  oneTapAction,
} from "@/lib/daily-totals";
import { EventIcon } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";

import { ActiveTimer } from "./active-timer";
import { AmountInput, useDismissedAmountPrompts } from "./amount-input";
import {
  amountLabelFor,
  inferDefault,
  LogSheet,
  requestMeta,
  VariantButton,
  VARIANTS_BY_TYPE,
} from "./log-sheet";
import type { LogRequest } from "./log-sheet";

type HomeLogType = "feed" | "sleep" | "diaper";

/* ── Styles ────────────────────────────────────────────────── */

const LOG_BUTTON_TONE: Record<HomeLogType, string> = {
  diaper:
    "border-diaper-500/60 bg-diaper-100 hover:bg-diaper-200 active:bg-diaper-200",
  feed: "border-feed-500/60 bg-feed-100 hover:bg-feed-200 active:bg-feed-200",
  sleep:
    "border-sleep-500/60 bg-sleep-100 hover:bg-sleep-200 active:bg-sleep-200",
};

const LOG_LABEL: Record<HomeLogType, { busy: string; idle: string }> = {
  diaper: { busy: "Diaper", idle: "Diaper" },
  feed: { busy: "Feeding", idle: "Feed" },
  sleep: { busy: "Asleep", idle: "Sleep" },
};

const Reveal = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] starting:grid-rows-[0fr] starting:opacity-0">
    <div className="min-h-0 overflow-hidden">
      <div className="pb-2">{children}</div>
    </div>
  </div>
);

const LogColumn = ({
  type,
  defaultVariant,
  isBusy,
  isReady,
  lastAmount,
  onLog,
}: {
  type: HomeLogType;
  defaultVariant: string;
  isBusy: boolean;
  isReady: boolean;
  lastAmount: number | null;
  onLog: (type: HomeLogType, meta: Record<string, unknown>) => void;
}) => {
  const variants = VARIANTS_BY_TYPE[type];
  const [selected, setSelected] = useState(defaultVariant);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setSelected(defaultVariant);
  }, [defaultVariant]);

  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];

  const log = useCallback(
    (request: LogRequest) => {
      onLog(type, requestMeta(selectedVariant.meta, request));
    },
    [onLog, selectedVariant, type]
  );

  const handleMainTap = useCallback(() => {
    const action = oneTapAction(type, selectedVariant.meta);
    log({ finished: action === "instant", minutesAgo: 0 });
  }, [log, selectedVariant, type]);

  const handleSheetLog = useCallback(
    (request: LogRequest) => {
      log(request);
      setSheetOpen(false);
    },
    [log]
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const disabled = !isReady || isBusy;
  const label = isBusy ? LOG_LABEL[type].busy : LOG_LABEL[type].idle;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <button
        className={`flex min-h-[112px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 shadow-sm transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] active:shadow-none disabled:border-dashed disabled:border-neutral-300 disabled:bg-transparent disabled:shadow-none disabled:active:scale-100 ${LOG_BUTTON_TONE[type]}`}
        disabled={disabled}
        onClick={handleMainTap}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`[&_svg]:h-8 [&_svg]:w-8 ${disabled ? "opacity-50" : ""}`}
        >
          <EventIcon type={type} />
        </span>
        <span
          className={`font-semibold text-base leading-tight ${disabled ? "text-neutral-400" : "text-neutral-800"}`}
        >
          {label}
        </span>
      </button>
      <VariantButton
        disabled={disabled}
        isOpen={sheetOpen}
        label={selectedVariant.label}
        onOpen={openSheet}
        type={type}
      />
      {sheetOpen && (
        <LogSheet
          lastAmountMl={lastAmount}
          onClose={closeSheet}
          onLog={handleSheetLog}
          onSelect={setSelected}
          selected={selected}
          type={type}
        />
      )}
    </div>
  );
};

/* ── SuggestionZone ────────────────────────────────────────── */

const HOME_TIMER_TYPES = new Set(["feed", "sleep"]);

export const SuggestionZone = () => {
  const {
    events,
    canLog,
    activeEvents,
    completeAmount,
    discardEvent,
    logEventDirect,
    stopEvent,
  } = useBabyContext();
  const { dismissed, dismiss } = useDismissedAmountPrompts();

  const feedDefault = useMemo(() => inferDefault("feed", events), [events]);
  const diaperDefault = useMemo(() => inferDefault("diaper", events), [events]);
  const sleepDefault = useMemo(() => inferDefault("sleep", events), [events]);
  const lastFeedAmount = useMemo(() => lastAmountMl(events, "feed"), [events]);

  const timers = useMemo(
    () =>
      activeEvents
        .filter((e) => HOME_TIMER_TYPES.has(e.type))
        .toSorted(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        ),
    [activeEvents]
  );
  const isFeeding = timers.some((e) => e.type === "feed");
  const isAsleep = timers.some((e) => e.type === "sleep");

  const awaitingAmount = eventAwaitingAmount(
    events,
    "feed",
    Date.now(),
    dismissed
  );

  const handleLog = useCallback(
    (type: HomeLogType, meta: Record<string, unknown>) => {
      triggerFeedback("logged");
      logEventDirect(type, meta);
    },
    [logEventDirect]
  );

  const handleStop = useCallback(
    (event: BabyEvent) => {
      stopEvent(event.id);
    },
    [stopEvent]
  );

  const handleDiscard = useCallback(
    (event: BabyEvent) => discardEvent(event.id),
    [discardEvent]
  );

  const handleAmountConfirm = useCallback(
    (amountMl: number) => {
      if (!awaitingAmount) return;
      completeAmount(awaitingAmount.id, amountMl);
      dismiss(awaitingAmount.id);
    },
    [awaitingAmount, completeAmount, dismiss]
  );

  const handleAmountSkip = useCallback(() => {
    if (!awaitingAmount) return;
    completeAmount(awaitingAmount.id, null);
    dismiss(awaitingAmount.id);
  }, [awaitingAmount, completeAmount, dismiss]);

  return (
    <section aria-labelledby="log-activity-heading">
      <div className="px-4">
        {timers.map((event, index) => (
          <Reveal key={event.id}>
            <ActiveTimer
              event={event}
              layout={index === 0 ? "card" : "compact"}
              onDiscard={handleDiscard}
              onStop={handleStop}
            />
          </Reveal>
        ))}
        {awaitingAmount && (
          <Reveal key={`amount-${awaitingAmount.id}`}>
            <div className="rounded-2xl border border-neutral-200 bg-surface-raised p-4">
              <AmountInput
                label={amountLabelFor(awaitingAmount)}
                lastAmountMl={lastFeedAmount}
                onCancel={handleAmountSkip}
                onConfirm={handleAmountConfirm}
              />
            </div>
          </Reveal>
        )}
      </div>

      <h2
        className="px-4 pt-2 text-center font-serif text-lg text-neutral-600 italic"
        id="log-activity-heading"
      >
        Log Activity
      </h2>

      <div className="mt-3 grid grid-cols-3 gap-2 px-4">
        <LogColumn
          defaultVariant={feedDefault}
          isBusy={isFeeding}
          isReady={canLog}
          lastAmount={lastFeedAmount}
          onLog={handleLog}
          type="feed"
        />
        <LogColumn
          defaultVariant={sleepDefault}
          isBusy={isAsleep}
          isReady={canLog}
          lastAmount={null}
          onLog={handleLog}
          type="sleep"
        />
        <LogColumn
          defaultVariant={diaperDefault}
          isBusy={false}
          isReady={canLog}
          lastAmount={null}
          onLog={handleLog}
          type="diaper"
        />
      </div>
    </section>
  );
};
