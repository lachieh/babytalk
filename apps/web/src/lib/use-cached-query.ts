"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readMemory, writeMemory } from "./app-cache";

interface Shown<T> {
  key: string;
  data: T;
}

export const useCachedQuery = <T>(
  key: string | null,
  load: () => Promise<T>
) => {
  const [shown, setShown] = useState<Shown<T> | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await loadRef.current();
        // Superseded (a newer request after a save, or another key): drop it.
        if (!cancelled) {
          writeMemory(key, data);
          setShown({ data, key });
          setFailedKey(null);
        }
      } catch {
        if (!cancelled) setFailedKey(key);
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => {
    setFailedKey(null);
    setAttempt((n) => n + 1);
  }, []);

  const update = useCallback(
    (change: (data: T) => T) => {
      if (!key) return;
      setShown((prev) => {
        const current =
          prev && prev.key === key ? prev.data : readMemory<T>(key);
        if (current === undefined) return prev;
        const next = { data: change(current), key };
        writeMemory(key, next.data);
        return next;
      });
    },
    [key]
  );

  const fromState = shown?.key === key ? shown : null;
  const fromMemory = key ? readMemory<T>(key) : undefined;
  const data = fromState ? fromState.data : fromMemory;
  return {
    data,
    failed: data === undefined && failedKey === key,
    retry,
    update,
  };
};
