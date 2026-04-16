"use client";

import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import type { TamboComponentContent } from "@tambo-ai/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { triggerFeedback } from "@/lib/haptics";
import { useVoiceSession } from "@/lib/voice-session";

import { AudioWaveform } from "./audio-waveform";

/* ── Constants ──────────────────────────────────────────────── */

/** 5 minutes */
const THREAD_TIMEOUT = 5 * 60 * 1000;
const AUTO_DISMISS_MS = 6000;
const THREAD_KEY = "babytalk_voice_thread";

/* ── Thread persistence ─────────────────────────────────────── */

function loadThread(): { id: string; lastUsed: number } | null {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveThread(id: string) {
  localStorage.setItem(
    THREAD_KEY,
    JSON.stringify({ id, lastUsed: Date.now() })
  );
}

/* ── Component ──────────────────────────────────────────────── */

export const VoiceOverlay = () => {
  const { phase, transcript, analyser, setPhase, dismiss } = useVoiceSession();
  const {
    messages,
    isStreaming,
    startNewThread,
    switchThread,
    currentThreadId,
  } = useTambo();
  const { setValue, submit } = useTamboThreadInput();

  const pendingRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Thread lifecycle: reuse within 5 min ─────────────────── */

  const ensureThread = useCallback(() => {
    const saved = loadThread();
    if (saved && Date.now() - saved.lastUsed < THREAD_TIMEOUT) {
      if (saved.id !== currentThreadId) switchThread(saved.id);
      saveThread(saved.id);
    } else {
      const newId = startNewThread();
      saveThread(newId);
    }
  }, [startNewThread, switchThread, currentThreadId]);

  /* ── Submit transcript when phase becomes "processing" ────── */

  useEffect(() => {
    if (phase !== "processing" || !transcript || pendingRef.current) return;
    pendingRef.current = true;
    ensureThread();

    // Use requestAnimationFrame to let thread switch propagate
    requestAnimationFrame(() => {
      setValue(transcript);
      submit();
      triggerFeedback("logged");
    });
  }, [phase, transcript, ensureThread, setValue, submit]);

  /* ── Detect response completion (streaming → not streaming) ── */

  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
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

    // Don't auto-dismiss if there are rendered components (Timer, etc.)
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
        onClick={phase === "response" ? handleDismiss : undefined}
        type="button"
      >
        {/* ── Listening: waveform ─────────────────────────────── */}
        {phase === "listening" && (
          <div className="flex items-center gap-3">
            <AudioWaveform analyser={analyser} />
            <span className="text-xs text-neutral-400">Listening…</span>
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
      </button>
    </div>
  );
};
