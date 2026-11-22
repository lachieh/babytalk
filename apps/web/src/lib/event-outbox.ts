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
  requestId: string | null;
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
  | { type: "update"; id: string; changes: EventChanges }
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
  | { type: "send-failed"; key: string; requestId: string }
  | { type: "worker-synced"; requestId: string; at?: number }
  | { type: "worker-failed"; requestId: string }
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
  const saved =
    confirmed ?? (entry.serverId ? { ...sent, id: entry.serverId } : null);
  return saved ? { ...next, server: upsert(next.server, saved) } : next;
};

const fail = (state: EventsState, entry: OutboxEntry): EventsState => {
  const sentOp = entry.sentOp === "create" ? null : entry.sentOp;
  if (!entry.serverId && entry.op === "delete")
    return dropEntry(state, entry.key);
  return putEntry(state, {
    ...entry,
    requestId: null,
    sentOp,
    status: "failed",
  });
};

const adoptStoredCreates = (state: EventsState): EventsState => {
  const entries = Object.values(state.outbox);
  const claimed = new Set(entries.map((e) => e.serverId));
  let next = state;
  for (const entry of entries) {
    const unmatched =
      !entry.serverId &&
      (entry.status === "synced" ||
        (entry.status === "failed" && entry.op === "create"));
    const match = unmatched
      ? state.server.find(
          (e) => !claimed.has(e.id) && sameMoment(e, entry.event)
        )
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
  patch: EventChanges = {}
): OutboxEntry => ({
  event,
  key: event.id,
  op,
  patch,
  requestId: null,
  sentOp: null,
  sentVersion: 0,
  serverId,
  status: "ready",
  version: 1,
});

const serverEvent = (state: EventsState, id: string) => {
  const target = state.aliases[id] ?? id;
  return state.server.find((e) => e.id === target);
};

const update = (
  state: EventsState,
  id: string,
  changes: EventChanges
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
  if (!current) return state;
  return putEntry(
    state,
    newEntry(applyChanges(current, changes), "update", current.id, changes)
  );
};

const remove = (state: EventsState, id: string): EventsState => {
  const entry = findEntry(state, id);
  if (!entry) {
    const current = serverEvent(state, id);
    return current
      ? putEntry(state, newEntry(current, "delete", current.id))
      : state;
  }
  if (!entry.serverId && entry.sentOp === null) {
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

const workerSynced = (state: EventsState, requestId: string) => {
  const entry = entryForRequest(state, requestId);
  if (!entry || entry.status !== "queued") return state;
  if (entry.sentOp === "create") {
    return adoptStoredCreates(putEntry(state, { ...entry, status: "synced" }));
  }
  return settle(state, entry, null);
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
      return update(state, action.id, action.changes);
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
      const entry = state.outbox[action.key];
      if (!entry) return state;
      return putEntry(state, {
        ...entry,
        requestId: action.requestId,
        sentOp: entry.op,
        sentVersion: entry.version,
        status: "sending",
      });
    }
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
      return onReply(state, action.key, action.requestId, fail);
    }
    case "worker-synced": {
      return wroteAt(state, workerSynced(state, action.requestId), action.at);
    }
    case "worker-failed": {
      const entry = entryForRequest(state, action.requestId);
      return entry?.status === "queued" ? fail(state, entry) : state;
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
  const unconfirmedCreates = entries.filter((e) => !e.serverId);
  const shown = new Set<string>();
  const result: BabyEvent[] = [];

  for (const event of state.server) {
    const entry = byServerId.get(event.id);
    if (entry) {
      shown.add(entry.key);
      if (visible(entry)) {
        result.push({
          ...entry.event,
          id: event.id,
          syncState: syncStateOf(entry),
        });
      }
      continue;
    }
    if (unconfirmedCreates.some((e) => sameMoment(e.event, event))) continue;
    result.push(event);
  }

  for (const entry of entries) {
    if (shown.has(entry.key) || !visible(entry)) continue;
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
