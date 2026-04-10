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

import { gqlRequest } from "@/lib/tambo/graphql";

/* ── Types ─────────────────────────────────────────────────── */

export interface BabyEvent {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  metadata: string;
}

export interface Baby {
  id: string;
  name: string;
  birthDate: string;
}

interface UndoableAction {
  id: string;
  label: string;
  eventId: string;
  expiresAt: number;
}

interface BabyContextValue {
  baby: Baby | null;
  events: BabyEvent[];
  activeEvents: BabyEvent[];
  loading: boolean;
  refreshEvents: () => Promise<void>;
  logEventDirect: (
    type: string,
    meta: Record<string, unknown>
  ) => Promise<BabyEvent | null>;
  stopEvent: (id: string) => Promise<void>;
  updateEventMeta: (
    id: string,
    type: string,
    meta: Record<string, unknown>
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  undoableAction: UndoableAction | null;
  dismissUndo: () => void;
}

/* ── GraphQL ───────────────────────────────────────────────── */

const GET_MY_BABIES = `
  query { myBabies { id name birthDate } }
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
  mutation UpdateEvent($id: String!, $endedAt: String) {
    updateEvent(id: $id, endedAt: $endedAt) {
      id type startedAt endedAt metadata
    }
  }
`;

const UPDATE_EVENT_META = `
  mutation UpdateEventMeta(
    $id: String!
    $feedMeta: FeedMetadataInput
    $sleepMeta: SleepMetadataInput
    $diaperMeta: DiaperMetadataInput
    $noteMeta: NoteMetadataInput
    $pumpMeta: PumpMetadataInput
  ) {
    updateEvent(
      id: $id
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

/* ── Context ───────────────────────────────────────────────── */

const BabyContext = createContext<BabyContextValue | null>(null);

const UNDO_DURATION = 5000;

export const BabyContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoableAction, setUndoableAction] = useState<UndoableAction | null>(
    null
  );
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshEvents = useCallback(async () => {
    if (!baby) return;
    try {
      const data = await gqlRequest<{ recentEvents: BabyEvent[] }>(
        GET_RECENT_EVENTS,
        { babyId: baby.id, limit: 20 }
      );
      setEvents(data.recentEvents);
    } catch {
      /* non-critical */
    }
  }, [baby]);

  // Load baby on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await gqlRequest<{ myBabies: Baby[] }>(GET_MY_BABIES);
        if (data.myBabies.length > 0) {
          setBaby(data.myBabies[0]);
        }
      } catch {
        /* non-critical */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load events when baby is known
  useEffect(() => {
    if (baby) refreshEvents();
  }, [baby, refreshEvents]);

  // Active events = in-progress (endedAt is null), shared across devices
  const activeEvents = useMemo(
    () => events.filter((e) => e.endedAt === null),
    [events]
  );

  // Poll faster when there are active events (15s) vs idle (60s)
  useEffect(() => {
    if (!baby) return;
    const interval = activeEvents.length > 0 ? 15_000 : 60_000;
    const id = setInterval(refreshEvents, interval);
    return () => clearInterval(id);
  }, [baby, refreshEvents, activeEvents.length]);

  const dismissUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoableAction(null);
  }, []);

  const deleteEvent = useCallback(
    async (id: string) => {
      // Optimistic: remove from local state
      setEvents((prev) => prev.filter((e) => e.id !== id));
      try {
        await gqlRequest(DELETE_EVENT, { id });
      } catch {
        // Revert on failure
        await refreshEvents();
      }
    },
    [refreshEvents]
  );

  const stopEvent = useCallback(
    async (id: string) => {
      const endedAt = new Date().toISOString();
      // Optimistic: update local state
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, endedAt } : e))
      );
      try {
        await gqlRequest(UPDATE_EVENT, { id, endedAt });
      } catch {
        await refreshEvents();
      }
    },
    [refreshEvents]
  );

  const updateEventMeta = useCallback(
    async (id: string, type: string, meta: Record<string, unknown>) => {
      const metaKey = `${type}Meta`;
      try {
        await gqlRequest(UPDATE_EVENT_META, { id, [metaKey]: meta });
        await refreshEvents();
      } catch {
        await refreshEvents();
      }
    },
    [refreshEvents]
  );

  const logEventDirect = useCallback(
    async (
      type: string,
      meta: Record<string, unknown>
    ): Promise<BabyEvent | null> => {
      if (!baby) return null;

      const metaKey = `${type}Meta`;
      // Extract timing overrides from meta (set by timer flows)
      const { _startedAt, _endedAt, ...cleanMeta } = meta;
      const variables: Record<string, unknown> = {
        babyId: baby.id,
        type,
        startedAt:
          (typeof _startedAt === "string" ? _startedAt : null) ??
          new Date().toISOString(),
        ...(typeof _endedAt === "string" ? { endedAt: _endedAt } : {}),
        [metaKey]: cleanMeta,
      };

      try {
        const data = await gqlRequest<{ logEvent: BabyEvent }>(
          LOG_EVENT,
          variables
        );
        const newEvent = data.logEvent;

        // Optimistic: prepend to local state
        setEvents((prev) => [newEvent, ...prev]);

        // Set up undo
        dismissUndo();
        const action: UndoableAction = {
          id: crypto.randomUUID(),
          label: type,
          eventId: newEvent.id,
          expiresAt: Date.now() + UNDO_DURATION,
        };
        setUndoableAction(action);
        undoTimerRef.current = setTimeout(() => {
          setUndoableAction((current) =>
            current?.id === action.id ? null : current
          );
        }, UNDO_DURATION);

        return newEvent;
      } catch {
        return null;
      }
    },
    [baby, dismissUndo]
  );

  const value = useMemo(
    (): BabyContextValue => ({
      baby,
      events,
      activeEvents,
      loading,
      refreshEvents,
      logEventDirect,
      stopEvent,
      updateEventMeta,
      deleteEvent,
      undoableAction,
      dismissUndo,
    }),
    [
      baby,
      events,
      activeEvents,
      loading,
      refreshEvents,
      logEventDirect,
      stopEvent,
      updateEventMeta,
      deleteEvent,
      undoableAction,
      dismissUndo,
    ]
  );

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
};

export const useBabyContext = (): BabyContextValue => {
  const ctx = useContext(BabyContext);
  if (!ctx)
    throw new Error("useBabyContext must be within BabyContextProvider");
  return ctx;
};
