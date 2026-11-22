import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { runInNewContext } from "node:vm";

/* Runs the real public/sw.js against in-memory stand-ins for Cache Storage,
 * the network and the open pages. Cache reads and writes yield to the event
 * loop, as the real ones do, so unco-ordinated read-modify-writes race. */

const API = "https://api.test/graphql";
const WORKER_SOURCE = readFileSync(
  join(import.meta.dirname, "../../public/sw.js"),
  "utf8"
);

const tick = () => sleep(0);

const token = (sub: string, tag = "") =>
  `Bearer h.${Buffer.from(JSON.stringify({ sub, tag })).toString("base64url")}.s`;

interface Sent {
  authorization: string | null;
  body: { variables: { clientMutationId: string } };
}

type Reply = (sent: Sent) => Response | Promise<Response>;

const json = (value: unknown, status = 200) => Response.json(value, { status });

const createWorker = (source = WORKER_SOURCE) => {
  const stores = new Map<string, Map<string, string>>();
  const listeners = new Map<string, (event: unknown) => void>();
  const pages: unknown[][] = [];
  const sent: Sent[] = [];
  let reply: Reply | null = null;

  const caches = {
    delete: async (name: string) => {
      await tick();
      return stores.delete(name);
    },
    has: async (name: string) => {
      await tick();
      return stores.has(name);
    },
    keys: () => Promise.resolve([...stores.keys()]),
    match: () => Promise.resolve(null),
    open: async (name: string) => {
      await tick();
      const store = stores.get(name) ?? new Map<string, string>();
      stores.set(name, store);
      return {
        match: async (path: string) => {
          await tick();
          const body = store.get(path);
          return body === undefined ? undefined : new Response(body);
        },
        put: async (path: string, response: Response) => {
          const body = await response.text();
          await tick();
          store.set(path, body);
        },
      };
    },
  };

  const fetch = async (input: string | Request, init?: RequestInit) => {
    if (input instanceof Request) throw new TypeError("offline");
    const headers = new Headers(init?.headers);
    const request: Sent = {
      authorization: headers.get("Authorization"),
      body: JSON.parse(String(init?.body)) as Sent["body"],
    };
    sent.push(request);
    if (!reply) throw new TypeError("offline");
    return await reply(request);
  };

  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, listener);
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () =>
        Promise.resolve(
          pages.map((inbox) => ({
            postMessage: (message: unknown) => inbox.push(message),
          }))
        ),
    },
    navigator: {},
    registration: {},
    skipWaiting: () => Promise.resolve(),
  };

  runInNewContext(source, {
    Response,
    URL,
    atob,
    caches,
    console,
    fetch,
    self,
  });

  const read = (path: string, cache = "bubsie-queue") =>
    JSON.parse(stores.get(cache)?.get(path) ?? "[]") as Record<
      string,
      unknown
    >[];

  return {
    /** A page queues a mutation while the network is down. */
    enqueue: (id: string, authorization = token("parent-a")) => {
      let response: Promise<Response> | undefined;
      const request = new Request(API, {
        body: JSON.stringify({
          query: "mutation LogEvent { logEvent { id } }",
          variables: { clientMutationId: id },
        }),
        headers: { Authorization: authorization },
        method: "POST",
      });
      listeners.get("fetch")?.({
        request,
        respondWith: (p: Promise<Response>) => {
          response = p;
        },
      });
      return (response as Promise<Response>).then((r) => r.json());
    },
    message: async (data: unknown) => {
      const pending: Promise<unknown>[] = [];
      listeners.get("message")?.({
        data,
        waitUntil: (p: Promise<unknown>) => pending.push(p),
      });
      await Promise.all(pending);
    },
    openPage: () => {
      const inbox: unknown[] = [];
      pages.push(inbox);
      return inbox;
    },
    queueIds: () => read("/queue").map((item) => item.id),
    read,
    seed: (cache: string, path: string, value: unknown) => {
      const store = stores.get(cache) ?? new Map<string, string>();
      store.set(path, JSON.stringify(value));
      stores.set(cache, store);
    },
    sent,
    setReply: (next: Reply | null) => {
      reply = next;
    },
    activate: async () => {
      const pending: Promise<unknown>[] = [];
      listeners.get("activate")?.({
        waitUntil: (p: Promise<unknown>) => pending.push(p),
      });
      await Promise.all(pending);
    },
  };
};

const synced = (sent: Sent) =>
  json({
    data: { logEvent: { id: `srv-${sent.body.variables.clientMutationId}` } },
  });

describe("service worker queue", () => {
  it("keeps both of two requests queued at the same moment", async () => {
    const worker = createWorker();
    const answers = await Promise.all([
      worker.enqueue("a"),
      worker.enqueue("b"),
    ]);
    expect(answers).toStrictEqual([
      expect.objectContaining({ queued: true }),
      expect.objectContaining({ queued: true }),
    ]);
    expect(worker.queueIds().toSorted()).toStrictEqual(["a", "b"]);
  });

  it("keeps a request queued while a replay is in flight", async () => {
    const worker = createWorker();
    await worker.enqueue("a");
    const reached = Promise.withResolvers<boolean>();
    const answer = Promise.withResolvers<Response>();
    worker.setReply((sent) => {
      reached.resolve(true);
      return answer.promise.then(() => synced(sent));
    });
    const replay = worker.message({ type: "SYNC_NOW" });
    await reached.promise;
    await worker.enqueue("b");
    answer.resolve(new Response());
    await replay;
    expect(worker.queueIds()).toStrictEqual(["b"]);
  });

  it("holds a request whose session expired until a fresh one arrives", async () => {
    const worker = createWorker();
    const page = worker.openPage();
    await worker.enqueue("a", token("parent-a", "old"));
    worker.setReply((sent) =>
      sent.authorization === token("parent-a", "fresh")
        ? synced(sent)
        : json({ data: null, errors: [{ message: "Not authenticated" }] })
    );

    await worker.message({ type: "SYNC_NOW" });
    expect(worker.read("/queue")).toMatchObject([{ id: "a", retries: 0 }]);
    expect(page).not.toContainEqual(
      expect.objectContaining({ type: "MUTATION_FAILED" })
    );

    await worker.message({
      authorization: token("parent-a", "fresh"),
      type: "SYNC_NOW",
    });
    expect(worker.sent.at(-1)?.authorization).toBe(token("parent-a", "fresh"));
    expect(worker.queueIds()).toStrictEqual([]);
    expect(page).toContainEqual(
      expect.objectContaining({
        data: { logEvent: { id: "srv-a" } },
        id: "a",
        type: "MUTATION_SYNCED",
      })
    );
  });

  it("never sends a request with another person's session", async () => {
    const worker = createWorker();
    await worker.enqueue("a", token("parent-a"));
    worker.setReply(() => json({ errors: [{ message: "Not authenticated" }] }));
    await worker.message({
      authorization: token("parent-b"),
      type: "SYNC_NOW",
    });
    expect(worker.sent.map((s) => s.authorization)).toStrictEqual([
      token("parent-a"),
    ]);
    expect(worker.queueIds()).toStrictEqual(["a"]);
  });

  it("keeps a request through server errors", async () => {
    const worker = createWorker();
    await worker.enqueue("a");
    worker.setReply(() => json({ errors: [{ message: "boom" }] }, 503));
    for (let i = 0; i < 5; i += 1) await worker.message({ type: "SYNC_NOW" });
    expect(worker.read("/queue")).toMatchObject([{ id: "a", retries: 5 }]);
  });

  it("reports a rejection to a page that opens later, until acknowledged", async () => {
    const worker = createWorker();
    await worker.enqueue("a");
    worker.setReply(() =>
      json({ data: null, errors: [{ message: "Event not found" }] })
    );
    await worker.message({ type: "SYNC_NOW" });
    expect(worker.queueIds()).toStrictEqual([]);

    const page = worker.openPage();
    await worker.message({ type: "SYNC_NOW" });
    expect(page.at(-1)).toMatchObject({
      pending: [],
      results: [{ id: "a", type: "MUTATION_FAILED" }],
      type: "QUEUE_REPORT",
    });

    await worker.message({ ids: ["a"], type: "ACK_RESULTS" });
    await worker.message({ type: "SYNC_NOW" });
    expect(page.at(-1)).toMatchObject({ results: [], type: "QUEUE_REPORT" });
  });

  it("replays a queue written by the previous worker", async () => {
    const worker = createWorker();
    const legacyItem = (id: string) => ({
      authorization: token("parent-a"),
      body: {
        query: "mutation LogEvent { logEvent { id } }",
        variables: { clientMutationId: id },
      },
      id,
      retries: 1,
      timestamp: Date.now(),
      url: API,
    });
    worker.seed("bubsie-queue", "/queue", [legacyItem("old")]);
    worker.seed("babytalk-queue", "/queue", [legacyItem("older")]);
    await worker.activate();
    expect(worker.queueIds()).toStrictEqual(["old", "older"]);

    const page = worker.openPage();
    worker.setReply(synced);
    await worker.message("SYNC_NOW");
    expect(worker.queueIds()).toStrictEqual([]);
    expect(page.at(-1)).toMatchObject({
      pending: [],
      results: [
        { id: "old", type: "MUTATION_SYNCED" },
        { id: "older", type: "MUTATION_SYNCED" },
      ],
    });
  });
});
