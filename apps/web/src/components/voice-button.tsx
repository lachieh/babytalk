"use client";

import { useTamboThreadInput } from "@tambo-ai/react";
import { useCallback, useEffect, useRef, useState } from "react";

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

const getTranscript = (e: SpeechRecognitionEvent): string =>
  e.results[0]?.[0]?.transcript ?? "";

export const VoiceButton = () => {
  const { setValue, submit } = useTamboThreadInput();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const handleStart = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.addEventListener("result", ((e: SpeechRecognitionEvent) => {
      const transcript = getTranscript(e);
      if (transcript.trim()) {
        setValue(transcript);
        submit();
      }
    }) as EventListener);

    recognition.addEventListener("error", ((e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") {
        console.error("Speech recognition error:", e.error);
      }
      setListening(false);
    }) as EventListener);

    recognition.addEventListener("end", () => {
      setListening(false);
    });

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [setValue, submit]);

  const handleStop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!supported) return null;

  return (
    <button
      className={`rounded-full p-2 transition-colors ${
        listening
          ? "bg-red-500 text-white animate-pulse"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      onClick={listening ? handleStop : handleStart}
      title={listening ? "Stop recording" : "Start voice input"}
      type="button"
    >
      <svg
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
