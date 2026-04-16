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

/**
 * Peak frequency value (0-255) below which audio is considered silent.
 * Uses peak rather than average because speech energy concentrates in
 * a few frequency bins — averaging all 128 bins dilutes the signal.
 */
const SILENCE_THRESHOLD = 25;
const SILENCE_TIMEOUT = 2500;
/** How long to show error/empty messages before auto-dismissing */
const ERROR_DISPLAY_MS = 3000;

/* ── Types ──────────────────────────────────────────────────── */

export type VoicePhase =
  | "idle"
  | "listening"
  | "processing"
  | "response"
  | "error";

interface VoiceSessionContextValue {
  analyser: AnalyserNode | null;
  dismiss: () => void;
  errorMessage: string;
  phase: VoicePhase;
  setPhase: (phase: VoicePhase) => void;
  showError: (message: string) => void;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
}

/* ── Context ────────────────────────────────────────────────── */

const noop = () => {
  /* default context noop */
};

const VoiceSessionContext = createContext<VoiceSessionContextValue>({
  analyser: null,
  dismiss: noop,
  errorMessage: "",
  phase: "idle",
  setPhase: noop,
  showError: noop,
  startListening: noop,
  stopListening: noop,
  transcript: "",
});

export const useVoiceSession = () => useContext(VoiceSessionContext);

/* ── Error messages ─────────────────────────────────────────── */

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access denied",
  "no-speech": "Didn\u2019t catch that \u2014 try again",
  "audio-capture": "No microphone found",
  network: "Network error \u2014 check your connection",
};

/* ── Provider ───────────────────────────────────────────────── */

export const VoiceSessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef("");
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks whether the error handler already showed an error this session */
  const errorShownRef = useRef(false);

  /* ── Show an error that auto-dismisses ────────────────────── */

  const showError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMessage(message);
    setPhase("error");
    errorTimerRef.current = setTimeout(() => {
      setPhase("idle");
      setErrorMessage("");
    }, ERROR_DISPLAY_MS);
  }, []);

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

        /* Use peak frequency value instead of average.
         * Speech energy concentrates in a handful of bins — averaging
         * across all 128 bins makes even loud speech look like silence. */
        let peak = 0;
        for (const val of dataArray) {
          if (val > peak) peak = val;
        }

        if (peak < SILENCE_THRESHOLD) {
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
      /* Microphone access denied — handled by speech recognition error */
    }
  }, []);

  /* ── Speech recognition ───────────────────────────────────── */

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      showError("Voice input not supported in this browser");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      cleanup();
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";
    errorShownRef.current = false;
    setTranscript("");
    setPhase("listening");

    recognition.addEventListener("result", ((e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      transcriptRef.current = text;
      setTranscript(text);
    }) as EventListener);

    recognition.addEventListener("error", ((e: SpeechRecognitionErrorEvent) => {
      /* "aborted" fires when we call recognition.stop() — expected, not an error */
      if (e.error === "aborted") return;

      errorShownRef.current = true;
      cleanup();
      const message =
        SPEECH_ERROR_MESSAGES[e.error] ?? `Voice error: ${e.error}`;
      showError(message);
    }) as EventListener);

    recognition.addEventListener("end", () => {
      cleanup();
      const text = transcriptRef.current.trim();
      if (text) {
        setTranscript(text);
        setPhase("processing");
      } else if (!errorShownRef.current) {
        showError("Didn\u2019t catch that \u2014 try again");
      }
    });

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      showError("Couldn\u2019t start voice input");
    }

    startSilenceDetection();
  }, [cleanup, startSilenceDetection, showError]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const dismiss = useCallback(() => {
    if (phase === "listening") {
      recognitionRef.current?.stop();
      cleanup();
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPhase("idle");
    setTranscript("");
    setErrorMessage("");
  }, [phase, cleanup]);

  useEffect(
    () => () => {
      cleanup();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [cleanup]
  );

  const value = useMemo<VoiceSessionContextValue>(
    () => ({
      analyser,
      dismiss,
      errorMessage,
      phase,
      setPhase,
      showError,
      startListening,
      stopListening,
      transcript,
    }),
    [
      analyser,
      dismiss,
      errorMessage,
      phase,
      setPhase,
      showError,
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
