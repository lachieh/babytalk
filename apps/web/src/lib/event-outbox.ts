/**
 * Unconfirmed changes to events, as a pure reducer.
 *
 * Every event has its final id from the moment it is logged: the page picks
 * a UUID and the server stores the row under it. A retried create is the
 * same event by id however it has been edited since, so nothing here ever
 * matches events by their contents.
 *
 * The page is the only place unsent changes live (persisted by
 * outbox-store), and it sends each event's changes one request at a time:
 * a change made while a request is in flight waits for it, so writes for an
 * event reach the server in the order they were made. A request carries only
 * changes the server has not yet confirmed.
 */

export type SyncState = "pending" | "failed";

export interface BabyEvent {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  metadata: string;
  syncState?: SyncState;
}

export interface EventChanges {
  startedAt?: string;
  endedAt?: string | null;
  meta?: Record<string, unknown>;
}

export type Op = "create" | "update" | "delete";

/**
 * - ready: needs a request
 * - sending: this page is waiting for the reply
 * - waiting: the request did not get through (offline, server unreachable);
 *   sent again automatically
 * - failed: the server refused it; sent again only when the person retries
 */
export type OutboxStatus = "ready" | "sending" | "waiting" | "failed";

/** Whether the server may hold a row with this id. */
type Exists = "no" | "maybe" | "yes";

export interface OutboxEntry {
  id: string;
  op: Op;
  event: BabyEvent;
  /** Changes not in any request yet. */
  patch: EventChanges;
  /** Changes carried by the request in flight. */
  sentPatch: EventChanges;
  status: OutboxStatus;
  exists: Exists;
  version: number;
  /** The version the request in flight (or the last one) carried. */
  sentVersion: number;
  sentOp: Op | null;
  requestId: string | null;
  /** A change to a saved event this page has not loaded (an older week). */
  detached: boolean;
}

/** The part of the state that must outlive the page. */
export interface PersistedOutbox {
  v: 1;
  hidden: string[];
  outbox: Record<string, OutboxEntry>;
}

export interface EventsState {
  server: BabyEvent[];
  outbox: Record<string, OutboxEntry>;
  hidden: string[];
  lastWriteAt: number;
}

export type EventsAction =
  | { type: "loaded"; events: BabyEvent[]; requestedAt?: number }
  | { type: "create"; event: BabyEvent }
  | { type: "update"; id: string; changes: EventChanges; eventType?: string }
  | { type: "delete"; id: string }
  | { type: "hide"; id: string }
  | { type: "unhide"; id: string }
  | { type: "send-start"; id: string; requestId: string }
  | {
      type: "send-ok";
      id: string;
      requestId: string;
      result: BabyEvent | null;
      at?: number;
    }
  | {
      type: "send-failed";
      id: string;
      requestId: string;
      /** The server answered and refused, so nothing was stored. */
      definite?: boolean;
    }
  | { type: "adopt"; persisted: PersistedOutbox }
  /** The network may be back: send what was waiting. */
  | { type: "resume" }
  /** The person asked to try again, including what the server refused. */
  | { type: "retry"; id?: string };

export const initialEventsState: EventsState = {
  hidden: [],
  lastWriteAt: 0,
  outbox: {},
  server: [],
};

const applyChanges = (event: BabyEvent, changes: EventChanges): BabyEvent => ({
  ...event,
  ...(changes.startedAt === undefined ? {} : { startedAt: changes.startedAt }),
  ...(changes.endedAt === undefined ? {} : { endedAt: changes.endedAt }),
  ...(changes.meta === undefined
    ? {}
    : { metadata: JSON.stringify(changes.meta) }),
});

const upsert = (events: BabyEvent[], event: BabyEvent) =>
  events.some((e) => e.id === event.id)
    ? events.map((e) => (e.id === event.id ? event : e))
    : [event, ...events];

const putEntry = (state: EventsState, entry: OutboxEntry): EventsState => ({
  ...state,
  outbox: { ...state.outbox, [entry.id]: entry },
});

const dropEntry = (state: EventsState, id: string): EventsState => {
  const { [id]: _removed, ...outbox } = state.outbox;
  return { ...state, outbox };
};

const newEntry = (
  event: BabyEvent,
  op: Op,
  { detached = false, patch = {} }: { detached?: boolean; patch?: EventChanges }
): OutboxEntry => ({
  detached,
  event,
  exists: op === "create" ? "no" : "yes",
  id: event.id,
  op,
  patch,
  requestId: null,
  sentOp: null,
  sentPatch: {},
  sentVersion: 0,
  status: "ready",
  version: 1,
});

const placeholder = (id: string, type = ""): BabyEvent => ({
  endedAt: null,
  id,
  metadata: "{}",
  startedAt: "",
  type,
});

const serverEvent = (state: EventsState, id: string) =>
  state.server.find((e) => e.id === id);

/** The request in flight succeeded: its changes are confirmed. Send what
 * changed meanwhile, if anything; otherwise the entry is done. */
const settle = (
  state: EventsState,
  entry: OutboxEntry,
  confirmed: BabyEvent | null
): EventsState => {
  const exists = entry.sentOp === "delete" ? "no" : "yes";
  if (entry.version > entry.sentVersion) {
    return putEntry(state, {
      ...entry,
      exists,
      op: entry.op === "create" ? "update" : entry.op,
      requestId: null,
      sentPatch: {},
      status: "ready",
    });
  }
  const next = dropEntry(state, entry.id);
  if (entry.sentOp === "delete") {
    return { ...next, server: next.server.filter((e) => e.id !== entry.id) };
  }
  const { syncState: _sync, ...sent } = entry.event;
  const saved = confirmed ?? (entry.detached ? null : sent);
  return saved ? { ...next, server: upsert(next.server, saved) } : next;
};

/** The request confirmed nothing: its changes go back into the next one. */
const unsent = (entry: OutboxEntry, status: OutboxStatus): OutboxEntry => ({
  ...entry,
  patch: { ...entry.sentPatch, ...entry.patch },
  requestId: null,
  sentPatch: {},
  status,
});

/** A failure never lowers `exists`: a refusal of this request says nothing
 * about an earlier one that went unanswered and may have been stored. */
const fail = (
  state: EventsState,
  entry: OutboxEntry,
  refused: boolean
): EventsState =>
  putEntry(state, unsent(entry, refused ? "failed" : "waiting"));

const update = (
  state: EventsState,
  id: string,
  changes: EventChanges,
  eventType: string | undefined
): EventsState => {
  const entry = state.outbox[id];
  if (entry) {
    if (entry.op === "delete") return state;
    return putEntry(state, {
      ...entry,
      event: applyChanges(entry.event, changes),
      patch: { ...entry.patch, ...changes },
      status: entry.status === "sending" ? "sending" : "ready",
      version: entry.version + 1,
    });
  }
  const current = serverEvent(state, id);
  const base = current ?? placeholder(id, eventType);
  return putEntry(
    state,
    newEntry(applyChanges(base, changes), "update", {
      detached: !current,
      patch: changes,
    })
  );
};

const remove = (state: EventsState, id: string): EventsState => {
  const entry = state.outbox[id];
  if (!entry) {
    const current = serverEvent(state, id);
    return putEntry(
      state,
      newEntry(current ?? placeholder(id), "delete", { detached: !current })
    );
  }
  if (entry.op === "delete") return state;
  const sending = entry.status === "sending";
  // Never sent: there is nothing to delete.
  if (entry.exists === "no" && !sending) return dropEntry(state, id);
  return putEntry(state, {
    ...entry,
    op: "delete",
    status: sending ? "sending" : "ready",
    version: entry.version + 1,
  });
};

const startSend = (
  state: EventsState,
  id: string,
  requestId: string
): EventsState => {
  const entry = state.outbox[id];
  if (!entry || entry.status !== "ready") return state;
  // A resent create that the server may already hold confirms only that
  // first copy (the server ignores this one), so the changes made since
  // stay unconfirmed and follow as an update.
  const resentCreate = entry.op === "create" && entry.exists === "maybe";
  return putEntry(state, {
    ...entry,
    exists: entry.op === "create" ? "maybe" : entry.exists,
    patch: resentCreate ? entry.patch : {},
    requestId,
    sentOp: entry.op,
    sentPatch: resentCreate ? {} : entry.patch,
    sentVersion: resentCreate ? entry.sentVersion : entry.version,
    status: "sending",
  });
};

const onReply = (
  state: EventsState,
  id: string,
  requestId: string,
  change: (entry: OutboxEntry) => EventsState
): EventsState => {
  const entry = state.outbox[id];
  return entry?.requestId === requestId && entry.status === "sending"
    ? change(entry)
    : state;
};

export const toPersisted = (state: EventsState): PersistedOutbox => ({
  hidden: state.hidden,
  outbox: state.outbox,
  v: 1,
});

export const isEmptyOutbox = (persisted: PersistedOutbox) =>
  Object.keys(persisted.outbox).length === 0 && persisted.hidden.length === 0;

const STATUSES = new Set<unknown>(["ready", "sending", "waiting", "failed"]);
const OPS = new Set<unknown>(["create", "update", "delete"]);

const isEntry = (value: unknown): value is OutboxEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<OutboxEntry>;
  return (
    typeof entry.id === "string" &&
    STATUSES.has(entry.status) &&
    OPS.has(entry.op) &&
    typeof entry.event === "object" &&
    entry.event !== null
  );
};

/** Take over entries written by an earlier page (a reload, a closed tab). A
 * request that was in flight has no reply coming, so its changes go into the
 * next one; a discard whose undo window was cut short is committed. */
const adopt = (state: EventsState, persisted: PersistedOutbox): EventsState => {
  let next = state;
  for (const [key, entry] of Object.entries(persisted.outbox)) {
    if (!isEntry(entry) || entry.id !== key || next.outbox[key]) continue;
    // A request in flight when the page went has no reply coming.
    next = putEntry(
      next,
      entry.status === "sending" ? unsent(entry, "ready") : entry
    );
  }
  for (const id of persisted.hidden) next = remove(next, id);
  return next;
};

/** Whether the change can be recorded. A caller that gets `false` must tell
 * the person it was not saved. */
export const canRecord = (
  state: EventsState,
  action: Extract<EventsAction, { type: "update" | "delete" }>
): boolean =>
  action.type === "delete" || state.outbox[action.id]?.op !== "delete";

const readyWhere = (
  state: EventsState,
  test: (entry: OutboxEntry) => boolean
): EventsState => {
  let next = state;
  for (const entry of Object.values(state.outbox)) {
    if (test(entry)) next = putEntry(next, { ...entry, status: "ready" });
  }
  return next;
};

const wroteAt = (
  before: EventsState,
  after: EventsState,
  at: number | undefined
): EventsState =>
  after !== before && at !== undefined && at > after.lastWriteAt
    ? { ...after, lastWriteAt: at }
    : after;

export const eventsReducer = (
  state: EventsState,
  action: EventsAction
): EventsState => {
  switch (action.type) {
    case "loaded": {
      const stale =
        action.requestedAt !== undefined &&
        action.requestedAt < state.lastWriteAt;
      return stale ? state : { ...state, server: action.events };
    }
    case "create": {
      return putEntry(state, newEntry(action.event, "create", {}));
    }
    case "update": {
      return update(state, action.id, action.changes, action.eventType);
    }
    case "delete": {
      const shown = {
        ...state,
        hidden: state.hidden.filter((h) => h !== action.id),
      };
      return remove(shown, action.id);
    }
    case "hide": {
      return state.hidden.includes(action.id)
        ? state
        : { ...state, hidden: [...state.hidden, action.id] };
    }
    case "unhide": {
      return { ...state, hidden: state.hidden.filter((h) => h !== action.id) };
    }
    case "send-start": {
      return startSend(state, action.id, action.requestId);
    }
    case "send-ok": {
      const next = onReply(state, action.id, action.requestId, (entry) =>
        settle(state, entry, action.result)
      );
      return wroteAt(state, next, action.at);
    }
    case "send-failed": {
      return onReply(state, action.id, action.requestId, (entry) =>
        fail(state, entry, action.definite === true)
      );
    }
    case "adopt": {
      return adopt(state, action.persisted);
    }
    case "resume": {
      return readyWhere(state, (entry) => entry.status === "waiting");
    }
    case "retry": {
      return readyWhere(
        state,
        (entry) =>
          (entry.status === "waiting" || entry.status === "failed") &&
          (action.id === undefined || entry.id === action.id)
      );
    }
    default: {
      return state;
    }
  }
};

const syncStateOf = (entry: OutboxEntry): SyncState =>
  entry.status === "failed" ? "failed" : "pending";

const visible = (entry: OutboxEntry) =>
  entry.op !== "delete" || entry.status === "failed";

const newestFirst = (a: BabyEvent, b: BabyEvent) =>
  Date.parse(b.startedAt) - Date.parse(a.startedAt);

export const deriveEvents = (state: EventsState): BabyEvent[] => {
  const result: BabyEvent[] = [];
  const onServer = new Set<string>();

  for (const event of state.server) {
    onServer.add(event.id);
    const entry = state.outbox[event.id];
    if (!entry) {
      result.push(event);
    } else if (visible(entry)) {
      const base = entry.detached
        ? applyChanges(event, { ...entry.sentPatch, ...entry.patch })
        : entry.event;
      result.push({ ...base, id: event.id, syncState: syncStateOf(entry) });
    }
  }

  for (const entry of Object.values(state.outbox)) {
    if (onServer.has(entry.id) || entry.detached || !visible(entry)) continue;
    result.push({ ...entry.event, syncState: syncStateOf(entry) });
  }

  const hidden = new Set(state.hidden);
  return result.filter((e) => !hidden.has(e.id)).toSorted(newestFirst);
};

export const unsavedCounts = (state: EventsState) => {
  let failed = 0;
  let queued = 0;
  for (const entry of Object.values(state.outbox)) {
    // A ready entry is normally sent within a tick; one that stays ready is
    // blocked (no baby known yet) and is as unsaved as a waiting one.
    if (entry.status === "failed") failed += 1;
    else if (entry.status === "waiting" || entry.status === "ready") {
      queued += 1;
    }
  }
  return { failed, queued };
};

/** Changes the person would lose if this page closed right now, pending
 * discards included. */
export const unsavedTotal = (state: EventsState) =>
  Object.keys(state.outbox).length +
  state.hidden.filter((id) => !state.outbox[id]).length;
