"use client";

/**
 * The one copy of the event outbox for this browser tab.
 *
 * The dashboard, history and station layouts each mount their own
 * `BabyContextProvider`, so the outbox cannot live in component state: it
 * would die on every tab switch. It lives here, at module scope, so every
 * provider in the tab shares it, and every change is written to localStorage
 * before `dispatchOutbox` returns, so a reload or a closed app loses nothing.
 *
 * If a write fails (storage full, blocked, private mode) the outbox keeps
 * working for this page and `isOutboxDurable()` turns false, so the sync
 * status can tell the person their unsaved entries are not stored.
 *
 * Each tab keeps its own key (`bubsie_outbox:<user>:<tab>`) and holds the
 * Web Lock of the same name for as long as it is open. Ownership is never
 * inferred, always held:
 * - a tab reads or writes its own key only once it holds that key's lock,
 *   so a tab duplicated from this one (which copies the tab id) cannot get
 *   it and starts a key of its own;
 * - a tab adopts another tab's key only while holding that key's lock, which
 *   it can only get once that tab has gone, so a discard still inside its
 *   undo window in a live tab is never committed elsewhere.
 * Without Web Locks a closed tab cannot be told from an open one, so nothing
 * is adopted.
 */

import type {
  BabyEvent,
  EventsAction,
  EventsState,
  OutboxEntry,
  PersistedOutbox,
} from "./event-outbox";
import {
  eventsReducer,
  initialEventsState,
  isEmptyOutbox,
  toPersisted,
  unsavedTotal,
} from "./event-outbox";
import { RequestRefusedError, gqlRequest } from "./gql-request";

const KEY_PREFIX = "bubsie_outbox:";
const TAB_ID_KEY = "bubsie_outbox_tab";
/** The lock that owns a key: named after the person and the tab. */
const lockFor = (user: string, tab: string) => `bubsie-outbox:${user}:${tab}`;

const LOG_EVENT = `
  mutation LogEvent(
    $id: String
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
      id: $id
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
  /** Not sent: no network, or the previously deployed worker queued it. That
   * worker's copy is never replayed (see register-sw.ts), so this page sends
   * it again. */
  | { kind: "unsent" }
  | { kind: "failed"; definite: boolean };

const sendEntry = async (
  entry: OutboxEntry,
  requestId: string,
  forBaby: string | null
): Promise<SendResult> => {
  // An update carries what send-start moved into it, not what has changed
  // since (that goes in the next request).
  const { event, id, op, sentPatch: patch } = entry;
  try {
    if (op === "delete") {
      const data = await gqlRequest<{ deleteEvent: boolean } | null>(
        DELETE_EVENT,
        { clientMutationId: requestId, id }
      );
      return data ? { event: null, kind: "ok" } : { kind: "unsent" };
    }

    if (op === "create") {
      const data = await gqlRequest<{ logEvent: BabyEvent } | null>(LOG_EVENT, {
        babyId: forBaby,
        clientMutationId: requestId,
        id,
        startedAt: event.startedAt,
        type: event.type,
        ...(event.endedAt ? { endedAt: event.endedAt } : {}),
        [`${event.type}Meta`]: JSON.parse(event.metadata),
      });
      return data ? { event: data.logEvent, kind: "ok" } : { kind: "unsent" };
    }

    const data = await gqlRequest<{ updateEvent: BabyEvent } | null>(
      UPDATE_EVENT,
      {
        clientMutationId: requestId,
        id,
        ...(patch.meta ? { [`${event.type}Meta`]: patch.meta } : {}),
        ...(patch.startedAt ? { startedAt: patch.startedAt } : {}),
        ...(patch.endedAt === undefined ? {} : { endedAt: patch.endedAt }),
      }
    );
    return data ? { event: data.updateEvent, kind: "ok" } : { kind: "unsent" };
  } catch (error) {
    return { definite: error instanceof RequestRefusedError, kind: "failed" };
  }
};

/* ── State ─────────────────────────────────────────────────── */

let state: EventsState = initialEventsState;
const listeners = new Set<() => void>();
let owner: string | null = null;
let tabId: string | null = null;
let babyId: string | null = null;
let sendingAllowed = false;
let releaseTab: (() => void) | null = null;
let flushScheduled = false;
/** Whether the last write of this tab's outbox reached storage. */
let durable = true;
/** Whether this tab owns its key yet (holds its lock, or has no locks). */
let ownsKey = false;

const storageKey = (user = owner, tab = tabId) =>
  user && tab ? `${KEY_PREFIX}${user}:${tab}` : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readPersisted = (key: string): PersistedOutbox | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !isRecord(parsed) ||
      parsed.v !== 1 ||
      !isRecord(parsed.outbox) ||
      !Array.isArray(parsed.hidden)
    ) {
      return null;
    }
    return parsed as unknown as PersistedOutbox;
  } catch {
    return null;
  }
};

/** Write this tab's outbox. Returns whether it reached storage. */
const write = (): boolean => {
  const key = storageKey();
  // Until this tab owns its key, changes wait in memory (a few milliseconds
  // at start-up) and are written as soon as it does.
  if (!key || !ownsKey) return true;
  const persisted = toPersisted(state);
  try {
    if (isEmptyOutbox(persisted)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(persisted));
    durable = true;
  } catch {
    // Storage full or blocked. The outbox still works for this page, and
    // the sync status warns that unsaved entries are not stored.
    durable = false;
  }
  return durable;
};

const notify = () => {
  for (const listener of listeners) listener();
};

export const dispatchOutbox = (action: EventsAction) => {
  const before = state;
  state = eventsReducer(state, action);
  if (state === before) return;
  if (state.outbox !== before.outbox || state.hidden !== before.hidden) {
    write();
  }
  notify();
};

export const getOutboxState = () => state;

export const isOutboxDurable = () => durable;

export const getServerOutboxState = () => initialEventsState;

export const subscribeOutbox = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* ── Sending ───────────────────────────────────────────────── */

const send = async (id: string, requestId: string, forBaby: string | null) => {
  const entry = state.outbox[id];
  if (!entry) return;
  const result = await sendEntry(entry, requestId, forBaby);
  if (result.kind === "ok") {
    dispatchOutbox({
      at: Date.now(),
      id,
      requestId,
      result: result.event,
      type: "send-ok",
    });
  } else {
    dispatchOutbox({
      definite: result.kind === "failed" && result.definite,
      id,
      requestId,
      type: "send-failed",
    });
  }
};

/** Claims each ready entry synchronously (it becomes `sending` before this
 * returns), so a second caller can never pick up the same entry. */
const flush = () => {
  if (!sendingAllowed) return;
  const forBaby = babyId;
  for (const entry of Object.values(state.outbox)) {
    if (entry.status !== "ready") continue;
    // A create waits until the provider knows which baby it is for.
    if (entry.op === "create" && !forBaby) continue;
    const requestId = crypto.randomUUID();
    dispatchOutbox({ id: entry.id, requestId, type: "send-start" });
    void send(entry.id, requestId, forBaby);
  }
};

const scheduleFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    flush();
  });
};

// Every change may make an entry ready to send.
listeners.add(scheduleFlush);

export const setOutboxBaby = (id: string) => {
  babyId = id;
  scheduleFlush();
};

/** The network may be back: send what was waiting. Called on start, when
 * the browser comes online or the page becomes visible, and after every
 * successful poll. */
export const resumeOutbox = () => {
  dispatchOutbox({ type: "resume" });
};

/* ── Tabs ──────────────────────────────────────────────────── */

const readTabId = (): string => {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

const newTabId = (): string => {
  const created = crypto.randomUUID();
  try {
    sessionStorage.setItem(TAB_ID_KEY, created);
  } catch {
    /* this tab keeps the id in memory only */
  }
  return created;
};

const ownerKeys = (user: string) => {
  const prefix = `${KEY_PREFIX}${user}:`;
  const keys: { key: string; tab: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keys.push({ key, tab: key.slice(prefix.length) });
      }
    }
  } catch {
    /* storage unavailable: nothing to adopt */
  }
  return keys;
};

/** Move a closed tab's entries into this tab's outbox. The closed tab's copy
 * is removed only once ours is safely written; otherwise this tab leaves it
 * where it is, durable, for a later attempt. */
const adoptKey = (key: string) => {
  const persisted = readPersisted(key);
  if (!persisted) return;
  const before = state;
  state = eventsReducer(state, { persisted, type: "adopt" });
  if (!write()) {
    state = before;
    notify();
    return;
  }
  notify();
  try {
    localStorage.removeItem(key);
  } catch {
    /* a leftover copy is adopted again later; resends are idempotent */
  }
};

/** Adopt every outbox of this user whose tab has gone, holding each one's
 * lock while doing so: a lock that cannot be had means its tab is open. */
const adoptOrphans = async (locks: LockManager, user: string) => {
  const adoptIfFree = (key: string) => (lock: Lock | null) => {
    if (lock && owner === user) adoptKey(key);
  };
  for (const { key, tab } of ownerKeys(user)) {
    if (tab === tabId) continue;
    await locks.request(
      lockFor(user, tab),
      { ifAvailable: true },
      adoptIfFree(key)
    );
  }
};

/** Hold a key's lock for as long as the page lives. Resolves `false` if a
 * live tab already holds it (a duplicated tab copies sessionStorage). */
// Promise.withResolvers would read better but needs Safari 17.4.
// oxlint-disable promise/avoid-new -- a lock is held until a promise settles
const holdLock = (locks: LockManager, name: string) =>
  new Promise<boolean>((resolve) => {
    void locks.request(name, { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      if (!lock) return;
      return new Promise<null>((_resolve) => {
        releaseTab = () => _resolve(null);
      });
    });
  });
// oxlint-enable promise/avoid-new

/** This tab now owns its key: merge what an earlier page left in it with
 * what this page has recorded since, and write the result. */
const loadOwnKey = () => {
  ownsKey = true;
  const key = storageKey();
  const own = key ? readPersisted(key) : null;
  if (own) state = eventsReducer(state, { persisted: own, type: "adopt" });
  write();
  notify();
};

/** Take ownership of this tab's key, then of any key whose tab has gone. */
const claimKeys = async (user: string) => {
  const { locks } = navigator;
  if (locks && !(await holdLock(locks, lockFor(user, tabId as string)))) {
    // A live tab owns this key: it was copied with the tab. Use our own.
    tabId = newTabId();
    await holdLock(locks, lockFor(user, tabId));
  }
  if (owner !== user) return;
  loadOwnKey();
  if (locks) await adoptOrphans(locks, user);
};

/** Load this tab's outbox for the signed-in user and start sending. Safe to
 * call from every provider mount; only a change of user does any work. */
export const startOutbox = (user: string | null) => {
  if (!user || user === owner || typeof window === "undefined") return;
  releaseTab?.();
  releaseTab = null;
  sendingAllowed = false;
  ownsKey = false;
  owner = user;
  tabId = readTabId();
  state = initialEventsState;
  durable = true;
  notify();
  void (async () => {
    try {
      await claimKeys(user);
    } catch {
      // Locks refused: behave as a browser without them.
      if (!ownsKey) loadOwnKey();
    }
    if (owner !== user) return;
    sendingAllowed = true;
    scheduleFlush();
    resumeOutbox();
  })();
};

/** Pick up outboxes left by tabs that have since closed. */
export const adoptClosedTabs = () => {
  if (!owner || !sendingAllowed || !navigator.locks) return;
  const { locks } = navigator;
  const user = owner;
  void (async () => {
    try {
      await adoptOrphans(locks, user);
    } catch {
      /* tried again on the next visit */
    }
  })();
};

/* ── Signing out ───────────────────────────────────────────── */

/** Before the person signs out: commit pending discards (the undo window
 * ends with the session), try to send everything, and resolve with how many
 * changes are still unsent once nothing is in flight, or after `withinMs`. */
export const sendBeforeSignOut = (withinMs: number): Promise<number> => {
  for (const id of state.hidden) dispatchOutbox({ id, type: "delete" });
  dispatchOutbox({ type: "retry" });
  // oxlint-disable-next-line promise/avoid-new -- resolves on a store change or a timeout
  return new Promise((resolve) => {
    // Filled in below: finish() and check() refer to each other's handles.
    const handles: {
      timer?: ReturnType<typeof setTimeout>;
      unsubscribe?: () => void;
    } = {};
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(handles.timer);
      handles.unsubscribe?.();
      // oxlint-disable-next-line promise/no-multiple-resolved -- `done` makes this run once
      resolve(unsavedTotal(state));
    };
    const check = () => {
      // After the flush that follows every change, so ready entries that can
      // be sent are already sending.
      queueMicrotask(() => {
        const inFlight = Object.values(state.outbox).some(
          (entry) => entry.status === "sending"
        );
        if (!inFlight) finish();
      });
    };
    handles.timer = setTimeout(finish, withinMs);
    handles.unsubscribe = subscribeOutbox(check);
    check();
  });
};

/** The person chose to sign out with this tab's changes unsent: remove
 * them, and only them. Other tabs' outboxes are theirs (this tab holds no
 * lock on them); they stay keyed to this person and are adopted the next
 * time they sign in on this device. */
export const forgetOutbox = () => {
  const key = ownsKey ? storageKey() : null;
  releaseTab?.();
  releaseTab = null;
  owner = null;
  ownsKey = false;
  sendingAllowed = false;
  state = initialEventsState;
  if (key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing more can be done for it */
    }
  }
  notify();
};
