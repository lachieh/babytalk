/// Service Worker for Bubsie PWA
/// Handles: offline caching of static assets, and replaying the offline queue
/// left by the previously deployed worker.
///
/// Unsaved logs are kept by the page (see apps/web/src/lib/outbox-store.ts),
/// which sends them itself when the network is back. This worker does not
/// queue requests: a second copy of the same intent here is what made the
/// two disagree.

// Bumped to v2 to evict the v1 cache, which served stale HTML referencing
// content-hashed JS chunks that no longer exist after a deploy — leaving
// returning users with a blank page until they hard-refreshed.
const CACHE_NAME = "bubsie-v2";

// Where the previously deployed worker queued requests that failed offline.
const LEGACY_QUEUES = ["bubsie-queue", "babytalk-queue"];
const LEGACY_PATH = "/queue";

// Set by the page: the API URL from the runtime config (legacy items do not
// record it) and its current session (legacy items carry a header captured
// when they were queued, long expired by now).
let apiUrl = null;
let latestAuthorization = null;

// Install: take over as soon as possible. We intentionally skip pre-caching
// HTML routes — Next.js content-hashes its JS/CSS chunks per build, so a
// pre-cached HTML page from an old build references chunks that 404 after
// the next deploy.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: clean old caches (the legacy queues stay until drained) and take
// control of open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && !LEGACY_QUEUES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Fetch strategies:
// - Anything but GET (GraphQL mutations included): straight to the network
// - GraphQL GETs: straight to the network
// - HTML navigations: network-only (never cache — see CACHE_NAME comment)
// - Hashed static assets (/_next/static/*): cache-first (immutable by hash)
// - Everything else: network with cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.includes("/graphql")) return;

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

/* ── The previous worker's queue ───────────────────────────────
 * Requests the previously deployed worker queued while offline. Most came
 * from pages that kept no copy, so they are replayed once, here. A request
 * carrying `clientMutationId` came from a page that keeps its own copy and
 * sends it again itself, so replaying it too could undo a later change; it
 * is dropped. Queries were queued as well; they are dropped. */

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
  const fresh =
    latestAuthorization &&
    subject &&
    tokenSubject(latestAuthorization) === subject;
  return fresh ? latestAuthorization : item.authorization;
}

function shouldReplay(item) {
  const body = item && item.body;
  const isMutation =
    body && typeof body.query === "string" && /^\s*mutation\b/.test(body.query);
  const ownedByPage = Boolean(
    body && body.variables && body.variables.clientMutationId
  );
  return isMutation && !ownedByPage;
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

// "done": stored or refused, forget it. "keep": try on a later page load.
// "stop": no network, keep it and the rest.
async function replay(item) {
  let response;
  try {
    response = await fetch(item.url || apiUrl, {
      body: JSON.stringify(item.body),
      headers: {
        Authorization: authorizationFor(item),
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return "stop";
  }
  let json = null;
  try {
    json = await response.json();
  } catch {}
  if (isAuthFailure(response, json)) return "keep";
  if (response.status >= 500 || !json) return "keep";
  return "done";
}

async function drainQueue(name) {
  if (!(await caches.has(name))) return;
  const cache = await caches.open(name);
  const stored = await cache.match(LEGACY_PATH);
  const items = stored ? await stored.json().catch(() => []) : [];
  const kept = [];
  let offline = false;
  for (const item of Array.isArray(items) ? items : []) {
    if (!shouldReplay(item)) continue;
    const outcome = offline ? "stop" : await replay(item);
    if (outcome === "stop") offline = true;
    if (outcome !== "done") kept.push(item);
  }
  if (kept.length === 0) {
    await caches.delete(name);
    return;
  }
  await cache.put(
    LEGACY_PATH,
    new Response(JSON.stringify(kept), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

let draining = null;

// One drain at a time; a request during a drain is served by that drain.
function drainLegacyQueues() {
  if (!apiUrl) return Promise.resolve();
  draining ??= (async () => {
    for (const name of LEGACY_QUEUES) await drainQueue(name);
  })().finally(() => {
    draining = null;
  });
  return draining;
}

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || data.type !== "SET_API_URL" || !data.url) return;
  apiUrl = data.url;
  if (typeof data.authorization === "string") {
    latestAuthorization = data.authorization;
  }
  const done = drainLegacyQueues();
  if (event.waitUntil) event.waitUntil(done);
});
