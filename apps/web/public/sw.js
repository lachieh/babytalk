/// Service Worker for Bubsie PWA
/// Handles: offline caching, background sync for mutations

// Bumped to v2 to evict the v1 cache, which served stale HTML referencing
// content-hashed JS chunks that no longer exist after a deploy — leaving
// returning users with a blank page until they hard-refreshed.
const CACHE_NAME = "bubsie-v2";
const QUEUE_CACHE = "bubsie-queue";
const QUEUE_PATH = "/queue";
const RESULTS_PATH = "/results";
const MAX_QUEUE_SIZE = 100;
const MAX_RESULTS = 200;
const RESULT_TTL_MS = 7 * 86_400_000;
const STALE_DAYS = 7;

// API URL — set by the main thread via postMessage from the runtime config.
// Queued mutations wait until it arrives.
let configuredApiUrl = null;

// Install: take over as soon as possible. We intentionally skip pre-caching
// HTML routes — Next.js content-hashes its JS/CSS chunks per build, so a
// pre-cached HTML page from an old build references chunks that 404 after
// the next deploy.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Carry queued offline mutations over from the pre-rename cache.
function migrateLegacyQueue() {
  const legacyName = "babytalk-queue";
  return withStore(async () => {
    if (!(await caches.has(legacyName))) return;
    const legacy = await (await caches.open(legacyName)).match(QUEUE_PATH);
    if (legacy) {
      const items = await legacy.json();
      if (items.length > 0) {
        await writeJson(QUEUE_PATH, [
          ...(await readJson(QUEUE_PATH)),
          ...items,
        ]);
      }
    }
    await caches.delete(legacyName);
  });
}

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    migrateLegacyQueue()
      .catch(() => {})
      .then(() => caches.keys())
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== QUEUE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Mutations this worker is still handling: sent to the network and not yet
// answered, or being queued. A page that died mid-request learns from the
// report that its request may still land, and waits before sending the next.
const handling = new Set();

// Fetch strategies:
// - GraphQL API: network-first, queue mutations when offline
// - HTML navigations: network-only (never cache — see CACHE_NAME comment)
// - Hashed static assets (/_next/static/*): cache-first (immutable by hash)
// - Everything else: network with cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" && !request.url.includes("/graphql")) return;

  const url = new URL(request.url);

  // GraphQL API requests: network-first
  if (url.pathname.includes("/graphql")) {
    event.respondWith(
      // Read the body before the network attempt consumes the request.
      readQueueableBody(request).then((body) => {
        const id = body ? body.variables.clientMutationId : null;
        if (id) handling.add(id);
        return fetch(request)
          .catch(() => {
            if (body) {
              return queueMutation(body, request).then(
                () =>
                  new Response(
                    JSON.stringify({
                      data: null,
                      message: "Saved offline. Will sync when back online.",
                      queued: true,
                    }),
                    {
                      headers: { "Content-Type": "application/json" },
                    }
                  )
              );
            }
            return new Response(
              JSON.stringify({ errors: [{ message: "Offline" }] }),
              { headers: { "Content-Type": "application/json" } }
            );
          })
          .finally(() => {
            if (id) handling.delete(id);
          });
      })
    );
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    request.destination === "document" ||
    (request.headers.get("accept") || "").includes("text/html");

  // HTML navigations: always go to the network. Caching HTML is unsafe with
  // Next.js because the HTML embeds references to per-build, content-hashed
  // chunk filenames; serving a stale HTML after a deploy points at chunks
  // that have been removed from the server.
  if (isNavigation) {
    event.respondWith(fetch(request));
    return;
  }

  const isHashedStatic = url.pathname.startsWith("/_next/static/");

  // Hashed static assets are immutable, so cache-first is safe.
  if (isHashedStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (icons, manifest, etc.): network, fall back to cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || Response.error())
      )
  );
});

function isQueueableMutation(body) {
  const id = body && body.variables && body.variables.clientMutationId;
  const isMutation =
    typeof body.query === "string" && /^\s*mutation\b/.test(body.query);
  return typeof id === "string" && isMutation;
}

async function readQueueableBody(request) {
  if (request.method !== "POST") return null;
  try {
    const body = await request.clone().json();
    return isQueueableMutation(body) ? body : null;
  } catch {
    return null;
  }
}

/* ── Durable store ────────────────────────────────────────────
 * Two records in the queue cache: the queue of requests still to send
 * (same item format as earlier workers, so their queues replay unchanged)
 * and the results of requests that have finished, kept until a page
 * acknowledges them so an outcome is never lost for want of a listener.
 * Every read-modify-write goes through withStore, one at a time. */

let storeChain = Promise.resolve();

function withStore(task) {
  const locks = self.navigator && self.navigator.locks;
  const run = () => (locks ? locks.request("bubsie-queue", task) : task());
  const next = storeChain.then(run, run);
  storeChain = next.catch(() => {});
  return next;
}

async function readJson(path) {
  try {
    const cache = await caches.open(QUEUE_CACHE);
    const response = await cache.match(path);
    if (response) {
      const value = await response.json();
      if (Array.isArray(value)) return value;
    }
  } catch {}
  return [];
}

async function writeJson(path, value) {
  const cache = await caches.open(QUEUE_CACHE);
  await cache.put(
    path,
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Only call inside withStore.
async function addResults(results) {
  const now = Date.now();
  const kept = (await readJson(RESULTS_PATH)).filter(
    (r) => now - r.at < RESULT_TTL_MS && !results.some((n) => n.id === r.id)
  );
  await writeJson(RESULTS_PATH, [...kept, ...results].slice(-MAX_RESULTS));
}

async function queueMutation(body, request) {
  const id = body.variables.clientMutationId;
  const item = {
    authorization: request.headers.get("Authorization"),
    body,
    id,
    retries: 0,
    timestamp: Date.now(),
    url: request.url,
  };
  await withStore(async () => {
    const queue = (await readJson(QUEUE_PATH)).filter((i) => i.id !== id);
    queue.push(item);
    const dropped = queue.splice(0, Math.max(0, queue.length - MAX_QUEUE_SIZE));
    await writeJson(QUEUE_PATH, queue);
    if (dropped.length > 0) {
      const at = Date.now();
      await addResults(
        dropped.map((d) => ({ at, id: d.id, type: "MUTATION_FAILED" }))
      );
    }
  });
  try {
    await self.registration.sync?.register("bubsie-sync");
  } catch {}
}

/* ── Replay ─────────────────────────────────────────────────── */

// The newest session a page has handed over. Access tokens last 15 minutes,
// so the header captured when a request was queued is often expired.
let latestAuthorization = null;

function tokenSubject(authorization) {
  try {
    const part = authorization.split(" ")[1].split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

// A request is only ever sent as the person who made it.
function authorizationFor(item) {
  const subject = tokenSubject(item.authorization);
  if (latestAuthorization && subject) {
    if (tokenSubject(latestAuthorization) === subject)
      return latestAuthorization;
  }
  return item.authorization;
}

function isAuthFailure(response, json) {
  if (response.status === 401) return true;
  const errors = (json && json.errors) || [];
  return errors.some(
    (e) =>
      e &&
      typeof e.message === "string" &&
      (e.message === "Not authenticated" || e.message.includes("jwt"))
  );
}

// What happened to one request:
//   synced   - stored; forget it and report the result
//   rejected - the server refused it; forget it and report the failure
//   auth     - the session has expired; keep it, untouched, for a fresh one
//   retry    - server trouble; keep it and try again later
//   offline  - no network; stop replaying for now
async function replayItem(item, apiUrl) {
  let response;
  try {
    response = await fetch(apiUrl, {
      body: JSON.stringify(item.body),
      headers: {
        Authorization: authorizationFor(item),
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return { kind: "offline" };
  }
  let json = null;
  try {
    json = await response.json();
  } catch {}
  if (response.ok && json && json.data && !json.errors) {
    return { data: json.data, kind: "synced" };
  }
  if (isAuthFailure(response, json)) return { kind: "auth" };
  if (response.status >= 500 || !json) return { kind: "retry" };
  return { kind: "rejected" };
}

async function settleItem(item, outcome) {
  const result =
    outcome.kind === "synced"
      ? {
          at: Date.now(),
          data: outcome.data,
          id: item.id,
          type: "MUTATION_SYNCED",
        }
      : { at: Date.now(), id: item.id, type: "MUTATION_FAILED" };
  await withStore(async () => {
    const queue = await readJson(QUEUE_PATH);
    if (outcome.kind === "retry") {
      await writeJson(
        QUEUE_PATH,
        queue.map((i) =>
          i.id === item.id ? { ...i, retries: i.retries + 1 } : i
        )
      );
      return;
    }
    await writeJson(
      QUEUE_PATH,
      queue.filter((i) => i.id !== item.id)
    );
    await addResults([result]);
  });
  if (outcome.kind !== "retry") await notifyClients(result);
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

// Tell every page what is still queued and what has finished, so a page that
// was closed when a request finished can still learn its outcome.
async function reportToClients() {
  const report = await withStore(async () => {
    const queue = await readJson(QUEUE_PATH);
    return {
      at: Date.now(),
      pending: [...queue.map((i) => i.id), ...handling],
      results: await readJson(RESULTS_PATH),
      type: "QUEUE_REPORT",
    };
  });
  await notifyClients(report);
}

async function replayQueue() {
  const snapshot = await withStore(() => readJson(QUEUE_PATH));

  for (const item of snapshot) {
    const ageInDays = (Date.now() - item.timestamp) / 86_400_000;
    if (ageInDays > STALE_DAYS) {
      await notifyClients({
        age: Math.floor(ageInDays),
        id: item.id,
        type: "STALE_MUTATION",
      });
      continue;
    }

    const apiUrl = item.url || configuredApiUrl;
    if (!apiUrl) continue;

    const outcome = await replayItem(item, apiUrl);
    if (outcome.kind === "offline") break;
    if (outcome.kind === "auth") continue;
    await settleItem(item, outcome);
  }

  await reportToClients();
}

// Background sync: replay queued mutations
self.addEventListener("sync", (event) => {
  if (event.tag === "bubsie-sync") {
    event.waitUntil(replayQueueExclusively());
  }
});

let replayInFlight = null;
let replayRequested = false;

// One replay at a time. A request that arrives mid-replay (often carrying a
// fresh session) runs another pass once this one ends.
function replayQueueExclusively() {
  if (replayInFlight) {
    replayRequested = true;
    return replayInFlight;
  }
  replayInFlight = (async () => {
    do {
      replayRequested = false;
      await replayQueue();
    } while (replayRequested);
  })().finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}

function acknowledge(ids) {
  return withStore(async () => {
    const results = await readJson(RESULTS_PATH);
    await writeJson(
      RESULTS_PATH,
      results.filter((r) => !ids.includes(r.id))
    );
  });
}

// Listen for messages from clients
self.addEventListener("message", (event) => {
  const { data } = event;
  const keepAlive = (promise) => {
    if (event.waitUntil) event.waitUntil(promise);
  };
  if (data === "SYNC_NOW" || (data && data.type === "SYNC_NOW")) {
    if (data && typeof data.authorization === "string") {
      latestAuthorization = data.authorization;
    }
    keepAlive(replayQueueExclusively());
  }
  if (data && data.type === "ACK_RESULTS" && Array.isArray(data.ids)) {
    keepAlive(acknowledge(data.ids));
  }
  if (data && data.type === "SET_API_URL" && data.url) {
    configuredApiUrl = data.url;
  }
});
