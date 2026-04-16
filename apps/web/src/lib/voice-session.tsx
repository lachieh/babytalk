"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ── Speech Recognition types ───────────────────────────────── */

type SpeechRecognitionEvent = Event & {
  results: Record<number, Record<number, { transcript: string }>>;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

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

/* ── Constants ──────────────────────────────────────────────── */

const SILENCE_THRESHOLD = 10;
const SILENCE_TIMEOUT = 2500;

/* ── Types ──────────────────────────────────────────────────── */

export type VoicePhase = "idle" | "listening" | "processing" | "response";

interface VoiceSessionContextValue {
  analyser: AnalyserNode | null;
  dismiss: () => void;
  phase: VoicePhase;
  setPhase: (phase: VoicePhase) => void;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
}

/* ── Context ────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-empty-function */
const noop = () => {};
/* eslint-enable @typescript-eslint/no-empty-function */

const VoiceSessionContext = createContext<VoiceSessionContextValue>({
  analyser: null,
  dismiss: noop,
  phase: "idle",
  setPhase: noop,
  startListening: noop,
  stopListening: noop,
  transcript: "",
});

export const useVoiceSession = () => useContext(VoiceSessionContext);

/* ── Provider ───────────────────────────────────────────────── */

export const VoiceSessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef("");

  /* ── Cleanup helpers ──────────────────────────────────────── */

  const cleanup = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
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
    setAnalyser(null);
  }, []);

  /* ── Silence detection via Web Audio ──────────────────────── */

  const startSilenceDetection = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      source.connect(node);
      analyserRef.current = node;
      setAnalyser(node);

      const dataArray = new Uint8Array(node.frequencyBinCount);
      let silenceStart: number | null = null;

      const check = () => {
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
        silenceTimerRef.current = setTimeout(check, 100);
      };
      check();
    } catch {
      /* Microphone access denied — degrade gracefully */
    }
  }, []);

  /* ── Speech recognition ───────────────────────────────────── */

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    // If already listening, restart
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      cleanup();
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    transcriptRef.current = "";
    setTranscript("");
    setPhase("listening");

    recognition.addEventListener("result", ((e: SpeechRecognitionEvent) => {
      transcriptRef.current = e.results[0]?.[0]?.transcript ?? "";
    }) as EventListener);

    recognition.addEventListener("error", ((e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        console.error("Speech recognition error:", e.error);
      }
      cleanup();
      setPhase("idle");
    }) as EventListener);

    recognition.addEventListener("end", () => {
      cleanup();
      const text = transcriptRef.current.trim();
      if (text) {
        setTranscript(text);
        setPhase("processing");
      } else {
        setPhase("idle");
      }
    });

    recognitionRef.current = recognition;
    recognition.start();
    startSilenceDetection();
  }, [cleanup, startSilenceDetection]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const dismiss = useCallback(() => {
    if (phase === "listening") {
      recognitionRef.current?.stop();
      cleanup();
    }
    setPhase("idle");
    setTranscript("");
  }, [phase, cleanup]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup]
  );

  const value = useMemo<VoiceSessionContextValue>(
    () => ({
      analyser,
      dismiss,
      phase,
      setPhase,
      startListening,
      stopListening,
      transcript,
    }),
    [
      analyser,
      dismiss,
      phase,
      setPhase,
      startListening,
      stopListening,
      transcript,
    ]
  );

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
    </VoiceSessionContext.Provider>
  );
};
