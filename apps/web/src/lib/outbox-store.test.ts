/* The outbox store against fake browser storage and Web Locks. Sending is
 * stubbed out: these tests are about what is kept, adopted and reported. */

const sent = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock(import("./gql-request"), () => ({
  GraphQLResponseError: class extends Error {},
  gqlRequest: (_query: string, variables?: Record<string, unknown>) => {
    sent.push(variables ?? {});
    return Promise.withResolvers<never>().promise;
  },
}));

const USER = "parent-a";
const keyFor = (tab: string) => `bubsie_outbox:${USER}:${tab}`;

const fakeStorage = (refuse: (key: string) => boolean = () => false) => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    items,
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      if (refuse(key)) throw new DOMException("full", "QuotaExceededError");
      items.set(key, value);
    },
  };
};

type LockTask = (lock: { name: string } | null) => unknown;

const fakeLocks = (alreadyHeld: string[] = []) => {
  const held = new Set(alreadyHeld);
  const request = async (
    name: string,
    options: { ifAvailable?: boolean } | LockTask,
    maybeTask?: LockTask
  ) => {
    const task = (maybeTask ?? options) as LockTask;
    const ifAvailable =
      typeof options === "object" && options.ifAvailable === true;
    if (held.has(name) && ifAvailable) return await task(null);
    held.add(name);
    try {
      return await task({ name });
    } finally {
      held.delete(name);
    }
  };
  return {
    query: () => Promise.resolve({ held: [...held].map((name) => ({ name })) }),
    request,
  };
};

const pendingEntry = (id: string) => ({
  detached: false,
  event: {
    endedAt: null,
    id,
    metadata: "{}",
    startedAt: "2026-11-21T03:00:00.000Z",
    type: "feed",
  },
  exists: "no",
  id,
  op: "create",
  patch: {},
  queuedAt: 0,
  requestId: null,
  sentOp: null,
  sentVersion: 0,
  status: "ready",
  version: 1,
});

const persisted = (outbox: Record<string, unknown>, hidden: string[] = []) =>
  JSON.stringify({ hidden, outbox, v: 1 });

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

const loadStore = async ({
  local,
  locks,
}: {
  local: ReturnType<typeof fakeStorage>;
  locks?: ReturnType<typeof fakeLocks>;
}) => {
  vi.resetModules();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", fakeStorage());
  vi.stubGlobal("navigator", locks ? { locks } : {});
  const store = await import("./outbox-store");
  store.startOutbox(USER);
  await settle();
  return store;
};

describe("outbox store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("adopting a closed tab's outbox", () => {
    it("keeps the closed tab's copy when this tab cannot store it", async () => {
      const local = fakeStorage((key) => !key.endsWith(":dead"));
      local.items.set(keyFor("dead"), persisted({ e1: pendingEntry("e1") }));
      const store = await loadStore({ local, locks: fakeLocks() });
      expect(local.items.has(keyFor("dead"))).toBeTruthy();
      expect(store.isOutboxDurable()).toBeFalsy();
    });

    it("moves the closed tab's entries here when there is room", async () => {
      const local = fakeStorage();
      local.items.set(keyFor("dead"), persisted({ e1: pendingEntry("e1") }));
      const store = await loadStore({ local, locks: fakeLocks() });
      expect(local.items.has(keyFor("dead"))).toBeFalsy();
      expect(Object.keys(store.getOutboxState().outbox)).toStrictEqual(["e1"]);
      expect(store.isOutboxDurable()).toBeTruthy();
    });

    it("leaves a tab that is still open alone", async () => {
      const local = fakeStorage();
      local.items.set(keyFor("alive"), persisted({ e1: pendingEntry("e1") }));
      const store = await loadStore({
        local,
        locks: fakeLocks(["bubsie-outbox-tab:alive"]),
      });
      expect(local.items.has(keyFor("alive"))).toBeTruthy();
      expect(store.getOutboxState().outbox).toStrictEqual({});
    });
  });

  describe("a browser without Web Locks", () => {
    it("does not treat another tab as closed and commit its pending discard", async () => {
      const local = fakeStorage();
      const other = persisted({}, ["e-shown-in-tab-a"]);
      local.items.set(keyFor("tab-a"), other);
      const store = await loadStore({ local });
      expect(local.items.get(keyFor("tab-a"))).toBe(other);
      expect(store.getOutboxState().outbox).toStrictEqual({});
    });
  });

  describe("storage that refuses writes", () => {
    it("reports that unsaved entries are not stored", async () => {
      const local = fakeStorage(() => true);
      const store = await loadStore({ local, locks: fakeLocks() });
      expect(store.isOutboxDurable()).toBeTruthy();
      store.dispatchOutbox({
        event: pendingEntry("e1").event,
        type: "create",
      });
      expect(store.isOutboxDurable()).toBeFalsy();
    });

    it("recovers once a write succeeds again", async () => {
      let full = true;
      const local = fakeStorage(() => full);
      const store = await loadStore({ local, locks: fakeLocks() });
      store.dispatchOutbox({ event: pendingEntry("e1").event, type: "create" });
      full = false;
      store.dispatchOutbox({ event: pendingEntry("e2").event, type: "create" });
      expect(store.isOutboxDurable()).toBeTruthy();
    });
  });

  describe("sending", () => {
    it("sends the changes the request is meant to carry", async () => {
      sent.length = 0;
      const store = await loadStore({
        local: fakeStorage(),
        locks: fakeLocks(),
      });
      store.dispatchOutbox({
        events: [pendingEntry("e1").event],
        type: "loaded",
      });
      store.dispatchOutbox({
        changes: { endedAt: "2026-11-21T03:10:00.000Z" },
        id: "e1",
        type: "update",
      });
      await settle();
      expect(sent).toContainEqual(
        expect.objectContaining({
          endedAt: "2026-11-21T03:10:00.000Z",
          id: "e1",
        })
      );
    });
  });
});
