"use client";

import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import type { TamboComponentContent } from "@tambo-ai/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { triggerFeedback } from "@/lib/haptics";
import { useVoiceSession } from "@/lib/voice-session";

import { AudioWaveform } from "./audio-waveform";

/* ── Constants ──────────────────────────────────────────────── */

const AUTO_DISMISS_MS = 6000;
/** If no response starts within this window, show an error */
const PROCESSING_TIMEOUT_MS = 15_000;

/* ── Component ──────────────────────────────────────────────── */

export const VoiceOverlay = () => {
  const { phase, transcript, setPhase, dismiss, errorMessage, showError } =
    useVoiceSession();
  const { messages, isStreaming } = useTambo();
  const { setValue, submit } = useTamboThreadInput();

  const pendingRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Submit transcript when phase becomes "processing" ────── */

  useEffect(() => {
    if (phase !== "processing" || !transcript || pendingRef.current) return;
    pendingRef.current = true;

    setValue(transcript);

    const doSubmit = async () => {
      try {
        await submit();
        triggerFeedback("logged");
      } catch (error: unknown) {
        pendingRef.current = false;
        const msg = error instanceof Error ? error.message : String(error);
        showError(msg || "Failed to send");
      }
    };
    doSubmit();

    processingTimerRef.current = setTimeout(() => {
      if (pendingRef.current) {
        pendingRef.current = false;
        showError("No response \u2014 try again");
      }
    }, PROCESSING_TIMEOUT_MS);

    return () => {
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
        processingTimerRef.current = null;
      }
    };
  }, [phase, transcript, setValue, submit, showError]);

  /* ── Detect response completion (streaming → not streaming) ── */

  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
        processingTimerRef.current = null;
      }
    } else if (wasStreamingRef.current && phase === "processing") {
      wasStreamingRef.current = false;
      pendingRef.current = false;
      setPhase("response");
    }
  }, [isStreaming, phase, setPhase]);

  /* ── Extract last assistant response ──────────────────────── */

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const responseText = useMemo(
    () =>
      lastAssistant?.content
        .filter((b): b is { text: string; type: "text" } => b.type === "text")
        .map((b) => b.text)
        .join(" ") ?? null,
    [lastAssistant]
  );

  const responseComponents = useMemo(
    () =>
      (lastAssistant?.content.filter(
        (b): b is TamboComponentContent =>
          b.type === "component" &&
          "renderedComponent" in b &&
          Boolean((b as TamboComponentContent).renderedComponent)
      ) ?? []) as (TamboComponentContent & {
        renderedComponent: React.ReactNode;
      })[],
    [lastAssistant]
  );

  /* ── Auto-dismiss after response ──────────────────────────── */

  const handleDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    if (phase !== "response") return;

    const hasComponents = lastAssistant?.content.some(
      (b) => b.type === "component" && "renderedComponent" in b
    );
    if (hasComponents) return;

    dismissTimerRef.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [phase, handleDismiss, lastAssistant]);

  /* ── Reset pending flag on idle ───────────────────────────── */

  useEffect(() => {
    if (phase === "idle") {
      pendingRef.current = false;
      wasStreamingRef.current = false;
    }
  }, [phase]);

  /* ── Render nothing when idle ─────────────────────────────── */

  if (phase === "idle") return null;

  return (
    <div
      className="animate-fade-up fixed inset-x-0 z-30 px-3"
      style={{
        bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <button
        className="w-full rounded-xl border border-neutral-200 bg-surface-raised px-4 py-3 text-left shadow-md"
        onClick={
          phase === "response" || phase === "error" ? handleDismiss : undefined
        }
        type="button"
      >
        {/* ── Listening: waveform + live transcript ─────────── */}
        {phase === "listening" && (
          <div className="flex items-center gap-3">
            <AudioWaveform className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">
              {transcript || "Listening\u2026"}
            </span>
          </div>
        )}

        {/* ── Processing: transcript + loading dots ───────────── */}
        {phase === "processing" && (
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate text-sm text-neutral-600">
              {transcript}
            </p>
            <div className="flex gap-1">
              <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400" />
              <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:200ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:400ms]" />
            </div>
          </div>
        )}

        {/* ── Response: AI text + optional components ──────────── */}
        {phase === "response" && (
          <div className="space-y-1">
            <p className="truncate text-xs text-neutral-400">{transcript}</p>
            {responseText && (
              <p className="text-sm leading-snug text-neutral-700">
                {responseText}
              </p>
            )}
            {responseComponents.map((c) => (
              <div className="mt-1" key={c.id}>
                {c.renderedComponent}
              </div>
            ))}
          </div>
        )}

        {/* ── Error: message with warning styling ─────────────── */}
        {phase === "error" && (
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-warning-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm text-neutral-600">{errorMessage}</p>
          </div>
        )}
      </button>
    </div>
  );
};
