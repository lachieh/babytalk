/// Service Worker for BabyTalk PWA
/// Handles: offline caching, background sync for mutations

const CACHE_NAME = "babytalk-v1";
const OFFLINE_QUEUE_KEY = "babytalk_offline_queue";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const STALE_DAYS = 7;

// Static assets to pre-cache
const PRECACHE_URLS = ["/dashboard", "/offline"];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // GraphQL API requests: network-first
  if (url.pathname.includes("/graphql")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If it's a mutation, queue it for later
        if (event.request.method === "POST") {
          return event.request
            .clone()
            .json()
            .then((body) => queueMutation(body, event.request.headers))
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

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          // Cache successful GET responses
          if (event.request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
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
  const apiUrl = self.location.origin.includes("localhost")
    ? "http://localhost:4000/graphql"
    : "/api/graphql";

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

// Listen for online event from clients
self.addEventListener("message", (event) => {
  if (event.data === "SYNC_NOW") {
    syncQueue();
  }
});
