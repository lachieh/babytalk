import type { BabyEvent, EventsAction, EventsState } from "./event-outbox";
import {
  canRecord,
  deriveEvents,
  eventsReducer,
  initialEventsState,
  toPersisted,
  unsavedCounts,
  unsavedTotal,
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

  it("keeps a refused create visible as failed, and retry sends it again", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1", true),
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

  it("sends a delete for a refused create, since a refusal proves nothing was stored only for that request", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1", true),
      { id: "e1", type: "delete" },
    ]);
    expect(state.outbox.e1).toMatchObject({ op: "delete", status: "ready" });
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
    expect(state.outbox.mine).toMatchObject({
      op: "delete",
      status: "waiting",
    });
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
    const state = run([edit, start("old", "r1"), ok("old", "r1", null)]);
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
        failed("e1", "r1", true),
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
      [
        { id: "e1", type: "delete" },
        start("e1", "r1"),
        failed("e1", "r1", true),
      ],
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

describe("a request that did not get through", () => {
  const offline = run([
    { event: feed("e1"), type: "create" },
    start("e1", "r1"),
    failed("e1", "r1"),
  ]);

  it("stays pending and is counted as waiting to save", () => {
    expect(shown(offline)[0].syncState).toBe("pending");
    expect(unsavedCounts(offline)).toStrictEqual({ failed: 0, queued: 1 });
  });

  it("is sent again when the network may be back, but not before", () => {
    expect(run([start("e1", "r2")], offline).outbox.e1.status).toBe("waiting");
    const resumed = run([{ type: "resume" }, start("e1", "r2")], offline);
    expect(resumed.outbox.e1).toMatchObject({
      requestId: "r2",
      status: "sending",
    });
  });

  it("does not resend what the server refused until the person retries", () => {
    const refused = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1", true),
      { type: "resume" },
    ]);
    expect(refused.outbox.e1.status).toBe("failed");
    expect(run([{ type: "retry" }], refused).outbox.e1.status).toBe("ready");
  });

  it("puts the changes it carried back into the next request", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      { changes: { meta: { amountMl: 90 } }, id: "e1", type: "update" },
      failed("e1", "r1"),
    ]);
    expect(state.outbox.e1.patch).toStrictEqual({
      endedAt: nine,
      meta: { amountMl: 90 },
    });
  });
});

describe("a request carries only unconfirmed changes", () => {
  it("does not resend a confirmed stop with a later amount", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", "2026-11-21T03:10:00.000Z"),
      start("e1", "r1"),
      {
        changes: { meta: { amountMl: 90, method: "bottle" } },
        id: "e1",
        type: "update",
      },
      ok("e1", "r1", feed("e1", { endedAt: "2026-11-21T03:10:00.000Z" })),
    ]);
    expect(state.outbox.e1).toMatchObject({
      patch: { meta: { amountMl: 90, method: "bottle" } },
      status: "ready",
    });
  });

  it("still sends a field that changed again while the request was out", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      stop("e1", ten),
      ok("e1", "r1", feed("e1", { endedAt: nine })),
    ]);
    expect(state.outbox.e1.patch).toStrictEqual({ endedAt: ten });
  });
});

describe("outbox that outlives the page", () => {
  it("keeps a timer started and stopped offline as one stopped event", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
      stop("e1", nine),
    ]);
    const after = reload(before);
    expect(after.outbox.e1).toMatchObject({ op: "create", status: "ready" });
    expect(after.outbox.e1.event.endedAt).toBe(nine);
    expect(shown(after)).toStrictEqual([
      { endedAt: nine, id: "e1", syncState: "pending" },
    ]);
  });

  it("keeps an undo of a create that may have reached the server", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
      { id: "e1", type: "delete" },
    ]);
    const after = reload(before);
    expect(after.outbox.e1).toMatchObject({ op: "delete" });
    expect(shown(after)).toStrictEqual([]);
  });

  it("keeps refused entries so they can still be retried", () => {
    const before = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1", true),
    ]);
    expect(unsavedCounts(reload(before)).failed).toBe(1);
  });

  it("resends a request that was in flight, with the changes made since", () => {
    const before = run([
      { events: [feed("e1")], type: "loaded" },
      stop("e1", nine),
      start("e1", "r1"),
      stop("e1", ten),
    ]);
    const after = reload(before);
    expect(after.outbox.e1).toMatchObject({
      patch: { endedAt: ten },
      requestId: null,
      status: "ready",
    });
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

describe("a refusal after an unanswered attempt", () => {
  it("still deletes a create that an earlier attempt may have stored", () => {
    const state = run([
      { event: feed("e1"), type: "create" },
      start("e1", "r1"),
      failed("e1", "r1"),
      { type: "resume" },
      start("e1", "r2"),
      failed("e1", "r2", true),
      { id: "e1", type: "delete" },
    ]);
    expect(state.outbox.e1).toMatchObject({ op: "delete", status: "ready" });
  });
});

describe("deleting twice", () => {
  it("leaves nothing behind once the delete is confirmed", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "delete" },
      start("e1", "r1"),
      { id: "e1", type: "delete" },
      ok("e1", "r1", null),
    ]);
    expect(state.outbox).toStrictEqual({});
  });

  it("survives a reload with the second delete outstanding", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "delete" },
      start("e1", "r1"),
      { id: "e1", type: "delete" },
      ok("e1", "r1", null),
      start("e1", "r2"),
    ]);
    const after = reload(state);
    expect(Object.keys(after.outbox)).not.toContain("undefined");
    for (const [key, entry] of Object.entries(after.outbox)) {
      expect(entry.id).toBe(key);
    }
  });

  it("never adopts an entry stored under a key that is not its id", () => {
    const after = eventsReducer(initialEventsState, {
      persisted: {
        hidden: [],
        outbox: { undefined: { status: "ready" } as never },
        v: 1,
      },
      type: "adopt",
    });
    expect(after.outbox).toStrictEqual({});
  });
});

describe("what the sync status counts", () => {
  it("counts a restored entry that cannot be sent yet as waiting", () => {
    const state = run([{ event: feed("e1"), type: "create" }]);
    expect(unsavedCounts(state)).toStrictEqual({ failed: 0, queued: 1 });
  });

  it("counts a pending discard as unsaved", () => {
    const state = run([
      { events: [feed("e1")], type: "loaded" },
      { id: "e1", type: "hide" },
    ]);
    expect(unsavedTotal(state)).toBe(1);
  });
});
