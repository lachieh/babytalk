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

interface SpeechRecognitionResult {
  [index: number]: { transcript: string };
  length: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  [Symbol.iterator](): IterableIterator<SpeechRecognitionResult>;
}

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
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
  const [errorMessage, setErrorMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
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

  /* ── Speech recognition ───────────────────────────────────── */

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      showError("Voice input not supported in this browser");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SR();
    /* Continuous + interim so we capture the running transcript and the
     * SpeechRecognition API doesn't auto-stop after a single utterance. */
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";
    errorShownRef.current = false;
    setTranscript("");
    setPhase("listening");

    recognition.addEventListener("result", ((e: SpeechRecognitionEvent) => {
      /* Concatenate transcripts from every result so far. With continuous=true
       * each utterance becomes its own result; we want them all. */
      let text = "";
      const results = [...e.results];
      for (const result of results) {
        text += result?.[0]?.transcript ?? "";
      }
      transcriptRef.current = text;
      setTranscript(text);
    }) as EventListener);

    recognition.addEventListener("error", ((e: SpeechRecognitionErrorEvent) => {
      /* "aborted" fires when we call recognition.stop() — expected, not an error */
      if (e.error === "aborted") return;

      errorShownRef.current = true;
      const message =
        SPEECH_ERROR_MESSAGES[e.error] ?? `Voice error: ${e.error}`;
      showError(message);
    }) as EventListener);

    recognition.addEventListener("end", () => {
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
  }, [showError]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const dismiss = useCallback(() => {
    if (phase === "listening") {
      recognitionRef.current?.stop();
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPhase("idle");
    setTranscript("");
    setErrorMessage("");
  }, [phase]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    []
  );

  const value = useMemo<VoiceSessionContextValue>(
    () => ({
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
