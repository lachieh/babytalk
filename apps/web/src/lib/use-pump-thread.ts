"use client";

import { useTamboClient } from "@tambo-ai/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BabyEvent } from "./baby-context";
import { publishPumpHint, subscribePumpHint } from "./pump-hint-bus";
import type { PumpHint } from "./pump-hint-bus";
import { gqlRequest } from "./tambo/graphql";

/* ── Constants ──────────────────────────────────────────────── */

const STALE_AFTER_MS = 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 30_000;

const PUMP_SYSTEM_MESSAGE = `PUMP COACH MODE: You are BabyTalk's pump & supply coach.

Your ONLY job is to maintain the "pump hint" displayed on the pumping page. You do this by calling the updatePumpHint tool with a babyId, a one-sentence hint, and (optionally) a suggested side.

You receive concise context messages: pump page open events, pump start events, recent pump + breast feed history, and today's totals. Based on that context, decide whether the hint should change. If it should, call updatePumpHint. If the current hint is still right, you may stay silent.

Hint guidelines:
- One short, warm sentence — max 18 words. No emoji. No medical claims.
- Be concrete: target duration, suggested side, simple supply pattern, or recognition of effort.
- Examples:
  - "Try the right side for 15 minutes — you got 80ml on left last time."
  - "Two sessions, 130ml today. Aim for another in the next hour."
  - "Power-pump idea: 20 on, 10 off, 10 on, 10 off, 10 on."
  - "Strong morning — you're ahead of yesterday's pace."
- For pump-start messages: give in-session encouragement or a duration target.
- For page-open messages: summary or a gentle next-step nudge.
- First-session / no history: a warm welcome and a simple goal.

Do not chat. Respond with the tool call only. Always pass the babyId you received in the context.`;

/* ── Types ──────────────────────────────────────────────────── */

interface StoredHintState {
  hint?: string;
  hintUpdatedAt?: number;
  suggestedSide?: "left" | "right" | "both" | null;
}

interface AgentThreadRow {
  state: string;
  tamboLastRunId: string | null;
  tamboThreadId: string | null;
  updatedAt: string;
}

interface StreamEvent {
  delta?: string;
  runId?: string;
  threadId?: string;
  type: string;
  [key: string]: unknown;
}

/* ── GraphQL ────────────────────────────────────────────────── */

const GET_AGENT_THREAD = `
  query AgentThread($babyId: String!, $activityKey: String!) {
    agentThread(babyId: $babyId, activityKey: $activityKey) {
      state
      tamboThreadId
      tamboLastRunId
      updatedAt
    }
  }
`;

const UPDATE_AGENT_THREAD = `
  mutation UpdateAgentThread(
    $babyId: String!
    $activityKey: String!
    $tamboThreadId: String
    $tamboLastRunId: String
  ) {
    updateAgentThread(
      babyId: $babyId
      activityKey: $activityKey
      tamboThreadId: $tamboThreadId
      tamboLastRunId: $tamboLastRunId
    ) { id }
  }
`;

/* ── Context summary ────────────────────────────────────────── */

function parseMeta(metadata: string): Record<string, unknown> {
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildPumpSummary(events: BabyEvent[]): string {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let sessionsToday = 0;
  let mlToday = 0;
  for (const e of events) {
    if (e.type !== "pump" || !e.endedAt) continue;
    if (new Date(e.startedAt) < todayStart) continue;
    sessionsToday += 1;
    const m = parseMeta(e.metadata);
    if (typeof m.amountMl === "number") mlToday += m.amountMl;
  }

  const lastPump = events.find((e) => e.type === "pump" && e.endedAt);
  let lastPumpStr = "none";
  if (lastPump) {
    const m = parseMeta(lastPump.metadata);
    const side = typeof m.side === "string" ? m.side : "?";
    const ml = typeof m.amountMl === "number" ? `${m.amountMl}ml` : "?ml";
    const durMin =
      lastPump.endedAt && lastPump.startedAt
        ? Math.round(
            (new Date(lastPump.endedAt).getTime() -
              new Date(lastPump.startedAt).getTime()) /
              60_000
          )
        : null;
    const agoMin = Math.round(
      (Date.now() - new Date(lastPump.startedAt).getTime()) / 60_000
    );
    lastPumpStr = `${side}, ${durMin ?? "?"}min, ${ml}, ${agoMin}min ago`;
  }

  const lastBreastFeed = events.find((e) => {
    if (e.type !== "feed") return false;
    const m = parseMeta(e.metadata);
    return m.method === "breast";
  });
  let lastBreastStr = "none";
  if (lastBreastFeed) {
    const m = parseMeta(lastBreastFeed.metadata);
    const side = typeof m.side === "string" ? m.side : "?";
    const agoMin = Math.round(
      (Date.now() - new Date(lastBreastFeed.startedAt).getTime()) / 60_000
    );
    lastBreastStr = `${side}, ${agoMin}min ago`;
  }

  return `Today: ${sessionsToday} pump sessions, ${mlToday}ml total. Last pump: ${lastPumpStr}. Last breast feed: ${lastBreastStr}.`;
}

/* ── Hook ───────────────────────────────────────────────────── */

export function usePumpThread(babyId: string | null, events: BabyEvent[]) {
  const client = useTamboClient();
  const [hint, setHint] = useState<PumpHint | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const threadIdRef = useRef<string | null>(null);
  const lastRunIdRef = useRef<string | null>(null);
  const lastRefreshRef = useRef(0);
  const hydratedRef = useRef(false);

  // Subscribe to bus so tool calls reflect into UI immediately
  useEffect(() => subscribePumpHint(setHint), []);

  // Hydrate from DB on mount
  useEffect(() => {
    if (!babyId || hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await gqlRequest<{ agentThread: AgentThreadRow | null }>(
          GET_AGENT_THREAD,
          { activityKey: "pump", babyId }
        );
        if (cancelled || !data.agentThread) return;
        threadIdRef.current = data.agentThread.tamboThreadId;
        lastRunIdRef.current = data.agentThread.tamboLastRunId;

        let parsed: StoredHintState = {};
        try {
          parsed = JSON.parse(data.agentThread.state) as StoredHintState;
        } catch {
          /* ignore */
        }
        if (parsed.hint && typeof parsed.hintUpdatedAt === "number") {
          const seeded: PumpHint = {
            hint: parsed.hint,
            suggestedSide: parsed.suggestedSide ?? null,
            updatedAt: parsed.hintUpdatedAt,
          };
          publishPumpHint(seeded);
        }
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [babyId]);

  /** Send a context message to the pump thread. The agent decides whether
   * to call updatePumpHint; the bus delivers the result to UI. */
  const sendContext = useCallback(
    async (text: string): Promise<void> => {
      if (!babyId) return;

      const message = {
        content: [{ text, type: "text" as const }],
        role: "user" as const,
      };

      try {
        const stream = threadIdRef.current
          ? ((await client.threads.runs.run(threadIdRef.current, {
              message,
              ...(lastRunIdRef.current
                ? { previousRunId: lastRunIdRef.current }
                : {}),
            })) as unknown as AsyncIterable<StreamEvent>)
          : ((await client.threads.runs.create({
              message,
              thread: {
                initialMessages: [
                  {
                    content: [{ text: PUMP_SYSTEM_MESSAGE, type: "text" }],
                    role: "system" as const,
                  },
                ],
              },
            } as Parameters<
              typeof client.threads.runs.create
            >[0])) as unknown as AsyncIterable<StreamEvent>);

        let newThreadId = threadIdRef.current;
        let newRunId = lastRunIdRef.current;
        for await (const event of stream) {
          if (event.type === "RUN_STARTED") {
            if (event.threadId) newThreadId = event.threadId;
            if (event.runId) newRunId = event.runId;
          }
        }

        const threadChanged = newThreadId !== threadIdRef.current;
        const runChanged = newRunId !== lastRunIdRef.current;
        threadIdRef.current = newThreadId;
        lastRunIdRef.current = newRunId;

        if (newThreadId && (threadChanged || runChanged)) {
          await gqlRequest(UPDATE_AGENT_THREAD, {
            activityKey: "pump",
            babyId,
            tamboLastRunId: newRunId,
            tamboThreadId: newThreadId,
          }).catch(() => {
            /* non-critical */
          });
        }
      } catch (error) {
        console.error("Pump thread error:", error);
      }
    },
    [babyId, client]
  );

  const refreshIfStale = useCallback(async () => {
    if (!babyId) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) return;
    const isStale =
      !hint || !hint.updatedAt || now - hint.updatedAt > STALE_AFTER_MS;
    if (!isStale) return;

    lastRefreshRef.current = now;
    setRefreshing(true);
    const summary = buildPumpSummary(events);
    await sendContext(
      `Pump page opened (babyId: ${babyId}). ${summary} Update the hint with something fresh if useful, or stay silent if the current hint still fits.`
    );
    setRefreshing(false);
  }, [babyId, events, hint, sendContext]);

  const notifyPumpStart = useCallback(
    async (side: "left" | "right" | "both") => {
      if (!babyId) return;
      lastRefreshRef.current = Date.now();
      setRefreshing(true);
      const summary = buildPumpSummary(events);
      await sendContext(
        `Pump session just started: ${side} side (babyId: ${babyId}). ${summary} Give an encouraging, concrete in-session hint.`
      );
      setRefreshing(false);
    },
    [babyId, events, sendContext]
  );

  const forceRefresh = useCallback(async () => {
    if (!babyId) return;
    lastRefreshRef.current = Date.now();
    setRefreshing(true);
    const summary = buildPumpSummary(events);
    await sendContext(
      `Refresh requested by user (babyId: ${babyId}). ${summary} Always call updatePumpHint with a fresh hint based on current context, even if similar to the previous one.`
    );
    setRefreshing(false);
  }, [babyId, events, sendContext]);

  return {
    forceRefresh,
    hint,
    notifyPumpStart,
    refreshIfStale,
    refreshing,
  } as const;
}
