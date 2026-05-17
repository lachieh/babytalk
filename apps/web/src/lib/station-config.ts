"use client";

import { useCallback, useEffect, useState } from "react";

export type StationActionKey = "feed" | "diaper" | "sleep" | "pump" | "note";

export interface StationActionMeta {
  key: StationActionKey;
  label: string;
  description: string;
}

export const STATION_ACTIONS: StationActionMeta[] = [
  { description: "Bottle, breast, formula, solid", key: "feed", label: "Feed" },
  { description: "Wet, soiled, or both", key: "diaper", label: "Diaper" },
  { description: "Naps and stretches", key: "sleep", label: "Sleep" },
  { description: "Pumping sessions", key: "pump", label: "Pump" },
  { description: "Quick text notes", key: "note", label: "Note" },
];

const STORAGE_KEY = "babytalk_station_actions";
const DEFAULT_VISIBLE: StationActionKey[] = ["feed", "diaper", "sleep"];

const sanitize = (raw: unknown): StationActionKey[] => {
  if (!Array.isArray(raw)) return DEFAULT_VISIBLE;
  const valid = new Set<StationActionKey>(STATION_ACTIONS.map((a) => a.key));
  const cleaned = raw.filter((v): v is StationActionKey =>
    valid.has(v as StationActionKey)
  );
  return cleaned.length > 0 ? cleaned : DEFAULT_VISIBLE;
};

const readFromStorage = (): StationActionKey[] => {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_VISIBLE;
  }
};

export const useStationActions = (): {
  visible: StationActionKey[];
  toggle: (key: StationActionKey) => void;
  setVisible: (keys: StationActionKey[]) => void;
} => {
  const [visible, setVisibleState] =
    useState<StationActionKey[]>(DEFAULT_VISIBLE);

  useEffect(() => {
    setVisibleState(readFromStorage());
  }, []);

  const persist = useCallback((next: StationActionKey[]) => {
    setVisibleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const toggle = useCallback((key: StationActionKey) => {
    setVisibleState((current) => {
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : STATION_ACTIONS.map((a) => a.key).filter(
            (k) => current.includes(k) || k === key
          );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { setVisible: persist, toggle, visible };
};
