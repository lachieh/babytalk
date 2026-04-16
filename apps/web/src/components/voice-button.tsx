"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useVoiceSession } from "@/lib/voice-session";

const HOLD_THRESHOLD = 300;

const hasSpeechRecognition = (): boolean => {
  if (typeof window === "undefined") return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.SpeechRecognition ?? win.webkitSpeechRecognition);
};

/**
 * Mic button in the bottom nav bar.
 * Tap to start voice input, hold to talk.
 * All speech recognition is managed by VoiceSessionProvider;
 * this component only triggers start/stop.
 */
export const VoiceButton = () => {
  const { phase, startListening, stopListening } = useVoiceSession();
  const [supported, setSupported] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<number>(0);
  const [mode, setMode] = useState<"idle" | "hold">("idle");

  useEffect(() => {
    setSupported(hasSpeechRecognition());
  }, []);

  const listening = phase === "listening";

  const handlePointerDown = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    pressStartRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
      setMode("hold");
      startListening();
    }, HOLD_THRESHOLD);
  }, [listening, startListening, stopListening]);

  const handlePointerUp = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (mode === "hold") {
      stopListening();
      setMode("idle");
    } else if (elapsed < HOLD_THRESHOLD && !listening) {
      startListening();
    }
  }, [mode, listening, startListening, stopListening]);

  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  if (!supported) return null;

  let ariaLabel = "Hold to talk, or tap for voice input";
  if (listening && mode === "hold") ariaLabel = "Release to send";
  else if (listening) ariaLabel = "Tap to stop recording";

  return (
    <button
      aria-label={ariaLabel}
      className={`flex h-14 w-14 items-center justify-center rounded-full shadow-md transition-[background-color,color,transform,box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-out)] select-none touch-none ${
        listening
          ? "animate-gentle-pulse bg-danger-500 text-white shadow-danger-200"
          : "bg-primary-500 text-white shadow-primary-200 hover:bg-primary-600 active:scale-[0.93]"
      }`}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 10v2a7 7 0 0 1-14 0v-2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          strokeLinecap="round"
          strokeLinejoin="round"
          x1="12"
          x2="12"
          y1="19"
          y2="23"
        />
        <line
          strokeLinecap="round"
          strokeLinejoin="round"
          x1="8"
          x2="16"
          y1="23"
          y2="23"
        />
      </svg>
    </button>
  );
};
