import type { Network, Sent } from "./testing/sw-harness";
import {
  API,
  createCaches,
  createWorker,
  json,
  offline,
  tick,
  token,
  workerSource,
} from "./testing/sw-harness";

/* A returning user: this build's page (the real outbox store and reducer)
 * while the previously deployed worker (main, f09c491) still controls it,
 * then the new worker taking over the same storage. */

const route = vi.hoisted(() => ({
  pageFetch: null as
    | null
    | ((url: string, init: RequestInit) => Promise<Response>),
}));

vi.mock(import("./gql-request"), () => {
  class RequestRefusedError extends Error {}
  return {
    RequestRefusedError,
    // The page's gqlRequest contract: data, a refusal, or a network error.
    gqlRequest: async (query: string, variables?: Record<string, unknown>) => {
      const response = await (
        route.pageFetch as NonNullable<typeof route.pageFetch>
      )(API, {
        body: JSON.stringify({ query, variables }),
        headers: { Authorization: token("parent-a", "page") },
        method: "POST",
      });
      const body = (await response.json()) as {
        data?: unknown;
        errors?: { message: string }[];
      };
      if (body.errors) throw new RequestRefusedError(body.errors[0].message);
      return body.data as never;
    },
  } as never;
});

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
};

/** The API: stores each create under its id, once. */
const fakeApi = () => {
  const rows = new Map<string, number>();
  const network: Network = (sent: Sent) => {
    const id =
      (sent.body.variables.id as string | undefined) ?? "from-old-page";
    rows.set(id, (rows.get(id) ?? 0) + 1);
    return json({
      data: {
        logEvent: {
          endedAt: null,
          id,
          metadata: "{}",
          startedAt: "2026-11-21T03:00:00.000Z",
          type: "feed",
        },
      },
    });
  };
  return { network, rows };
};

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i += 1) await tick();
  return check();
};

describe("a returning user while the previous worker still controls the page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is never left waiting on that worker, and nothing is sent twice", async () => {
    vi.resetModules();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.stubGlobal("navigator", {});

    const storage = createCaches();
    const api = fakeApi();
    const deployed = createWorker({
      source: workerSource("deployed"),
      storage,
    });
    deployed.setNetwork(offline);
    route.pageFetch = deployed.pageFetch;

    // An offline log left in the old worker's queue by the old page.
    storage.seed("bubsie-queue", "/queue", [
      {
        authorization: token("parent-a", "old-page"),
        body: {
          query: "mutation LogEvent { logEvent { id } }",
          variables: { babyId: "b" },
        },
        id: "old-worker-id",
        retries: 0,
        timestamp: Date.now(),
      },
    ]);

    const store = await import("./outbox-store");
    store.startOutbox("parent-a");
    store.setOutboxBaby("b");
    const event = {
      endedAt: null,
      id: "8a6f7d0e-2c1b-4b8a-9d3e-5f6a7b8c9d0e",
      metadata: "{}",
      startedAt: "2026-11-21T03:00:00.000Z",
      type: "feed",
    };
    store.dispatchOutbox({ event, type: "create" });

    // Offline: the old worker queues the request and answers "queued". The
    // page counts it as not sent rather than waiting for that worker.
    const entry = () => store.getOutboxState().outbox[event.id];
    await expect(
      until(() => entry()?.status === "waiting")
    ).resolves.toBeTruthy();
    expect(storage.read("bubsie-queue")).toHaveLength(2);

    // Back online: the page sends it itself, through the old worker.
    deployed.setNetwork(api.network);
    store.resumeOutbox();
    await expect(until(() => entry() === undefined)).resolves.toBeTruthy();
    expect(api.rows.get(event.id)).toBe(1);

    // The new worker takes over and drains the old queue: the old page's log
    // is replayed, this page's copy is not.
    const current = createWorker({ source: workerSource("current"), storage });
    current.setNetwork(api.network);
    await current.activate();
    await current.message({
      authorization: token("parent-a", "fresh"),
      type: "SET_API_URL",
      url: API,
    });
    expect(api.rows.get("from-old-page")).toBe(1);
    expect(api.rows.get(event.id)).toBe(1);
    expect(storage.stores.has("bubsie-queue")).toBeFalsy();
  });
});
