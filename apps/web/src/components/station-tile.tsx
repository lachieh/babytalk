"use client";

import { useCallback, useEffect, useState } from "react";

import { ActiveTimer } from "@/components/active-timer";
import {
  AmountInput,
  useDismissedAmountPrompts,
} from "@/components/amount-input";
import {
  amountLabelFor,
  inferDefault,
  LogSheet,
  requestMeta,
  VariantButton,
  VARIANTS_BY_TYPE,
} from "@/components/log-sheet";
import type { LogRequest } from "@/components/log-sheet";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import {
  eventAwaitingAmount,
  lastAmountMl,
  oneTapAction,
} from "@/lib/daily-totals";
import { EVENT_TYPE_LABELS } from "@/lib/event-meta";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { triggerFeedback } from "@/lib/haptics";
import type { StationActionKey } from "@/lib/station-config";

type LocalPhase = "idle" | "picking" | "amount" | "note";

const panelClass =
  "flex h-full flex-col rounded-3xl border-2 border-neutral-200 bg-surface-raised p-4";

export const StationTile = ({ type }: { type: StationActionKey }) => {
  const {
    baby,
    events,
    activeEvents,
    completeAmount,
    discardEvent,
    logEventDirect,
    stopEvent,
  } = useBabyContext();
  const { dismissed, dismiss } = useDismissedAmountPrompts();

  const [phase, setPhase] = useState<LocalPhase>("idle");
  const [selected, setSelected] = useState<string>(() =>
    inferDefault(type, events)
  );
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    setSelected(inferDefault(type, events));
  }, [type, events]);

  const variants = VARIANTS_BY_TYPE[type];
  const selectedVariant =
    variants.find((v) => v.key === selected) ?? variants[0];

  const activeEvent =
    type === "diaper" || type === "note"
      ? null
      : (activeEvents.find((e) => e.type === type) ?? null);

  const awaitingAmount =
    type === "feed" || type === "pump"
      ? eventAwaitingAmount(events, type, Date.now(), dismissed)
      : null;

  const style = getEventStyle(type);
  const typeLabel = EVENT_TYPE_LABELS[type];
  const isReady = baby !== null;

  const handleLog = useCallback(
    (meta: Record<string, unknown>, request: LogRequest) => {
      triggerFeedback("logged");
      logEventDirect(type, requestMeta(meta, request));
    },
    [type, logEventDirect]
  );

  const handleMainTap = useCallback(() => {
    if (type === "note") {
      setNoteText("");
      setPhase("note");
      return;
    }
    const action = oneTapAction(type, selectedVariant.meta);
    if (action === "amount") {
      setPhase("amount");
      return;
    }
    handleLog(selectedVariant.meta, {
      finished: action === "instant",
      minutesAgo: 0,
    });
  }, [type, selectedVariant, handleLog]);

  const handleSheetLog = useCallback(
    (request: LogRequest) => {
      handleLog(selectedVariant.meta, request);
      setPhase("idle");
    },
    [handleLog, selectedVariant]
  );

  const handleTimerStop = useCallback(
    (event: BabyEvent) => {
      stopEvent(event.id);
    },
    [stopEvent]
  );

  const handleTimerDiscard = useCallback(
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

  const handleNoteCancel = useCallback(() => setPhase("idle"), []);

  const handleNoteSubmit = useCallback(() => {
    if (!noteText.trim()) {
      setPhase("idle");
      return;
    }
    handleLog({ text: noteText.trim() }, { finished: true, minutesAgo: 0 });
    setNoteText("");
    setPhase("idle");
  }, [noteText, handleLog]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value),
    []
  );

  const handlePickerOpen = useCallback(() => setPhase("picking"), []);
  const handlePickerClose = useCallback(() => setPhase("idle"), []);

  if (activeEvent) {
    return (
      <article className={panelClass}>
        <ActiveTimer
          event={activeEvent}
          layout="tile"
          onDiscard={handleTimerDiscard}
          onStop={handleTimerStop}
        />
      </article>
    );
  }

  if (awaitingAmount) {
    return (
      <article className={`${panelClass} justify-center`}>
        <AmountInput
          label={amountLabelFor(awaitingAmount)}
          lastAmountMl={lastAmountMl(events, type === "pump" ? "pump" : "feed")}
          onCancel={handleAmountSkip}
          onConfirm={handleAmountConfirm}
        />
      </article>
    );
  }

  if (phase === "note") {
    return (
      <article className={panelClass}>
        <label
          className="mb-2 text-center font-medium text-neutral-700 text-sm"
          htmlFor="station-note-text"
        >
          Quick note
        </label>
        <textarea
          autoFocus
          className="min-h-[96px] flex-1 rounded-xl border border-neutral-300 bg-surface px-3 py-2 text-base text-neutral-800 caret-primary-ink placeholder:text-neutral-500"
          id="station-note-text"
          onChange={handleNoteChange}
          placeholder="Anything to remember"
          value={noteText}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="min-h-[48px] flex-1 rounded-xl border border-neutral-300 px-4 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200"
            onClick={handleNoteCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-[48px] flex-[2] rounded-xl bg-primary-500 px-4 font-semibold text-sm text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-500 disabled:active:scale-100"
            disabled={!noteText.trim()}
            onClick={handleNoteSubmit}
            type="button"
          >
            Save note
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex h-full flex-col gap-2">
      <button
        className={`flex min-h-[96px] flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-2 px-4 py-6 text-center transition-[background-color,transform] active:scale-[0.97] disabled:border-neutral-200 disabled:bg-transparent disabled:active:scale-100 ${style.buttonBg}`}
        disabled={!isReady}
        onClick={handleMainTap}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`[&_svg]:h-10 [&_svg]:w-10 ${isReady ? "" : "opacity-40"}`}
        >
          <EventIcon type={type} />
        </span>
        <span
          className={`font-semibold text-lg tracking-wide ${isReady ? "text-neutral-800" : "text-neutral-400"}`}
        >
          {typeLabel}
        </span>
      </button>
      {variants.length > 1 && (
        <VariantButton
          disabled={!isReady}
          isOpen={phase === "picking"}
          label={selectedVariant.label}
          onOpen={handlePickerOpen}
          type={type}
        />
      )}
      {(phase === "picking" || phase === "amount") && (
        <LogSheet
          lastAmountMl={type === "feed" ? lastAmountMl(events, "feed") : null}
          onClose={handlePickerClose}
          onLog={handleSheetLog}
          onSelect={setSelected}
          selected={selected}
          startAtAmount={phase === "amount"}
          type={type}
        />
      )}
    </article>
  );
};
