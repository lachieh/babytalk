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
  loading: boolean;
  refreshEvents: () => Promise<void>;
  logEventDirect: (
    type: string,
    meta: Record<string, unknown>
  ) => Promise<BabyEvent | null>;
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

  // Auto-refresh events every 60s
  useEffect(() => {
    if (!baby) return;
    const interval = setInterval(refreshEvents, 60_000);
    return () => clearInterval(interval);
  }, [baby, refreshEvents]);

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
      loading,
      refreshEvents,
      logEventDirect,
      deleteEvent,
      undoableAction,
      dismissUndo,
    }),
    [
      baby,
      events,
      loading,
      refreshEvents,
      logEventDirect,
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
