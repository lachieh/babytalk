import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { runInNewContext } from "node:vm";

/* Runs a service worker script against in-memory stand-ins for Cache
 * Storage, the network and the open pages. Cache reads and writes yield to
 * the event loop, as the real ones do. Workers created with the same `caches`
 * share storage, as an old and a new worker on one origin do. */

export const API = "https://api.test/graphql";

export const workerSource = (file: "current" | "deployed") =>
  readFileSync(
    file === "current"
      ? join(import.meta.dirname, "../../../public/sw.js")
      : join(import.meta.dirname, "sw-deployed-f09c491.js.txt"),
    "utf8"
  );

export const tick = () => sleep(0);

export const token = (sub: string, tag = "") =>
  `Bearer h.${Buffer.from(JSON.stringify({ sub, tag })).toString("base64url")}.s`;

export interface Sent {
  authorization: string | null;
  body: { query: string; variables: Record<string, unknown> };
}

/** How the network answers a request, or throws when it is offline. */
export type Network = (sent: Sent) => Response | Promise<Response>;

export const offline: Network = () => {
  throw new TypeError("offline");
};

export const createCaches = () => {
  const stores = new Map<string, Map<string, string>>();
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
  return {
    caches,
    read: (name: string, path = "/queue") =>
      JSON.parse(stores.get(name)?.get(path) ?? "[]") as Record<
        string,
        unknown
      >[],
    seed: (name: string, path: string, value: unknown) => {
      const store = stores.get(name) ?? new Map<string, string>();
      store.set(path, JSON.stringify(value));
      stores.set(name, store);
    },
    stores,
  };
};

const sentFrom = async (input: string | Request, init?: RequestInit) => {
  if (input instanceof Request) {
    return {
      authorization: input.headers.get("Authorization"),
      body: (await input.clone().json()) as Sent["body"],
    };
  }
  return {
    authorization: new Headers(init?.headers).get("Authorization"),
    body: JSON.parse(String(init?.body)) as Sent["body"],
  };
};

/** An install/activate/message event whose waitUntil promises can be awaited. */
const extendable = () => {
  const pending: Promise<unknown>[] = [];
  return {
    done: () => Promise.all(pending),
    waitUntil: (p: Promise<unknown>) => pending.push(p),
  };
};

export const createWorker = ({
  source,
  storage = createCaches(),
}: {
  source: string;
  storage?: ReturnType<typeof createCaches>;
}) => {
  const listeners = new Map<string, (event: unknown) => void>();
  const sent: Sent[] = [];
  let network: Network = offline;

  const fetch = async (input: string | Request, init?: RequestInit) => {
    const request = await sentFrom(input, init);
    sent.push(request);
    return await network(request);
  };

  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, listener);
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([]),
    },
    navigator: {},
    registration: {},
    skipWaiting: () => Promise.resolve(),
  };

  runInNewContext(source, {
    Response,
    URL,
    atob,
    caches: storage.caches,
    console,
    crypto,
    fetch,
    self,
  });

  return {
    activate: async () => {
      const event = extendable();
      listeners.get("activate")?.(event);
      await event.done();
    },
    /** A page's request through this worker's fetch handler, or straight to
     * the network if the worker leaves it alone. */
    pageFetch: async (url: string, init: RequestInit): Promise<Response> => {
      const request = new Request(url, init);
      let response: Promise<Response> | null = null;
      listeners.get("fetch")?.({
        request,
        respondWith: (p: Promise<Response>) => {
          response = p;
        },
      });
      return await (response ?? fetch(request));
    },
    message: async (data: unknown) => {
      const event = extendable();
      listeners.get("message")?.({ data, ...event });
      await event.done();
    },
    sent,
    setNetwork: (next: Network) => {
      network = next;
    },
    storage,
  };
};

export const json = (value: unknown, status = 200) =>
  Response.json(value, { status });
