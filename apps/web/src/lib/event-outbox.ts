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

type Op = "create" | "update" | "delete";

export type OutboxStatus = "ready" | "sending" | "queued" | "synced" | "failed";

/** The create request exactly as it was first sent. Resending it unchanged
 * lets the server recognise a create it already stored, and lets the page
 * match the stored copy, however the entry has been edited since. */
export interface SentCreate {
  event: BabyEvent;
  version: number;
}

export interface OutboxEntry {
  key: string;
  serverId: string | null;
  op: Op;
  event: BabyEvent;
  patch: EventChanges;
  status: OutboxStatus;
  version: number;
  sentVersion: number;
  sentOp: Op | null;
  sentCreate: SentCreate | null;
  /** A change to a saved event this page has not loaded (an older week). */
  detached: boolean;
  requestId: string | null;
}

/** The part of the state that must outlive the page. */
export interface PersistedOutbox {
  aliases: Record<string, string>;
  hidden: string[];
  outbox: Record<string, OutboxEntry>;
}

export interface EventsState {
  server: BabyEvent[];
  outbox: Record<string, OutboxEntry>;
  aliases: Record<string, string>;
  hidden: string[];
  lastWriteAt: number;
}

export type EventsAction =
  | {
      type: "loaded";
      events: BabyEvent[];
      requestedAt?: number;
    }
  | { type: "create"; event: BabyEvent }
  | { type: "update"; id: string; changes: EventChanges; eventType?: string }
  | { type: "delete"; id: string }
  | { type: "hide"; id: string }
  | { type: "unhide"; id: string }
  | { type: "send-start"; key: string; requestId: string }
  | {
      type: "send-ok";
      key: string;
      requestId: string;
      result: BabyEvent | null;
      at?: number;
    }
  | { type: "send-queued"; key: string; requestId: string }
  | {
      type: "send-failed";
      key: string;
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
  | { type: "worker-report"; pending: string[] }
  | { type: "adopt"; persisted: PersistedOutbox }
  | { type: "retry"; id: string }
  | { type: "retry-failed" };

export const initialEventsState: EventsState = {
  aliases: {},
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

const withoutKey = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _removed, ...rest } = record;
  return rest;
};

const upsert = (events: BabyEvent[], event: BabyEvent) =>
  events.some((e) => e.id === event.id)
    ? events.map((e) => (e.id === event.id ? event : e))
    : [event, ...events];

const sameMoment = (a: BabyEvent, b: BabyEvent) =>
  a.type === b.type && Date.parse(a.startedAt) === Date.parse(b.startedAt);

const findEntry = (state: EventsState, id: string): OutboxEntry | undefined => {
  const target = state.aliases[id] ?? id;
  return (
    state.outbox[target] ??
    Object.values(state.outbox).find((entry) => entry.serverId === target)
  );
};

const putEntry = (state: EventsState, entry: OutboxEntry): EventsState => ({
  ...state,
  outbox: { ...state.outbox, [entry.key]: entry },
});

const dropEntry = (state: EventsState, key: string): EventsState => ({
  ...state,
  outbox: withoutKey(state.outbox, key),
});

const entryForRequest = (state: EventsState, requestId: string) =>
  Object.values(state.outbox).find((entry) => entry.requestId === requestId);

export const isLocalId = (id: string) => id.startsWith("local-");

/** With no server id yet, the only request that can be sent is the create. */
export const opToSend = (entry: OutboxEntry): Op =>
  entry.serverId ? entry.op : "create";

export const createPayload = (entry: OutboxEntry): BabyEvent =>
  entry.sentCreate?.event ?? entry.event;

const settle = (
  state: EventsState,
  entry: OutboxEntry,
  confirmed: BabyEvent | null
): EventsState => {
  if (entry.version > entry.sentVersion) {
    return putEntry(state, {
      ...entry,
      op: entry.op === "create" ? "update" : entry.op,
      requestId: null,
      status: "ready",
    });
  }
  const next = dropEntry(state, entry.key);
  if (entry.op === "delete" && entry.serverId) {
    const { serverId } = entry;
    return { ...next, server: next.server.filter((e) => e.id !== serverId) };
  }
  const { syncState: _sync, ...sent } = entry.event;
  const known = entry.serverId && !entry.detached;
  const saved =
    confirmed ?? (known ? { ...sent, id: entry.serverId as string } : null);
  return saved ? { ...next, server: upsert(next.server, saved) } : next;
};

const fail = (
  state: EventsState,
  entry: OutboxEntry,
  definite: boolean
): EventsState => {
  const sentCreate =
    definite && entry.sentOp === "create" ? null : entry.sentCreate;
  if (!entry.serverId && !sentCreate && entry.op === "delete") {
    return dropEntry(state, entry.key);
  }
  return putEntry(state, {
    ...entry,
    requestId: null,
    sentCreate,
    status: "failed",
  });
};

const adoptStoredCreates = (state: EventsState): EventsState => {
  const entries = Object.values(state.outbox);
  const claimed = new Set(entries.map((e) => e.serverId));
  let next = state;
  for (const entry of entries) {
    const sent = entry.sentCreate?.event;
    const unmatched =
      !entry.serverId &&
      (entry.status === "synced" || entry.status === "failed");
    const match =
      unmatched && sent
        ? state.server.find((e) => !claimed.has(e.id) && sameMoment(e, sent))
        : undefined;
    if (match) {
      claimed.add(match.id);
      const aliased = {
        ...next,
        aliases: { ...next.aliases, [entry.key]: match.id },
      };
      next = settle(aliased, { ...entry, serverId: match.id }, null);
    }
  }
  return next;
};

const newEntry = (
  event: BabyEvent,
  op: Op,
  serverId: string | null,
  patch: EventChanges = {},
  detached = false
): OutboxEntry => ({
  detached,
  event,
  key: event.id,
  op,
  patch,
  requestId: null,
  sentCreate: null,
  sentOp: null,
  sentVersion: 0,
  serverId,
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

const serverEvent = (state: EventsState, id: string) => {
  const target = state.aliases[id] ?? id;
  return state.server.find((e) => e.id === target);
};

const update = (
  state: EventsState,
  id: string,
  changes: EventChanges,
  eventType: string | undefined
): EventsState => {
  const entry = findEntry(state, id);
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
  if (current) {
    return putEntry(
      state,
      newEntry(applyChanges(current, changes), "update", current.id, changes)
    );
  }
  const target = state.aliases[id] ?? id;
  if (isLocalId(target)) return state;
  const base = applyChanges(placeholder(target, eventType), changes);
  return putEntry(state, newEntry(base, "update", target, changes, true));
};

const remove = (state: EventsState, id: string): EventsState => {
  const entry = findEntry(state, id);
  if (!entry) {
    const current = serverEvent(state, id);
    if (current)
      return putEntry(state, newEntry(current, "delete", current.id));
    const target = state.aliases[id] ?? id;
    if (isLocalId(target)) return state;
    return putEntry(
      state,
      newEntry(placeholder(target), "delete", target, {}, true)
    );
  }
  if (!entry.serverId && !entry.sentCreate) {
    return dropEntry(state, entry.key);
  }
  const waiting =
    entry.status === "sending" ||
    entry.status === "queued" ||
    entry.status === "synced";
  return putEntry(state, {
    ...entry,
    op: "delete",
    status: waiting ? entry.status : "ready",
    version: entry.version + 1,
  });
};

const confirm = (
  state: EventsState,
  key: string,
  requestId: string,
  result: BabyEvent | null
): EventsState => {
  const entry = state.outbox[key];
  if (!entry || entry.requestId !== requestId) return state;
  if (entry.sentOp === "create" && result) {
    const aliased = {
      ...state,
      aliases: { ...state.aliases, [entry.key]: result.id },
    };
    return settle(aliased, { ...entry, serverId: result.id }, result);
  }
  return settle(state, entry, result);
};

const workerSynced = (
  state: EventsState,
  requestId: string,
  result: BabyEvent | null
) => {
  const entry = entryForRequest(state, requestId);
  if (!entry || entry.status !== "queued") return state;
  if (entry.sentOp === "create") {
    if (result) return confirm(state, entry.key, requestId, result);
    // A worker that predates result reporting: match on the next load.
    return adoptStoredCreates(putEntry(state, { ...entry, status: "synced" }));
  }
  return settle(state, entry, result);
};

/** Queued entries whose request the worker neither holds nor has a result
 * for were lost (worker replaced, storage cleared): send them again. Every
 * mutation is idempotent on the server, so a resend cannot duplicate. */
const workerReport = (state: EventsState, pending: string[]) => {
  const held = new Set(pending);
  let next = state;
  for (const entry of Object.values(state.outbox)) {
    const lost =
      (entry.status === "queued" || entry.status === "synced") &&
      !(entry.requestId && held.has(entry.requestId));
    if (lost) {
      next = putEntry(next, { ...entry, requestId: null, status: "ready" });
    }
  }
  return next;
};

const startSend = (
  state: EventsState,
  key: string,
  requestId: string
): EventsState => {
  const entry = state.outbox[key];
  if (!entry) return state;
  const op = opToSend(entry);
  const sentCreate =
    op === "create"
      ? (entry.sentCreate ?? { event: entry.event, version: entry.version })
      : entry.sentCreate;
  return putEntry(state, {
    ...entry,
    requestId,
    sentCreate,
    sentOp: op,
    sentVersion:
      op === "create" ? (sentCreate as SentCreate).version : entry.version,
    status: "sending",
  });
};

/** Only the links that a pending entry or discard still refers to. */
export const toPersisted = (state: EventsState): PersistedOutbox => {
  const referenced = new Set([...Object.keys(state.outbox), ...state.hidden]);
  const aliases = Object.fromEntries(
    Object.entries(state.aliases).filter(([from]) => referenced.has(from))
  );
  return { aliases, hidden: state.hidden, outbox: state.outbox };
};

export const isEmptyOutbox = (persisted: PersistedOutbox) =>
  Object.keys(persisted.outbox).length === 0 && persisted.hidden.length === 0;

export const hasRequest = (state: EventsState, requestId: string) =>
  entryForRequest(state, requestId) !== undefined;

/** Take over entries written by an earlier page (a reload, another tab that
 * has closed). A request that was in flight has an unknown outcome, so it is
 * sent again; a discard whose undo window was cut short is committed. */
const adopt = (state: EventsState, persisted: PersistedOutbox): EventsState => {
  let next: EventsState = {
    ...state,
    aliases: { ...persisted.aliases, ...state.aliases },
  };
  for (const entry of Object.values(persisted.outbox)) {
    if (next.outbox[entry.key]) continue;
    const inFlight = entry.status === "sending";
    next = putEntry(next, {
      ...entry,
      requestId: inFlight ? null : entry.requestId,
      status: inFlight ? "ready" : entry.status,
    });
  }
  for (const id of persisted.hidden) next = remove(next, id);
  return adoptStoredCreates(next);
};

/** Whether the change can be recorded at all. A caller that gets `false`
 * must tell the person it was not saved. */
export const canRecord = (
  state: EventsState,
  action: Extract<EventsAction, { type: "update" | "delete" }>
): boolean => {
  const entry = findEntry(state, action.id);
  if (entry) return action.type === "delete" || entry.op !== "delete";
  return !isLocalId(state.aliases[action.id] ?? action.id);
};

const retryWhere = (
  state: EventsState,
  test: (entry: OutboxEntry) => boolean
): EventsState => {
  const outbox = { ...state.outbox };
  for (const entry of Object.values(state.outbox)) {
    if (entry.status === "failed" && test(entry)) {
      outbox[entry.key] = { ...entry, status: "ready" };
    }
  }
  return { ...state, outbox };
};

const onReply = (
  state: EventsState,
  key: string,
  requestId: string,
  change: (state: EventsState, entry: OutboxEntry) => EventsState
): EventsState => {
  const entry = state.outbox[key];
  return entry && entry.requestId === requestId ? change(state, entry) : state;
};

const sameEvent = (state: EventsState, a: string, b: string) =>
  a === b || (state.aliases[a] ?? a) === (state.aliases[b] ?? b);

const unhide = (state: EventsState, id: string): EventsState => ({
  ...state,
  hidden: state.hidden.filter((h) => !sameEvent(state, h, id)),
});

const wroteAt = (
  before: EventsState,
  after: EventsState,
  at: number | undefined
): EventsState =>
  after !== before && at !== undefined && at > after.lastWriteAt
    ? { ...after, lastWriteAt: at }
    : after;

const load = (
  state: EventsState,
  events: BabyEvent[],
  requestedAt: number | undefined
): EventsState =>
  requestedAt !== undefined && requestedAt < state.lastWriteAt
    ? state
    : adoptStoredCreates({ ...state, server: events });

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
      return wroteAt(
        state,
        confirm(state, action.key, action.requestId, action.result),
        action.at
      );
    }
    case "send-queued": {
      return onReply(state, action.key, action.requestId, (s, entry) =>
        putEntry(s, { ...entry, status: "queued" })
      );
    }
    case "send-failed": {
      return onReply(state, action.key, action.requestId, (s, entry) =>
        fail(s, entry, action.definite === true)
      );
    }
    case "worker-synced": {
      return wroteAt(
        state,
        workerSynced(state, action.requestId, action.result ?? null),
        action.at
      );
    }
    case "worker-failed": {
      const entry = entryForRequest(state, action.requestId);
      return entry?.status === "queued" ? fail(state, entry, true) : state;
    }
    case "worker-report": {
      return workerReport(state, action.pending);
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
      return load(state, action.events, action.requestedAt);
    }
    case "create": {
      return putEntry(state, newEntry(action.event, "create", null));
    }
    case "update": {
      return update(state, action.id, action.changes, action.eventType);
    }
    case "delete": {
      return remove(unhide(state, action.id), action.id);
    }
    case "hide": {
      return state.hidden.includes(action.id)
        ? state
        : { ...state, hidden: [...state.hidden, action.id] };
    }
    case "unhide": {
      return unhide(state, action.id);
    }
    case "send-start": {
      return startSend(state, action.key, action.requestId);
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
      const target = findEntry(state, action.id);
      return retryWhere(state, (entry) => entry === target);
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
  const entries = Object.values(state.outbox);
  const byServerId = new Map(
    entries.flatMap((e) => (e.serverId ? [[e.serverId, e] as const] : []))
  );
  const sentCreates = entries.flatMap((e) =>
    !e.serverId && e.sentCreate ? [e.sentCreate.event] : []
  );
  const shown = new Set<string>();
  const result: BabyEvent[] = [];

  for (const event of state.server) {
    const entry = byServerId.get(event.id);
    if (entry) {
      shown.add(entry.key);
      if (visible(entry)) {
        const base = entry.detached
          ? applyChanges(event, entry.patch)
          : entry.event;
        result.push({ ...base, id: event.id, syncState: syncStateOf(entry) });
      }
      continue;
    }
    if (sentCreates.some((sent) => sameMoment(sent, event))) continue;
    result.push(event);
  }

  for (const entry of entries) {
    if (shown.has(entry.key) || entry.detached || !visible(entry)) continue;
    result.push({
      ...entry.event,
      id: entry.serverId ?? entry.key,
      syncState: syncStateOf(entry),
    });
  }

  const hidden = new Set(state.hidden.map((id) => state.aliases[id] ?? id));
  return result
    .filter((event) => !hidden.has(state.aliases[event.id] ?? event.id))
    .toSorted(newestFirst);
};

export const unsavedCounts = (state: EventsState) => {
  let failed = 0;
  let queued = 0;
  for (const entry of Object.values(state.outbox)) {
    if (entry.status === "failed") failed += 1;
    else if (entry.status === "queued" || entry.status === "synced") {
      queued += 1;
    }
  }
  return { failed, queued };
};
