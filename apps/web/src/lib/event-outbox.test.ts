import type { BabyEvent, EventsAction, EventsState } from "./event-outbox";
import {
  canRecord,
  deriveEvents,
  eventsReducer,
  initialEventsState,
  toPersisted,
  unsavedCounts,
} from "./event-outbox";

const run = (actions: EventsAction[], from = initialEventsState) => {
  let state = from;
  for (const action of actions) state = eventsReducer(state, action);
  return state;
};

const feed = (id: string, extra: Partial<BabyEvent> = {}): BabyEvent => ({
  endedAt: null,
  id,
  metadata: JSON.stringify({ method: "breast", side: "left" }),
  startedAt: "2026-11-21T03:00:00.000Z",
  type: "feed",
  ...extra,
});

const shown = (state: EventsState) =>
  deriveEvents(state).map(({ id, endedAt, syncState }) => ({
    endedAt,
    id,
    syncState,
  }));

const reload = (state: EventsState) =>
  eventsReducer(initialEventsState, {
    persisted: structuredClone(toPersisted(state)),
    type: "adopt",
  });

const start = (id: string, requestId: string): EventsAction => ({
  id,
  requestId,
  type: "send-start",
});
const ok = (id: string, requestId: string, result: BabyEvent | null) =>
  ({ id, requestId, result, type: "send-ok" }) as const;
const queued = (id: string, requestId: string, at = 1000) =>
  ({ at, id, requestId, type: "send-queued" }) as const;
const failed = (id: string, requestId: string, definite = false) =>
  ({ definite, id, requestId, type: "send-failed" }) as const;
const stop = (id: string, endedAt: string) =>
  ({ changes: { endedAt }, id, type: "update" }) as const;

const nine = "2026-11-21T09:00:00.000Z";
const ten = "2026-11-21T10:00:00.000Z";

describe("optimistic create", () => {
  it("shows the event under its own id before the server answers", () => {
    const state = run([{ event: feed("e1"), type: "create" }]);
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "e1", syncState: "pending" },
    ]);
  });

  it("is done once confirmed", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      ok("e1", "r1", feed("e1")),
    ]);
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "e1", syncState: undefined },
    ]);
    expect(state.outbox).toStrictEqual({});
  });

  it("keeps a failed create visible as failed, and retry sends it again", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
    ]);
    expect(shown(state)[0].syncState).toBe("failed");
    expect(unsavedCounts(state)).toStrictEqual({ failed: 1, queued: 0 });
    const retried = eventsReducer(state, { id: "e1", type: "retry" });
    expect(retried.outbox.e1.status).toBe("ready");
  });

  it("shows one event when a poll returns the stored copy first", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      { events: [feed("e1")], type: "loaded" },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["e1"]);
  });

  it("survives a poll that does not include it yet", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      {
        events: [feed("old", { startedAt: "2026-11-21T01:00:00.000Z" })],
        type: "loaded",
      },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["e1", "old"]);
  });
});

describe("changes while a request is outstanding", () => {
  it("sends a stop made during the create once the create returns", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      stop("e1", nine),
      ok("e1", "r1", feed("e1")),
    ]);
    expect(state.outbox.e1).toMatchObject({
      op: "update",
      patch: { endedAt: nine },
      status: "ready",
    });
    expect(shown(state)[0]).toMatchObject({ endedAt: nine });
  });

  it("does not start a second request while one is outstanding", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      stop("e1", nine),
      start("e1", "r2"),
    ]);
    expect(state.outbox.e1.requestId).toBe("r1");
  });

  it("deletes after an undo once the create returns", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      { id: "e1", type: "delete" },
      ok("e1", "r1", feed("e1")),
    ]);
    expect(state.outbox.e1).toMatchObject({ op: "delete", status: "ready" });
    expect(shown(state)).toStrictEqual([]);
  });

  it("needs no request to delete a create the server refused", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1", true),
      { id: "e1", type: "delete" },
    ]);
    expect(state.outbox).toStrictEqual({});
  });

  it("needs no request to delete a create that was never sent", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      { id: "e1", type: "delete" },
    ]);
    expect(state.outbox).toStrictEqual({});
  });

  it("ignores a reply to a request that has been superseded", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "stale"),
    ]);
    expect(state.outbox.e1.status).toBe("sending");
  });
});

describe("a create that may already be stored", () => {
  it("sends later edits as an update, since the server keeps its first copy", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
      stop("e1", nine),
      start("e1", "r2"),
      ok("e1", "r2", feed("e1")),
    ]);
    expect(state.outbox.e1).toMatchObject({
      op: "update",
      patch: { endedAt: nine },
      status: "ready",
    });
  });

  it("deletes by its own id and never touches another parent's event at the same moment", () => {
    const state = run([
      { event: feed("mine"), type: "create" },
      start("mine", "r1"),
      { id: "mine", type: "delete" },
      failed("mine", "r1"),
      { events: [feed("theirs")], type: "loaded" },
    ]);
    expect(Object.keys(state.outbox)).toStrictEqual(["mine"]);
    expect(state.outbox.mine).toMatchObject({ op: "delete", status: "failed" });
    expect(shown(state)).toContainEqual({
      endedAt: null,
      id: "theirs",
      syncState: undefined,
    });
  });
});

describe("events outside the recent cache", () => {
  const edit = {
    changes: { endedAt: nine, meta: { method: "bottle" } },
    eventType: "feed",
    id: "old",
    type: "update",
  } as const;

  it("records an edit to an event the cache has never loaded", () => {
    const state = run([{ events: [feed("e1")], type: "loaded" }, edit]);
    expect(canRecord(initialEventsState, edit)).toBeTruthy();
    expect(state.outbox.old).toMatchObject({
      detached: true,
      op: "update",
      patch: edit.changes,
      status: "ready",
    });
    expect(state.outbox.old.event.type).toBe("feed");
    expect(shown(state).map((e) => e.id)).toStrictEqual(["e1"]);
  });

  it("records a delete of an event the cache has never loaded", () => {
    const state = run([{ id: "old", type: "delete" }]);
    expect(state.outbox.old).toMatchObject({ detached: true, op: "delete" });
  });

  it("does not put a placeholder in the list once the edit is confirmed", () => {
    const state = run([
      edit,
      start("old", "r1"),
      queued("old", "r1"),
      { requestId: "r1", type: "worker-synced" },
    ]);
    expect(state.outbox).toStrictEqual({});
    expect(state.server).toStrictEqual([]);
  });

  it("refuses an edit to an event that is already being deleted", () => {
    const deleting = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "delete" },
    ]);
    expect(canRecord(deleting, stop("e1", nine))).toBeFalsy();
  });
});

describe("updates and deletes of saved events", () => {
  const saved = run([{ events: [feed("e1")], type: "loaded" }]);

  it("a failed stop keeps the stopped state, marked failed", () => {
    const state = run(
      [
        stop("e1", nine),
        start("e1", "r1"),
        failed("e1", "r1"),
        { events: [feed("e1")], type: "loaded" },
      ],
      saved
    );
    expect(shown(state)).toStrictEqual([
      { endedAt: nine, id: "e1", syncState: "failed" },
    ]);
  });

  it("a failed delete brings the event back as failed", () => {
    const state = run(
      [{ id: "e1", type: "delete" }, start("e1", "r1"), failed("e1", "r1")],
      saved
    );
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "e1", syncState: "failed" },
    ]);
  });

  it("a confirmed delete removes it", () => {
    const state = run(
      [{ id: "e1", type: "delete" }, start("e1", "r1"), ok("e1", "r1", null)],
      saved
    );
    expect(shown(state)).toStrictEqual([]);
    expect(state.outbox).toStrictEqual({});
  });
});

describe("service worker queue", () => {
  const held = run([
    { event: feed("e1"), type: "create" },
    start("e1", "r1"),
    queued("e1", "r1"),
  ]);

  it("stays pending while the worker holds it", () => {
    expect(shown(held)[0].syncState).toBe("pending");
    expect(unsavedCounts(held)).toStrictEqual({ failed: 0, queued: 1 });
  });

  it("is done once the worker replays it", () => {
    const state = run(
      [{ requestId: "r1", result: feed("e1"), type: "worker-synced" }],
      held
    );
    expect(state.outbox).toStrictEqual({});
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "e1", syncState: undefined },
    ]);
  });

  it("is done when a worker that predates result data replays it", () => {
    const state = run([{ requestId: "r1", type: "worker-synced" }], held);
    expect(state.outbox).toStrictEqual({});
    expect(shown(state).map((e) => e.id)).toStrictEqual(["e1"]);
  });

  it("sends an edit made while queued once the replay lands, even if the start time changed", () => {
    const state = run(
      [
        {
          changes: { startedAt: "2026-11-21T02:45:00.000Z" },
          id: "e1",
          type: "update",
        },
        { requestId: "r1", result: feed("e1"), type: "worker-synced" },
      ],
      held
    );
    expect(state.outbox.e1).toMatchObject({
      op: "update",
      patch: { startedAt: "2026-11-21T02:45:00.000Z" },
      status: "ready",
    });
    expect(unsavedCounts(state)).toStrictEqual({ failed: 0, queued: 0 });
  });

  it("marks it failed when the worker reports a rejection", () => {
    const state = eventsReducer(held, {
      requestId: "r1",
      type: "worker-failed",
    });
    expect(shown(state)[0].syncState).toBe("failed");
  });

  it("resends a request the worker no longer holds", () => {
    const state = eventsReducer(held, {
      at: 2000,
      pending: [],
      type: "worker-report",
    });
    expect(state.outbox.e1).toMatchObject({ requestId: null, status: "ready" });
  });

  it("leaves a request the worker still holds", () => {
    const state = eventsReducer(held, {
      at: 2000,
      pending: ["r1"],
      type: "worker-report",
    });
    expect(state).toBe(held);
  });

  it("ignores a report taken before the worker said it had the request", () => {
    const state = eventsReducer(held, {
      at: 900,
      pending: [],
      type: "worker-report",
    });
    expect(state).toBe(held);
  });
});

describe("outbox that outlives the page", () => {
  it("keeps a stop made offline and sends it once the create lands", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      queued("e1", "r1"),
      stop("e1", nine),
    ]);
    const after = run(
      [{ requestId: "r1", result: feed("e1"), type: "worker-synced" }],
      reload(before)
    );
    expect(after.outbox.e1).toMatchObject({
      op: "update",
      patch: { endedAt: nine },
      status: "ready",
    });
    expect(shown(after)).toStrictEqual([
      { endedAt: nine, id: "e1", syncState: "pending" },
    ]);
  });

  it("keeps an undo of a queued create", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      queued("e1", "r1"),
      { id: "e1", type: "delete" },
    ]);
    const after = run(
      [{ requestId: "r1", result: feed("e1"), type: "worker-synced" }],
      reload(before)
    );
    expect(after.outbox.e1).toMatchObject({ op: "delete", status: "ready" });
    expect(shown(after)).toStrictEqual([]);
  });

  it("keeps failed entries so they can still be retried", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
    ]);
    expect(unsavedCounts(reload(before)).failed).toBe(1);
  });

  it("waits for the worker before sending the next change to an event", () => {
    const before = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      stop("e1", ten),
    ]);
    const after = reload(before);
    expect(after.outbox.e1).toMatchObject({
      requestId: "r1",
      status: "unknown",
    });
    expect(run([start("e1", "r2")], after).outbox.e1.requestId).toBe("r1");

    const stillHeld = run(
      [{ at: 5000, pending: ["r1"], type: "worker-report" }],
      after
    );
    expect(stillHeld.outbox.e1.status).toBe("unknown");

    const replayed = run(
      [
        {
          requestId: "r1",
          result: feed("e1", { endedAt: nine }),
          type: "worker-synced",
        },
      ],
      stillHeld
    );
    expect(replayed.outbox.e1).toMatchObject({
      patch: { endedAt: ten },
      status: "ready",
    });
  });

  it("sends the next change once the worker shows it never had the request", () => {
    const before = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      stop("e1", ten),
    ]);
    const after = run(
      [{ at: 5000, pending: [], type: "worker-report" }],
      reload(before)
    );
    expect(after.outbox.e1).toMatchObject({ requestId: null, status: "ready" });
    expect(after.outbox.e1.event.endedAt).toBe(ten);
  });

  it("commits a pending discard the departing page could not send", () => {
    const before = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "hide" },
    ]);
    const after = run(
      [{ events: [feed("e1")], type: "loaded" }],
      reload(before)
    );
    expect(after.hidden).toStrictEqual([]);
    expect(after.outbox.e1).toMatchObject({ op: "delete", status: "ready" });
    expect(shown(after)).toStrictEqual([]);
  });

  it("does not let an adopted copy overwrite this page's own entry", () => {
    const mine = run([
      { event: feed("e1", { endedAt: nine }), type: "create" },
    ]);
    const old = run([{ event: feed("e1"), type: "create" }]);
    const merged = eventsReducer(mine, {
      persisted: toPersisted(old),
      type: "adopt",
    });
    expect(merged.outbox.e1.event.endedAt).toBe(nine);
  });
});

describe("discard with undo", () => {
  it("hides a saved timer and brings back the same event on undo", () => {
    const saved = run([{ events: [feed("e1")], type: "loaded" }]);
    const hidden = run([{ id: "e1", type: "hide" }], saved);
    expect(shown(hidden)).toStrictEqual([]);
    expect(hidden.outbox).toStrictEqual({});
    expect(shown(run([{ id: "e1", type: "unhide" }], hidden))).toStrictEqual([
      { endedAt: null, id: "e1", syncState: undefined },
    ]);
  });

  it("queues the delete once the undo window closes", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "hide" },
      { id: "e1", type: "delete" },
    ]);
    expect(state.hidden).toStrictEqual([]);
    expect(state.outbox.e1?.op).toBe("delete");
  });
});

describe("a poll that started before a change was confirmed", () => {
  it("does not put the old copy back on screen", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      { at: 2000, ...ok("e1", "r1", feed("e1", { endedAt: nine })) },
      { events: [feed("e1")], requestedAt: 1000, type: "loaded" },
    ]);
    expect(shown(state)).toStrictEqual([
      { endedAt: nine, id: "e1", syncState: undefined },
    ]);
  });

  it("accepts a poll that started after the change was confirmed", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      { at: 2000, ...ok("e1", "r1", null) },
      { events: [feed("e2")], requestedAt: 2000, type: "loaded" },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["e2"]);
  });
});
