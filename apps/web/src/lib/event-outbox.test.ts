import type { BabyEvent, EventsAction, EventsState } from "./event-outbox";
import {
  deriveEvents,
  eventsReducer,
  initialEventsState,
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

describe("optimistic create", () => {
  it("shows the event as pending before the server answers", () => {
    const state = run([{ event: feed("local-1"), type: "create" }]);
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "local-1", syncState: "pending" },
    ]);
  });

  it("swaps in the server copy once confirmed", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      {
        key: "local-1",
        requestId: "r1",
        result: feed("srv-1"),
        type: "send-ok",
      },
    ]);
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "srv-1", syncState: undefined },
    ]);
    expect(state.outbox).toStrictEqual({});
  });

  it("keeps a failed create visible as failed, and retry sends it again", () => {
    const failed = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { key: "local-1", requestId: "r1", type: "send-failed" },
    ]);
    expect(shown(failed)).toStrictEqual([
      { endedAt: null, id: "local-1", syncState: "failed" },
    ]);
    expect(unsavedCounts(failed)).toStrictEqual({
      failed: 1,
      queued: 0,
    });

    const retried = eventsReducer(failed, { id: "local-1", type: "retry" });
    expect(retried.outbox["local-1"].status).toBe("ready");
    expect(shown(retried)[0].syncState).toBe("pending");
  });

  it("survives a poll that does not include it yet", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      {
        events: [feed("old", { startedAt: "2026-11-21T01:00:00.000Z" })],
        type: "loaded",
      },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["local-1", "old"]);
  });

  it("does not show a duplicate when a poll returns the stored copy first", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { events: [feed("srv-1")], type: "loaded" },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["local-1"]);
  });
});

describe("failed create that the server did store", () => {
  it("is reconciled by the next load instead of being retried as a duplicate", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { key: "local-1", requestId: "r1", type: "send-failed" },
      { events: [feed("srv-1")], type: "loaded" },
    ]);
    expect(state.outbox).toStrictEqual({});
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "srv-1", syncState: undefined },
    ]);
  });
});

describe("changes while a create is in flight", () => {
  it("stopping a timer before its create returns sends the stop afterwards", () => {
    const stopped = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      {
        changes: { endedAt: "2026-11-21T03:18:00.000Z" },
        id: "local-1",
        type: "update",
      },
      {
        key: "local-1",
        requestId: "r1",
        result: feed("srv-1"),
        type: "send-ok",
      },
    ]);
    const entry = stopped.outbox["local-1"];
    expect(entry).toMatchObject({
      op: "update",
      patch: { endedAt: "2026-11-21T03:18:00.000Z" },
      serverId: "srv-1",
      status: "ready",
    });
    expect(shown(stopped)).toStrictEqual([
      {
        endedAt: "2026-11-21T03:18:00.000Z",
        id: "srv-1",
        syncState: "pending",
      },
    ]);
    const edited = eventsReducer(stopped, {
      changes: { meta: { amountMl: 60, method: "bottle" } },
      id: "local-1",
      type: "update",
    });
    expect(edited.outbox["local-1"].patch.meta).toStrictEqual({
      amountMl: 60,
      method: "bottle",
    });
  });

  it("undo before the create returns deletes it once the id is known", () => {
    const undone = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { id: "local-1", type: "delete" },
    ]);
    expect(shown(undone)).toStrictEqual([]);
    const confirmed = eventsReducer(undone, {
      key: "local-1",
      requestId: "r1",
      result: feed("srv-1"),
      type: "send-ok",
    });
    expect(confirmed.outbox["local-1"]).toMatchObject({
      op: "delete",
      serverId: "srv-1",
      status: "ready",
    });
    expect(shown(confirmed)).toStrictEqual([]);
  });

  it("deleting a create that never reached the server needs no request", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { key: "local-1", requestId: "r1", type: "send-failed" },
      { id: "local-1", type: "delete" },
    ]);
    expect(state.outbox).toStrictEqual({});
    expect(shown(state)).toStrictEqual([]);
  });

  it("ignores a reply to a request that has been superseded", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { key: "local-1", requestId: "stale", type: "send-failed" },
    ]);
    expect(state.outbox["local-1"].status).toBe("sending");
  });
});

describe("updates and deletes of saved events", () => {
  const saved = run([{ events: [feed("srv-1")], type: "loaded" }]);

  it("a failed stop keeps the stopped state, marked failed", () => {
    const state = run(
      [
        {
          changes: { endedAt: "2026-11-21T03:18:00.000Z" },
          id: "srv-1",
          type: "update",
        },
        { key: "srv-1", requestId: "r1", type: "send-start" },
        { key: "srv-1", requestId: "r1", type: "send-failed" },
        { events: [feed("srv-1")], type: "loaded" },
      ],
      saved
    );
    expect(shown(state)).toStrictEqual([
      { endedAt: "2026-11-21T03:18:00.000Z", id: "srv-1", syncState: "failed" },
    ]);
  });

  it("a failed delete brings the event back as failed", () => {
    const state = run(
      [
        { id: "srv-1", type: "delete" },
        { key: "srv-1", requestId: "r1", type: "send-start" },
        { key: "srv-1", requestId: "r1", type: "send-failed" },
      ],
      saved
    );
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "srv-1", syncState: "failed" },
    ]);
  });

  it("a confirmed delete removes it", () => {
    const state = run(
      [
        { id: "srv-1", type: "delete" },
        { key: "srv-1", requestId: "r1", type: "send-start" },
        { key: "srv-1", requestId: "r1", result: null, type: "send-ok" },
      ],
      saved
    );
    expect(shown(state)).toStrictEqual([]);
    expect(state.outbox).toStrictEqual({});
  });
});

describe("service worker queue", () => {
  const queued = run([
    { event: feed("local-1"), type: "create" },
    { key: "local-1", requestId: "r1", type: "send-start" },
    { key: "local-1", requestId: "r1", type: "send-queued" },
  ]);

  it("stays pending while the worker holds it", () => {
    expect(shown(queued)[0].syncState).toBe("pending");
    expect(unsavedCounts(queued)).toStrictEqual({
      failed: 0,
      queued: 1,
    });
  });

  it("adopts the server copy after the worker replays it", () => {
    const state = run(
      [
        { requestId: "r1", type: "worker-synced" },
        { events: [feed("srv-9")], type: "loaded" },
      ],
      queued
    );
    expect(state.outbox).toStrictEqual({});
    expect(state.aliases["local-1"]).toBe("srv-9");
    expect(shown(state)).toStrictEqual([
      { endedAt: null, id: "srv-9", syncState: undefined },
    ]);
  });

  it("sends changes made offline once the replayed create has an id", () => {
    const state = run(
      [
        {
          changes: { endedAt: "2026-11-21T03:18:00.000Z" },
          id: "local-1",
          type: "update",
        },
        { requestId: "r1", type: "worker-synced" },
        { events: [feed("srv-9")], type: "loaded" },
      ],
      queued
    );
    expect(state.outbox["local-1"]).toMatchObject({
      op: "update",
      serverId: "srv-9",
      status: "ready",
    });
    expect(shown(state)[0]).toStrictEqual({
      endedAt: "2026-11-21T03:18:00.000Z",
      id: "srv-9",
      syncState: "pending",
    });
  });

  it("marks it failed when the worker gives up, and retry creates it again", () => {
    const failed = eventsReducer(queued, {
      requestId: "r1",
      type: "worker-failed",
    });
    expect(shown(failed)[0].syncState).toBe("failed");
    const retried = eventsReducer(failed, { type: "retry-failed" });
    expect(retried.outbox["local-1"]).toMatchObject({
      op: "create",
      status: "ready",
    });
  });
});

describe("discard with undo", () => {
  it("hides a saved timer and brings back the same event on undo", () => {
    const saved = run([{ events: [feed("srv-1")], type: "loaded" }]);
    const hidden = run([{ id: "srv-1", type: "hide" }], saved);
    expect(shown(hidden)).toStrictEqual([]);
    expect(hidden.outbox).toStrictEqual({});

    const restored = run([{ id: "srv-1", type: "unhide" }], hidden);
    expect(shown(restored)).toStrictEqual([
      { endedAt: null, id: "srv-1", syncState: undefined },
    ]);
  });

  it("keeps a timer hidden when its temporary id is swapped for the server id", () => {
    const state = run([
      { event: feed("local-1"), type: "create" },
      { key: "local-1", requestId: "r1", type: "send-start" },
      { id: "local-1", type: "hide" },
      {
        key: "local-1",
        requestId: "r1",
        result: feed("srv-1"),
        type: "send-ok",
      },
      { events: [feed("srv-1")], type: "loaded" },
    ]);
    expect(shown(state)).toStrictEqual([]);
    expect(
      shown(run([{ id: "local-1", type: "unhide" }], state))
    ).toStrictEqual([{ endedAt: null, id: "srv-1", syncState: undefined }]);
  });

  it("queues the delete once the undo window closes", () => {
    const state = run([
      { events: [feed("srv-1")], type: "loaded" },
      { id: "srv-1", type: "hide" },
      { id: "srv-1", type: "delete" },
    ]);
    expect(state.hidden).toStrictEqual([]);
    expect(state.outbox["srv-1"]?.op).toBe("delete");
    expect(shown(state)).toStrictEqual([]);
  });
});

describe("a poll that started before a change was confirmed", () => {
  const stopped = "2026-11-21T03:20:00.000Z";

  it("does not put the old copy back on screen", () => {
    const state = run([
      { events: [feed("srv-1")], type: "loaded" },
      { changes: { endedAt: stopped }, id: "srv-1", type: "update" },
      { key: "srv-1", requestId: "r1", type: "send-start" },
      {
        at: 2000,
        key: "srv-1",
        requestId: "r1",
        result: feed("srv-1", { endedAt: stopped }),
        type: "send-ok",
      },
      { events: [feed("srv-1")], requestedAt: 1000, type: "loaded" },
    ]);
    expect(shown(state)).toStrictEqual([
      { endedAt: stopped, id: "srv-1", syncState: undefined },
    ]);
  });

  it("accepts a poll that started after the change was confirmed", () => {
    const state = run([
      { events: [feed("srv-1")], type: "loaded" },
      { changes: { endedAt: stopped }, id: "srv-1", type: "update" },
      { key: "srv-1", requestId: "r1", type: "send-start" },
      {
        at: 2000,
        key: "srv-1",
        requestId: "r1",
        result: null,
        type: "send-ok",
      },
      { events: [feed("srv-2")], requestedAt: 2000, type: "loaded" },
    ]);
    expect(shown(state).map((e) => e.id)).toStrictEqual(["srv-2"]);
  });
});
