"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { SyncStatus } from "@/components/sync-status";
import { takesAmount } from "@/lib/daily-totals";
import type { BabyEvent, EventChanges, OutboxEntry } from "@/lib/event-outbox";
import {
  deriveEvents,
  eventsReducer,
  initialEventsState,
  unsavedCounts,
} from "@/lib/event-outbox";
import { gqlRequest } from "@/lib/gql-request";
import { RECENT_EVENTS_LIMIT } from "@/lib/history-days";
import { onSyncMessage } from "@/lib/register-sw";
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
}

interface BabyContextValue {
  baby: Baby | null;
  events: BabyEvent[];
  activeEvents: BabyEvent[];
  loading: boolean;
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

const LOG_EVENT = `
  mutation LogEvent(
    $babyId: String!
    $type: EventType!
    $startedAt: String
    $endedAt: String
    $feedMeta: FeedMetadataInput
    $sleepMeta: SleepMetadataInput
    $diaperMeta: DiaperMetadataInput
    $noteMeta: NoteMetadataInput
    $pumpMeta: PumpMetadataInput
  ) {
    logEvent(
      babyId: $babyId
      type: $type
      startedAt: $startedAt
      endedAt: $endedAt
      feedMeta: $feedMeta
      sleepMeta: $sleepMeta
      diaperMeta: $diaperMeta
      noteMeta: $noteMeta
      pumpMeta: $pumpMeta
    ) {
      id type startedAt endedAt metadata
    }
  }
`;

const DELETE_EVENT = `
  mutation DeleteEvent($id: String!) {
    deleteEvent(id: $id)
  }
`;

const UPDATE_EVENT = `
  mutation UpdateEvent(
    $id: String!
    $startedAt: String
    $endedAt: String
    $feedMeta: FeedMetadataInput
    $sleepMeta: SleepMetadataInput
    $diaperMeta: DiaperMetadataInput
    $noteMeta: NoteMetadataInput
    $pumpMeta: PumpMetadataInput
  ) {
    updateEvent(
      id: $id
      startedAt: $startedAt
      endedAt: $endedAt
      feedMeta: $feedMeta
      sleepMeta: $sleepMeta
      diaperMeta: $diaperMeta
      noteMeta: $noteMeta
      pumpMeta: $pumpMeta
    ) {
      id type startedAt endedAt metadata
    }
  }
`;

type SendResult =
  | { kind: "ok"; event: BabyEvent | null }
  | { kind: "queued" }
  | { kind: "failed" };

const sendEntry = async (
  entry: OutboxEntry,
  requestId: string,
  babyId: string | null
): Promise<SendResult> => {
  const { event } = entry;
  try {
    if (entry.op === "delete") {
      if (!entry.serverId) return { event: null, kind: "ok" };
      const data = await gqlRequest<{ deleteEvent: boolean } | null>(
        DELETE_EVENT,
        { clientMutationId: requestId, id: entry.serverId }
      );
      return data ? { event: null, kind: "ok" } : { kind: "queued" };
    }

    if (entry.op === "create") {
      if (!babyId) return { kind: "failed" };
      const data = await gqlRequest<{ logEvent: BabyEvent } | null>(LOG_EVENT, {
        babyId,
        clientMutationId: requestId,
        startedAt: event.startedAt,
        type: event.type,
        ...(event.endedAt ? { endedAt: event.endedAt } : {}),
        [`${event.type}Meta`]: JSON.parse(event.metadata),
      });
      return data ? { event: data.logEvent, kind: "ok" } : { kind: "queued" };
    }

    const { patch } = entry;
    const data = await gqlRequest<{ updateEvent: BabyEvent } | null>(
      UPDATE_EVENT,
      {
        clientMutationId: requestId,
        id: entry.serverId,
        ...(patch.meta ? { [`${event.type}Meta`]: patch.meta } : {}),
        ...(patch.startedAt ? { startedAt: patch.startedAt } : {}),
        ...(patch.endedAt === undefined ? {} : { endedAt: patch.endedAt }),
      }
    );
    return data ? { event: data.updateEvent, kind: "ok" } : { kind: "queued" };
  } catch {
    return { kind: "failed" };
  }
};

/* ── Context ───────────────────────────────────────────────── */

const BabyContext = createContext<BabyContextValue | null>(null);

export const UNDO_DURATION = 5000;

export const BabyContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [state, dispatch] = useReducer(eventsReducer, initialEventsState);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [undoableAction, setUndoableAction] = useState<UndoableAction | null>(
    null
  );
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const babyRef = useRef<Baby | null>(null);
  const babyRequestRef = useRef<Promise<Baby | null> | null>(null);
  const sendingRef = useRef(new Set<string>());
  const pendingDiscardRef = useRef<string | null>(null);

  const events = useMemo(() => deriveEvents(state), [state]);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const loadBaby = useCallback((): Promise<Baby | null> => {
    if (!babyRequestRef.current) {
      babyRequestRef.current = (async () => {
        try {
          const data = await gqlRequest<{ myBabies: Baby[] } | null>(
            GET_MY_BABIES
          );
          const first = data?.myBabies[0] ?? null;
          if (first) {
            babyRef.current = first;
            setBaby(first);
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

  useEffect(() => {
    if (babyRef.current) return;
    setLoading(true);
    loadBaby();
  }, [pathname, loadBaby]);

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
      }
    } catch {
      /* non-critical: polling tries again */
    }
  }, [baby]);

  // Load events when baby is known
  useEffect(() => {
    if (baby) refreshEvents();
  }, [baby, refreshEvents]);

  // Active events = in-progress timers (endedAt is null).
  // Exclude instant event types (diaper) which may have endedAt=null from legacy data.
  const activeEvents = useMemo(
    () => events.filter((e) => e.endedAt === null && e.type !== "diaper"),
    [events]
  );

  // Poll faster when there are active events (15s) vs idle (60s)
  useEffect(() => {
    if (!baby) return;
    const interval = activeEvents.length > 0 ? 15_000 : 60_000;
    const id = setInterval(refreshEvents, interval);
    return () => clearInterval(id);
  }, [baby, refreshEvents, activeEvents.length]);

  useEffect(() => {
    for (const entry of Object.values(state.outbox)) {
      if (entry.status !== "ready" || sendingRef.current.has(entry.key)) {
        continue;
      }
      const { key } = entry;
      const requestId = crypto.randomUUID();
      sendingRef.current.add(key);
      dispatch({ key, requestId, type: "send-start" });
      (async () => {
        const babyId =
          entry.op === "create"
            ? ((babyRef.current ?? (await loadBaby()))?.id ?? null)
            : null;
        const result = await sendEntry(entry, requestId, babyId);
        sendingRef.current.delete(key);
        if (result.kind === "ok") {
          dispatch({
            at: Date.now(),
            key,
            requestId,
            result: result.event,
            type: "send-ok",
          });
        } else if (result.kind === "queued") {
          dispatch({ key, requestId, type: "send-queued" });
        } else {
          dispatch({ key, requestId, type: "send-failed" });
        }
      })();
    }
  }, [state.outbox, loadBaby]);

  useEffect(
    () =>
      onSyncMessage((message) => {
        if (message.type === "MUTATION_SYNCED") {
          dispatch({
            at: Date.now(),
            requestId: message.id,
            type: "worker-synced",
          });
          refreshEvents();
        } else {
          dispatch({ requestId: message.id, type: "worker-failed" });
        }
      }),
    [refreshEvents]
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      dispatch({ type: "retry-failed" });
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

  const update = useCallback((id: string, changes: EventChanges) => {
    dispatch({ changes, id, type: "update" });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    dispatch({ id, type: "delete" });
    return Promise.resolve();
  }, []);

  const stopEvent = useCallback(
    (id: string) => {
      const endedAt = new Date().toISOString();
      update(id, { endedAt });
      const current = eventsRef.current.find((e) => e.id === id);
      if (current && !takesAmount(current)) {
        showToast({ ...current, endedAt }, "saved", false);
      }
      return Promise.resolve();
    },
    [update, showToast]
  );

  const completeAmount = useCallback(
    (id: string, amountMl: number | null) => {
      const current = eventsRef.current.find((e) => e.id === id);
      if (!current) return;
      let saved = current;
      if (amountMl !== null) {
        let meta: Record<string, unknown> = {};
        try {
          meta = JSON.parse(current.metadata) as Record<string, unknown>;
        } catch {
          /* record the amount alone */
        }
        const next = { ...meta, amountMl };
        update(id, { meta: next });
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
      _type: string,
      meta: Record<string, unknown>,
      startedAt?: string,
      endedAt?: string | null
    ) => {
      update(id, {
        meta,
        ...(startedAt ? { startedAt } : {}),
        ...(endedAt === undefined ? {} : { endedAt }),
      });
      return Promise.resolve();
    },
    [update]
  );

  const logEventDirect = useCallback(
    (type: string, meta: Record<string, unknown>): Promise<BabyEvent> => {
      // Extract timing overrides from meta (set by timer flows)
      const { _startedAt, _endedAt, ...cleanMeta } = meta;
      const event: BabyEvent = {
        endedAt: typeof _endedAt === "string" ? _endedAt : null,
        id: `local-${crypto.randomUUID()}`,
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
    dispatch({ type: "retry-failed" });
  }, []);

  const sync = useMemo((): SyncSummary => {
    const counts = unsavedCounts(state);
    return { ...counts, online };
  }, [state, online]);

  const value = useMemo(
    (): BabyContextValue => ({
      activeEvents,
      baby,
      completeAmount,
      deleteEvent,
      discardEvent,
      dismissUndo,
      events,
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
      completeAmount,
      deleteEvent,
      discardEvent,
      dismissUndo,
      events,
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
