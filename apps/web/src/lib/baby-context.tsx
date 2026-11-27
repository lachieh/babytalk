"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ZodType } from "zod";
import { z } from "zod";

import { SyncStatus } from "@/components/sync-status";
import { readDevice, writeDevice } from "@/lib/app-cache";
import { takesAmount } from "@/lib/daily-totals";
import type { BabyEvent, EventChanges, EventsAction } from "@/lib/event-outbox";
import {
  canRecord,
  deriveEvents,
  isRunning,
  unsavedCounts,
  unsavedTotal,
} from "@/lib/event-outbox";
import { currentUserId, gqlRequest } from "@/lib/gql-request";
import { RECENT_EVENTS_LIMIT } from "@/lib/history-days";
import {
  adoptClosedTabs,
  resumeOutbox,
  dispatchOutbox as dispatch,
  getOutboxState,
  getServerOutboxState,
  isOutboxDurable,
  setOutboxBaby,
  startOutbox,
  subscribeOutbox,
} from "@/lib/outbox-store";
import { retryUntil } from "@/lib/retry-until";
import type { ToastPhase } from "@/lib/toast-copy";

/* ── Types ─────────────────────────────────────────────────── */

export type { BabyEvent, SyncState } from "@/lib/event-outbox";

export interface Baby {
  id: string;
  name: string;
  birthDate: string;
  gender: string | null;
}

export interface UndoableAction {
  id: string;
  label: string;
  eventId: string;
  expiresAt: number;
  phase: ToastPhase;
  event: BabyEvent;
  canUndo: boolean;
}

export interface SyncSummary {
  online: boolean;
  queued: number;
  failed: number;
  /** Unsaved entries this device could not store: lost if the page closes. */
  unstored: number;
}

interface BabyContextValue {
  baby: Baby | null;
  events: BabyEvent[];
  activeEvents: BabyEvent[];
  loading: boolean;
  eventsLoading: boolean;
  /** Logging may start: the server has said what is running, or it could
   * not be asked (offline) and the person must not be held up. */
  canLog: boolean;
  refreshEvents: () => Promise<void>;
  refreshBaby: () => Promise<void>;
  logEventDirect: (
    type: string,
    meta: Record<string, unknown>
  ) => Promise<BabyEvent>;
  stopEvent: (id: string) => Promise<void>;
  completeAmount: (id: string, amountMl: number | null) => void;
  discardEvent: (id: string) => void;
  updateEventMeta: (
    id: string,
    type: string,
    meta: Record<string, unknown>,
    startedAt?: string,
    endedAt?: string | null
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  retryEvent: (id: string) => Promise<void>;
  retryFailed: () => void;
  sync: SyncSummary;
  undoableAction: UndoableAction | null;
  undo: () => void;
  dismissUndo: () => void;
}

/* ── GraphQL ───────────────────────────────────────────────── */

const GET_MY_BABIES = `
  query { myBabies { id name birthDate gender } }
`;

const GET_RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $limit: Int) {
    recentEvents(babyId: $babyId, limit: $limit) {
      id type startedAt endedAt metadata
    }
  }
`;

/* ── Context ───────────────────────────────────────────────── */

const BabyContext = createContext<BabyContextValue | null>(null);

/** Thrown when a change could not be recorded, so it will never be sent. A
 * caller must not tell the person it was saved. */
export class NotRecordedError extends Error {
  constructor(id: string) {
    super(`Change to ${id} could not be recorded`);
    this.name = "NotRecordedError";
  }
}

const record = (
  action: Extract<EventsAction, { type: "update" | "delete" }>
) => {
  if (!canRecord(getOutboxState(), action))
    throw new NotRecordedError(action.id);
  dispatch(action);
};

/** Run `task`, turning a throw into a rejected promise for async callers. */
const settled = (task: () => void): Promise<void> => {
  try {
    task();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
};

export const UNDO_DURATION = 5000;

const BABY_RETRY_MS = 15_000;

const BABY_CACHE = "baby";

const keepIfUnchanged = (prev: Baby | null, next: Baby): Baby =>
  prev?.id === next.id &&
  prev.name === next.name &&
  prev.birthDate === next.birthDate &&
  prev.gender === next.gender
    ? prev
    : next;

/** How long logging waits for the first answer about events before it goes
 * ahead without one (offline, or a request that never returns). */
const EVENTS_WAIT_MS = 8000;

const babySchema = z.object({
  birthDate: z.string(),
  gender: z.string().nullable(),
  id: z.string(),
  name: z.string(),
}) satisfies ZodType<Baby>;

export const readCachedBaby = () =>
  readDevice(currentUserId(), BABY_CACHE, babySchema);

export const BabyContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [cachedBaby] = useState(readCachedBaby);
  const [baby, setBaby] = useState<Baby | null>(cachedBaby);
  const state = useSyncExternalStore(
    subscribeOutbox,
    getOutboxState,
    getServerOutboxState
  );
  const durable = useSyncExternalStore(
    subscribeOutbox,
    isOutboxDurable,
    isOutboxDurable
  );
  const [loading, setLoading] = useState(cachedBaby === null);
  const [stoppedWaiting, setStoppedWaiting] = useState(false);
  const [online, setOnline] = useState(true);
  const [undoableAction, setUndoableAction] = useState<UndoableAction | null>(
    null
  );
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const babyRef = useRef<Baby | null>(cachedBaby);
  const babyRequestRef = useRef<Promise<Baby | null> | null>(null);
  const pendingDiscardRef = useRef<string | null>(null);

  const events = useMemo(() => deriveEvents(state), [state]);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const loadBaby = useCallback((): Promise<Baby | null> => {
    if (!babyRequestRef.current) {
      babyRequestRef.current = (async () => {
        const user = currentUserId();
        try {
          const data = await gqlRequest<{ myBabies: Baby[] } | null>(
            GET_MY_BABIES
          );
          const first = data?.myBabies[0] ?? null;
          // Someone else signed in meanwhile: this answer is not theirs.
          if (first && currentUserId() === user) {
            babyRef.current = first;
            writeDevice(user, BABY_CACHE, first);
            setBaby((prev) => keepIfUnchanged(prev, first));
          }
          return first ?? babyRef.current;
        } catch {
          return babyRef.current;
        } finally {
          babyRequestRef.current = null;
          setLoading(false);
        }
      })();
    }
    return babyRequestRef.current;
  }, []);

  const refreshBaby = useCallback(async () => {
    await loadBaby();
  }, [loadBaby]);

  // Find the baby, and keep looking through an outage: until it is known
  // nothing can be logged and restored entries cannot be sent.
  useEffect(() => {
    if (baby) return;
    return retryUntil(async () => (await loadBaby()) !== null, BABY_RETRY_MS);
  }, [baby, loadBaby]);

  useEffect(() => {
    if (cachedBaby) loadBaby();
  }, [cachedBaby, loadBaby]);

  const refreshEvents = useCallback(async () => {
    if (!baby) return;
    const requestedAt = Date.now();
    try {
      const data = await gqlRequest<{ recentEvents: BabyEvent[] } | null>(
        GET_RECENT_EVENTS,
        { babyId: baby.id, limit: RECENT_EVENTS_LIMIT }
      );
      if (data) {
        dispatch({ events: data.recentEvents, requestedAt, type: "loaded" });
        // The server answered, so whatever was waiting can go now.
        resumeOutbox();
      }
    } catch {
      setStoppedWaiting(true);
    }
  }, [baby]);

  useLayoutEffect(() => {
    startOutbox(currentUserId());
  }, []);

  // Load events when baby is known
  useEffect(() => {
    if (!baby) return;
    setOutboxBaby(baby.id);
    refreshEvents();
  }, [baby, refreshEvents]);

  // Active events = in-progress timers (endedAt is null).
  // Exclude instant event types (diaper) which may have endedAt=null from legacy data.
  const activeEvents = useMemo(() => events.filter(isRunning), [events]);

  // Poll faster when there are active events (15s) vs idle (60s)
  useEffect(() => {
    if (!baby) return;
    const interval = activeEvents.length > 0 ? 15_000 : 60_000;
    const id = setInterval(refreshEvents, interval);
    return () => clearInterval(id);
  }, [baby, refreshEvents, activeEvents.length]);

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      adoptClosedTabs();
      resumeOutbox();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () =>
      document.removeEventListener("visibilitychange", handleVisible);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      resumeOutbox();
      refreshEvents();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshEvents]);

  const commitDiscard = useCallback(() => {
    const id = pendingDiscardRef.current;
    if (!id) return;
    pendingDiscardRef.current = null;
    dispatch({ id, type: "delete" });
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", commitDiscard);
    return () => {
      window.removeEventListener("pagehide", commitDiscard);
      commitDiscard();
    };
  }, [commitDiscard]);

  const dismissUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    commitDiscard();
    setUndoableAction(null);
  }, [commitDiscard]);

  const showToast = useCallback(
    (event: BabyEvent, phase: ToastPhase, canUndo: boolean) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      commitDiscard();
      const action: UndoableAction = {
        canUndo,
        event,
        eventId: event.id,
        expiresAt: Date.now() + UNDO_DURATION,
        id: crypto.randomUUID(),
        label: event.type,
        phase,
      };
      setUndoableAction(action);
      undoTimerRef.current = setTimeout(() => {
        commitDiscard();
        setUndoableAction((current) =>
          current?.id === action.id ? null : current
        );
      }, UNDO_DURATION);
    },
    [commitDiscard]
  );

  const undo = useCallback(() => {
    if (!undoableAction?.canUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoableAction.phase === "discarded") {
      pendingDiscardRef.current = null;
      dispatch({ id: undoableAction.eventId, type: "unhide" });
    } else {
      dispatch({ id: undoableAction.eventId, type: "delete" });
    }
    setUndoableAction(null);
  }, [undoableAction]);

  const update = useCallback(
    (id: string, changes: EventChanges, eventType?: string) => {
      record({ changes, eventType, id, type: "update" });
    },
    []
  );

  const deleteEvent = useCallback(
    (id: string) => settled(() => record({ id, type: "delete" })),
    []
  );

  const stopEvent = useCallback(
    (id: string) =>
      settled(() => {
        const endedAt = new Date().toISOString();
        const current = eventsRef.current.find((e) => e.id === id);
        update(id, { endedAt }, current?.type);
        if (current && !takesAmount(current)) {
          showToast({ ...current, endedAt }, "saved", false);
        }
      }),
    [update, showToast]
  );

  const completeAmount = useCallback(
    (id: string, amountMl: number | null) => {
      const current = eventsRef.current.find((e) => e.id === id);
      if (!current) throw new NotRecordedError(id);
      let saved = current;
      if (amountMl !== null) {
        let meta: Record<string, unknown> = {};
        try {
          meta = JSON.parse(current.metadata) as Record<string, unknown>;
        } catch {
          /* record the amount alone */
        }
        const next = { ...meta, amountMl };
        update(id, { meta: next }, current.type);
        saved = { ...current, metadata: JSON.stringify(next) };
      }
      showToast(saved, "saved", false);
    },
    [update, showToast]
  );

  const discardEvent = useCallback(
    (id: string) => {
      const current = eventsRef.current.find((e) => e.id === id);
      if (!current) return;
      showToast(current, "discarded", true);
      pendingDiscardRef.current = id;
      dispatch({ id, type: "hide" });
    },
    [showToast]
  );

  const updateEventMeta = useCallback(
    (
      id: string,
      type: string,
      meta: Record<string, unknown>,
      startedAt?: string,
      endedAt?: string | null
    ) =>
      settled(() =>
        update(
          id,
          {
            meta,
            ...(startedAt ? { startedAt } : {}),
            ...(endedAt === undefined ? {} : { endedAt }),
          },
          type
        )
      ),
    [update]
  );

  const logEventDirect = useCallback(
    (type: string, meta: Record<string, unknown>): Promise<BabyEvent> => {
      // Extract timing overrides from meta (set by timer flows)
      const { _startedAt, _endedAt, ...cleanMeta } = meta;
      const event: BabyEvent = {
        endedAt: typeof _endedAt === "string" ? _endedAt : null,
        // The event's id for good: the server stores the row under it.
        id: crypto.randomUUID(),
        metadata: JSON.stringify(cleanMeta),
        startedAt:
          typeof _startedAt === "string"
            ? _startedAt
            : new Date().toISOString(),
        type,
      };
      dispatch({ event, type: "create" });
      showToast(event, event.endedAt === null ? "started" : "saved", true);
      return Promise.resolve({ ...event, syncState: "pending" });
    },
    [showToast]
  );

  const retryEvent = useCallback((id: string) => {
    dispatch({ id, type: "retry" });
    return Promise.resolve();
  }, []);

  const retryFailed = useCallback(() => {
    dispatch({ type: "retry" });
  }, []);

  const sync = useMemo((): SyncSummary => {
    const counts = unsavedCounts(state);
    const unstored = durable ? 0 : unsavedTotal(state);
    return { ...counts, online, unstored };
  }, [state, online, durable]);

  useEffect(() => {
    if (!baby || state.source === "server") return;
    const timer = setTimeout(() => setStoppedWaiting(true), EVENTS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [baby, state.source]);

  const eventsLoading = loading || (baby !== null && state.source === "none");
  const canLog = baby !== null && (state.source === "server" || stoppedWaiting);

  const value = useMemo(
    (): BabyContextValue => ({
      activeEvents,
      baby,
      canLog,
      completeAmount,
      deleteEvent,
      discardEvent,
      dismissUndo,
      events,
      eventsLoading,
      loading,
      logEventDirect,
      refreshBaby,
      refreshEvents,
      retryEvent,
      retryFailed,
      stopEvent,
      sync,
      undo,
      undoableAction,
      updateEventMeta,
    }),
    [
      activeEvents,
      baby,
      canLog,
      completeAmount,
      deleteEvent,
      discardEvent,
      dismissUndo,
      events,
      eventsLoading,
      loading,
      logEventDirect,
      refreshBaby,
      refreshEvents,
      retryEvent,
      retryFailed,
      stopEvent,
      sync,
      undo,
      undoableAction,
      updateEventMeta,
    ]
  );

  return (
    <BabyContext.Provider value={value}>
      {children}
      <SyncStatus />
    </BabyContext.Provider>
  );
};

export const useBabyContext = (): BabyContextValue => {
  const ctx = useContext(BabyContext);
  if (!ctx)
    throw new Error("useBabyContext must be within BabyContextProvider");
  return ctx;
};
