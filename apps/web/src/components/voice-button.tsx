"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { triggerFeedback } from "@/lib/haptics";

type SpeechRecognitionEvent = Event & {
  results: Record<number, Record<number, { transcript: string }>>;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
};

const getSpeechRecognition = ():
  | (new () => SpeechRecognitionInstance)
  | null => {
  if (typeof window === "undefined") return null;
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition ?? win.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionInstance)
    | null;
};

const SILENCE_THRESHOLD = 10;
const SILENCE_TIMEOUT = 2500;
const HOLD_THRESHOLD = 300;

const getAriaLabel = (listening: boolean, mode: string): string => {
  if (!listening) return "Hold to talk, or tap for voice input";
  if (mode === "hold") return "Release to send";
  return "Tap to stop recording";
};

export const VoiceButton = () => {
  const { setValue, submit } = useTamboThreadInput();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<"idle" | "hold" | "tap">("idle");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<number>(0);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const stopSilenceDetection = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        /* already closing */
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startSilenceDetection = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;

      const checkSilence = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (avg < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          if (Date.now() - silenceStart >= SILENCE_TIMEOUT) {
            recognitionRef.current?.stop();
            return;
          }
        } else {
          silenceStart = null;
        }

        silenceTimerRef.current = setTimeout(checkSilence, 100);
      };

      checkSilence();

      const cleanup = () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      };
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "closed") cleanup();
      });
    } catch {
      /* Microphone access denied */
    }
  }, []);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    transcriptRef.current = "";

    recognition.addEventListener("result", ((e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      transcriptRef.current = transcript;
    }) as EventListener);

    recognition.addEventListener("error", ((e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        console.error("Speech recognition error:", e.error);
      }
      setListening(false);
      setMode("idle");
      stopSilenceDetection();
    }) as EventListener);

    recognition.addEventListener("end", () => {
      setListening(false);
      setMode("idle");
      stopSilenceDetection();
      if (transcriptRef.current.trim()) {
        setValue(transcriptRef.current);
        submit();
        triggerFeedback("logged");
      }
    });

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    startSilenceDetection();
  }, [setValue, submit, stopSilenceDetection, startSilenceDetection]);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setMode("idle");
    stopSilenceDetection();
  }, [stopSilenceDetection]);

  // Hold-to-talk: press and hold to record, release to submit
  const handlePointerDown = useCallback(() => {
    if (listening) {
      stopRecognition();
      return;
    }
    pressStartRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
      // Long press detected — hold-to-talk mode
      setMode("hold");
      startRecognition();
    }, HOLD_THRESHOLD);
  }, [listening, startRecognition, stopRecognition]);

  const handlePointerUp = useCallback(() => {
    const elapsed = Date.now() - pressStartRef.current;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (mode === "hold") {
      // Release after hold — stop and submit
      stopRecognition();
    } else if (elapsed < HOLD_THRESHOLD && !listening) {
      // Quick tap — toggle tap mode
      setMode("tap");
      startRecognition();
    }
  }, [mode, listening, startRecognition, stopRecognition]);

  // Cancel on pointer leave
  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  if (!supported) return null;

  return (
    <button
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-radius-full transition-[background-color,color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] select-none touch-none ${
        listening
          ? "animate-gentle-pulse bg-danger-100 text-danger-500"
          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 active:scale-[0.96]"
      }`}
      aria-label={getAriaLabel(listening, mode)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
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
