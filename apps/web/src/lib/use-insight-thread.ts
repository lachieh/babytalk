"use client";

import { useTamboClient } from "@tambo-ai/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BabyEvent } from "./baby-context";

/* ── Constants ──────────────────────────────────────────────── */

const STORAGE_KEY = "babytalk_insight_thread";
const DEBOUNCE_MS = 5000;
/** Don't refresh more than once per 30s */
const MIN_REFRESH_INTERVAL = 30_000;

const INSIGHT_SYSTEM_MESSAGE = `INSIGHT MODE: You are the BabyTalk insight engine.
Your ONLY job is to produce a single-line contextual insight for display on the home screen.

Rules:
- Respond with ONLY plain text — one short sentence, max 15 words
- NEVER call tools or render components
- Be warm, brief, and contextual
- Consider: time of day, patterns, encouragement for tired parents, gentle nudges
- When there's no interesting pattern, give a warm daily summary

Good examples:
- "Third feed today — she's eating well."
- "You're doing amazing at 3am. Hang in there."
- "Last feed was 2h ago — might be getting hungry."
- "4 feeds, 3 diapers so far. Solid day."
- "She napped 1h20m in the crib. Nice stretch."`;

/* ── Persistence ────────────────────────────────────────────── */

interface StoredThread {
  threadId: string;
  lastRunId: string | null;
}

function loadStored(): StoredThread | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStored(data: StoredThread) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ── Event summary builder ──────────────────────────────────── */

function buildEventSummary(events: BabyEvent[]): string {
  const now = new Date();
  const hour = now.getHours();
  let timeOfDay = "night";
  if (hour < 6) timeOfDay = "late night";
  else if (hour < 12) timeOfDay = "morning";
  else if (hour < 17) timeOfDay = "afternoon";
  else if (hour < 20) timeOfDay = "evening";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter((e) => new Date(e.startedAt) >= todayStart);

  const counts: Record<string, number> = {};
  for (const e of todayEvents) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  const countsStr = Object.entries(counts)
    .map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`)
    .join(", ");

  // Recent events (last 5)
  const recent = events
    .slice(0, 5)
    .map((e) => {
      const ago = Math.round(
        (Date.now() - new Date(e.startedAt).getTime()) / 60_000
      );
      let meta = "";
      try {
        const parsed = JSON.parse(e.metadata);
        if (e.type === "feed") {
          meta = [parsed.method, parsed.side].filter(Boolean).join(" ");
        } else if (e.type === "diaper") {
          const parts = [];
          if (parsed.wet) parts.push("wet");
          if (parsed.soiled) parts.push("soiled");
          meta = parts.join("+");
        } else if (e.type === "sleep" && e.endedAt) {
          const dur = Math.round(
            (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) /
              60_000
          );
          meta = `${dur}min`;
        }
      } catch {
        /* ignore parse errors */
      }
      return `${e.type}${meta ? ` (${meta})` : ""} ${ago}min ago`;
    })
    .join(", ");

  return `Time: ${now.toLocaleTimeString()} (${timeOfDay}). Today: ${countsStr || "nothing yet"}. Recent: ${recent || "none"}.`;
}

/* ── Stream event types (AG-UI protocol) ────────────────────── */

interface StreamEvent {
  type: string;
  threadId?: string;
  runId?: string;
  delta?: string;
  messageId?: string;
  [key: string]: unknown;
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useInsightThread(events: BabyEvent[]) {
  const client = useTamboClient();
  const [insight, setInsight] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const storedRef = useRef<StoredThread | null>(loadStored());
  const lastRefreshRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const prevEventCountRef = useRef(events.length);

  /** Send a message to the insight thread and return the response text */
  const sendMessage = useCallback(
    async (text: string): Promise<string | null> => {
      try {
        const stored = storedRef.current;
        const msg = {
          role: "user" as const,
          content: [{ type: "text" as const, text }],
        };

        const stream = stored?.threadId
          ? ((await client.threads.runs.run(stored.threadId, {
              message: msg,
              ...(stored.lastRunId ? { previousRunId: stored.lastRunId } : {}),
            })) as unknown as AsyncIterable<StreamEvent>)
          : ((await client.threads.runs.create({
              message: msg,
              thread: {
                initialMessages: [
                  {
                    role: "system" as const,
                    content: [{ type: "text", text: INSIGHT_SYSTEM_MESSAGE }],
                  },
                ],
              },
            } as Parameters<
              typeof client.threads.runs.create
            >[0])) as unknown as AsyncIterable<StreamEvent>);

        let responseText = "";
        let threadId = stored?.threadId || "";
        let runId = stored?.lastRunId || "";

        for await (const event of stream) {
          if (event.type === "RUN_STARTED") {
            if (event.threadId) ({ threadId } = event);
            if (event.runId) ({ runId } = event);
          }
          if (
            event.type === "TEXT_MESSAGE_CONTENT" &&
            typeof event.delta === "string"
          ) {
            responseText += event.delta;
          }
        }

        if (threadId) {
          storedRef.current = { threadId, lastRunId: runId || null };
          saveStored(storedRef.current);
        }

        return responseText.trim() || null;
      } catch (error) {
        console.error("Insight thread error:", error);
        return null;
      }
    },
    [client]
  );

  /** Refresh the insight based on current events */
  const refreshInsight = useCallback(async () => {
    if (events.length === 0) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL) return;

    setRefreshing(true);
    lastRefreshRef.current = now;

    const summary = buildEventSummary(events);
    const text = await sendMessage(
      `Here's the current activity:\n${summary}\n\nGenerate a one-line insight.`
    );

    if (text) setInsight(text);
    setRefreshing(false);
  }, [events, sendMessage]);

  // Initial load — refresh insight on first mount with events
  useEffect(() => {
    if (initializedRef.current || events.length === 0) return;
    initializedRef.current = true;
    refreshInsight();
  }, [events.length, refreshInsight]);

  // Refresh when new events arrive (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (events.length === prevEventCountRef.current) return;
    prevEventCountRef.current = events.length;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshInsight, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [events.length, refreshInsight]);

  return { insight, refreshing } as const;
}
