/**
 * Unconfirmed changes to events, as a pure reducer.
 *
 * Every event has its final id from the moment it is logged: the page picks
 * a UUID and the server stores the row under it. A retried create is the
 * same event by id however it has been edited since, so nothing here ever
 * matches events by their contents.
 *
 * Each event has at most one request outstanding. A change made while one is
 * in flight waits for it to resolve, so writes for an event reach the server
 * in the order they were made, across reloads.
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
 * - ready: needs a request, nothing outstanding
 * - sending: this page is waiting for the reply
 * - queued: the service worker holds the request
 * - unknown: an earlier page sent it and never learned the outcome; the
 *   worker's report decides whether it is still pending
 * - failed: the last request failed; nothing outstanding
 */
export type OutboxStatus =
  | "ready"
  | "sending"
  | "queued"
  | "unknown"
  | "failed";

/** Whether the server may hold a row with this id. */
type Exists = "no" | "maybe" | "yes";

export interface OutboxEntry {
  id: string;
  op: Op;
  event: BabyEvent;
  /** Every change since the entry began; resending it is harmless. */
  patch: EventChanges;
  status: OutboxStatus;
  exists: Exists;
  version: number;
  /** The version the outstanding (or last) request carried. */
  sentVersion: number;
  sentOp: Op | null;
  requestId: string | null;
  /** When this page learned the worker holds the request. */
  queuedAt: number;
  /** A change to a saved event this page has not loaded (an older week). */
  detached: boolean;
}

/** The part of the state that must outlive the page. */
export interface PersistedOutbox {
  v: 2;
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
  | { type: "send-queued"; id: string; requestId: string; at: number }
  | {
      type: "send-failed";
      id: string;
      requestId: string;
      /** The server answered and refused, so nothing was stored. */
      definite?: boolean;
    }
  | {
      type: "worker-synced";
      requestId: string;
      result?: BabyEvent | null;
      at?: number;
    }
  | { type: "worker-failed"; requestId: string }
  /** What the worker still holds, as of `at`. */
  | { type: "worker-report"; pending: string[]; at: number }
  | { type: "adopt"; persisted: PersistedOutbox }
  | { type: "retry"; id: string }
  | { type: "retry-failed" };

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

const entryForRequest = (state: EventsState, requestId: string) =>
  Object.values(state.outbox).find((entry) => entry.requestId === requestId);

const outstanding = (entry: OutboxEntry) =>
  entry.status === "sending" ||
  entry.status === "queued" ||
  entry.status === "unknown";

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
  queuedAt: 0,
  requestId: null,
  sentOp: null,
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

/** The outstanding request succeeded. Send what changed meanwhile, if
 * anything; otherwise the entry is done. */
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

const fail = (
  state: EventsState,
  entry: OutboxEntry,
  definite: boolean
): EventsState => {
  const exists = definite && entry.sentOp === "create" ? "no" : entry.exists;
  if (entry.op === "delete" && exists === "no") {
    return dropEntry(state, entry.id);
  }
  return putEntry(state, {
    ...entry,
    exists,
    requestId: null,
    status: "failed",
  });
};

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
      status: entry.status === "failed" ? "ready" : entry.status,
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
  // Never sent, or the server refused it: there is nothing to delete.
  if (entry.exists === "no" && !outstanding(entry)) {
    return dropEntry(state, id);
  }
  return putEntry(state, {
    ...entry,
    op: "delete",
    status: outstanding(entry) ? entry.status : "ready",
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
  // A create that may already be stored keeps the version of its first
  // send: if it was, the server keeps that copy and ignores this one, so
  // later edits still have to follow as an update.
  const resentCreate = entry.op === "create" && entry.exists === "maybe";
  return putEntry(state, {
    ...entry,
    exists: entry.op === "create" ? "maybe" : entry.exists,
    requestId,
    sentOp: entry.op,
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

const onWorkerReply = (
  state: EventsState,
  requestId: string,
  change: (entry: OutboxEntry) => EventsState
): EventsState => {
  const entry = entryForRequest(state, requestId);
  const waiting = entry?.status === "queued" || entry?.status === "unknown";
  return entry && waiting ? change(entry) : state;
};

/** A request the worker no longer holds, in a report taken after this page
 * learned it was queued, will never be replayed: send the next one. */
const workerReport = (state: EventsState, pending: string[], at: number) => {
  const held = new Set(pending);
  let next = state;
  for (const entry of Object.values(state.outbox)) {
    const lost =
      (entry.status === "queued" || entry.status === "unknown") &&
      at > entry.queuedAt &&
      !(entry.requestId && held.has(entry.requestId));
    if (lost) {
      next = putEntry(next, { ...entry, requestId: null, status: "ready" });
    }
  }
  return next;
};

export const toPersisted = (state: EventsState): PersistedOutbox => ({
  hidden: state.hidden,
  outbox: state.outbox,
  v: 2,
});

export const isEmptyOutbox = (persisted: PersistedOutbox) =>
  Object.keys(persisted.outbox).length === 0 && persisted.hidden.length === 0;

export const hasRequest = (state: EventsState, requestId: string) =>
  entryForRequest(state, requestId) !== undefined;

/** Take over entries written by an earlier page (a reload, a closed tab). A
 * request that was in flight keeps its id and waits for the worker's report;
 * a discard whose undo window was cut short is committed. */
const adopt = (state: EventsState, persisted: PersistedOutbox): EventsState => {
  let next = state;
  for (const entry of Object.values(persisted.outbox)) {
    if (next.outbox[entry.id]) continue;
    next = putEntry(next, {
      ...entry,
      status: entry.status === "sending" ? "unknown" : entry.status,
    });
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

const retryWhere = (
  state: EventsState,
  test: (entry: OutboxEntry) => boolean
): EventsState => {
  let next = state;
  for (const entry of Object.values(state.outbox)) {
    if (entry.status === "failed" && test(entry)) {
      next = putEntry(next, { ...entry, status: "ready" });
    }
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

type ReplyAction = Extract<
  EventsAction,
  {
    type:
      | "send-ok"
      | "send-queued"
      | "send-failed"
      | "worker-synced"
      | "worker-failed"
      | "worker-report";
  }
>;

const replyReducer = (state: EventsState, action: ReplyAction): EventsState => {
  switch (action.type) {
    case "send-ok": {
      const next = onReply(state, action.id, action.requestId, (entry) =>
        settle(state, entry, action.result)
      );
      return wroteAt(state, next, action.at);
    }
    case "send-queued": {
      return onReply(state, action.id, action.requestId, (entry) =>
        putEntry(state, { ...entry, queuedAt: action.at, status: "queued" })
      );
    }
    case "send-failed": {
      return onReply(state, action.id, action.requestId, (entry) =>
        fail(state, entry, action.definite === true)
      );
    }
    case "worker-synced": {
      const next = onWorkerReply(state, action.requestId, (entry) =>
        settle(state, entry, action.result ?? null)
      );
      return wroteAt(state, next, action.at);
    }
    case "worker-failed": {
      return onWorkerReply(state, action.requestId, (entry) =>
        fail(state, entry, true)
      );
    }
    case "worker-report": {
      return workerReport(state, action.pending, action.at);
    }
    default: {
      return state;
    }
  }
};

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
    case "send-ok":
    case "send-queued":
    case "send-failed":
    case "worker-synced":
    case "worker-failed":
    case "worker-report": {
      return replyReducer(state, action);
    }
    case "adopt": {
      return adopt(state, action.persisted);
    }
    case "retry": {
      return retryWhere(state, (entry) => entry.id === action.id);
    }
    case "retry-failed": {
      return retryWhere(state, () => true);
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
        ? applyChanges(event, entry.patch)
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
    if (entry.status === "failed") failed += 1;
    else if (entry.status === "queued" || entry.status === "unknown") {
      queued += 1;
    }
  }
  return { failed, queued };
};

/** Entries the person would lose if this page closed right now. */
export const unsavedTotal = (state: EventsState) =>
  Object.keys(state.outbox).length;
