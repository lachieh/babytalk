/// Service Worker for BabyTalk PWA
/// Handles: offline caching, background sync for mutations

// Bumped to v2 to evict the v1 cache, which served stale HTML referencing
// content-hashed JS chunks that no longer exist after a deploy — leaving
// returning users with a blank page until they hard-refreshed.
const CACHE_NAME = "babytalk-v2";
const OFFLINE_QUEUE_KEY = "babytalk_offline_queue";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const STALE_DAYS = 7;

// API URL — set by the main thread via postMessage, fallback to localhost for dev
let configuredApiUrl = "http://localhost:4000/graphql";

// Install: take over as soon as possible. We intentionally skip pre-caching
// HTML routes — Next.js content-hashes its JS/CSS chunks per build, so a
// pre-cached HTML page from an old build references chunks that 404 after
// the next deploy.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== "babytalk-queue")
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

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
      fetch(request).catch(() => {
        // If it's a mutation, queue it for later
        if (request.method === "POST") {
          return request
            .clone()
            .json()
            .then((body) => queueMutation(body, request.headers))
            .then(
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

// Queue a mutation for offline sync
async function queueMutation(body, headers) {
  const queue = await getQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest
    queue.shift();
  }

  queue.push({
    authorization: headers.get("Authorization"),
    body,
    id: crypto.randomUUID(),
    retries: 0,
    timestamp: Date.now(),
  });

  await saveQueue(queue);
}

async function getQueue() {
  try {
    const clients = await self.clients.matchAll();
    // Use IndexedDB via a simple approach
    // For SW, we use the Cache API as a key-value store
    const cache = await caches.open("babytalk-queue");
    const response = await cache.match("/queue");
    if (response) {
      return response.json();
    }
  } catch {}
  return [];
}

async function saveQueue(queue) {
  const cache = await caches.open("babytalk-queue");
  await cache.put(
    "/queue",
    new Response(JSON.stringify(queue), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Background sync: replay queued mutations
self.addEventListener("sync", (event) => {
  if (event.tag === "babytalk-sync") {
    event.waitUntil(syncQueue());
  }
});

async function syncQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining = [];
  const apiUrl = configuredApiUrl;

  for (const item of queue) {
    // Flag stale items
    const ageInDays = (Date.now() - item.timestamp) / 86_400_000;
    if (ageInDays > STALE_DAYS) {
      // Notify client about stale items
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          age: Math.floor(ageInDays),
          id: item.id,
          type: "STALE_MUTATION",
        });
      });
      remaining.push(item);
      continue;
    }

    try {
      const response = await fetch(apiUrl, {
        body: JSON.stringify(item.body),
        headers: {
          Authorization: item.authorization,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) throw new Error("Sync failed");

      // Successfully synced — notify client
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({ id: item.id, type: "MUTATION_SYNCED" });
      });
    } catch {
      item.retries++;
      if (item.retries < MAX_RETRIES) {
        remaining.push(item);
      } else {
        // Max retries exceeded — notify client
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({ id: item.id, type: "MUTATION_FAILED" });
        });
      }
    }
  }

  await saveQueue(remaining);
}

// Listen for messages from clients
self.addEventListener("message", (event) => {
  if (event.data === "SYNC_NOW") {
    syncQueue();
  }
  if (event.data && event.data.type === "SET_API_URL" && event.data.url) {
    configuredApiUrl = event.data.url;
  }
});
