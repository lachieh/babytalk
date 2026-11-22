"use client";

import type { BabyEvent } from "@/lib/event-outbox";
import { currentAuthorization, restoreSession } from "@/lib/gql-request";
import { getApiUrl, loadRuntimeConfig } from "@/lib/runtime-config";

/** What the worker did with one queued request. The worker keeps these until
 * a page acknowledges them, so a result is not lost when no page is open. */
export type WorkerResult =
  | { type: "MUTATION_SYNCED"; id: string; event: BabyEvent | null }
  | { type: "MUTATION_FAILED"; id: string };

export type SyncMessage =
  | WorkerResult
  | { type: "QUEUE_REPORT"; pending: string[]; results: WorkerResult[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBabyEvent = (value: unknown): value is BabyEvent =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.type === "string" &&
  typeof value.startedAt === "string" &&
  typeof value.metadata === "string" &&
  (value.endedAt === null || typeof value.endedAt === "string");

/** The event a replayed `logEvent` or `updateEvent` returned, if any. */
const eventFromData = (data: unknown): BabyEvent | null => {
  if (!isRecord(data)) return null;
  const event = data.logEvent ?? data.updateEvent;
  return isBabyEvent(event) ? event : null;
};

const parseResult = (value: unknown): WorkerResult | null => {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (value.type === "MUTATION_SYNCED") {
    return { event: eventFromData(value.data), id: value.id, type: value.type };
  }
  if (value.type === "MUTATION_FAILED")
    return { id: value.id, type: value.type };
  return null;
};

export const parseSyncMessage = (data: unknown): SyncMessage | null => {
  if (isRecord(data) && data.type === "QUEUE_REPORT") {
    const pending = Array.isArray(data.pending)
      ? data.pending.filter((id): id is string => typeof id === "string")
      : [];
    const results = Array.isArray(data.results)
      ? data.results.flatMap((r) => parseResult(r) ?? [])
      : [];
    return { pending, results, type: "QUEUE_REPORT" };
  }
  return parseResult(data);
};

const workerAvailable = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator;

export const onSyncMessage = (
  handler: (message: SyncMessage) => void
): (() => void) => {
  if (!workerAvailable()) {
    return () => {
      /* nothing subscribed */
    };
  }
  const listener = (event: MessageEvent) => {
    const message = parseSyncMessage(event.data);
    if (message) handler(message);
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
};

/** Whether a worker is holding this page's queued requests. */
export const hasWorkerController = () =>
  workerAvailable() && navigator.serviceWorker.controller !== null;

const postToWorker = (message: unknown) => {
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin param
  navigator.serviceWorker.controller?.postMessage(message);
};

/** Ask the worker to replay its queue with a fresh session, then report what
 * it still holds and what it has finished. Access tokens last 15 minutes, so
 * the token captured when a request was queued is often expired by now. */
export const requestWorkerSync = async () => {
  if (!hasWorkerController()) return;
  if (navigator.onLine) await restoreSession();
  postToWorker({ authorization: currentAuthorization(), type: "SYNC_NOW" });
};

export const ackWorkerResults = (ids: string[]) => {
  if (ids.length > 0 && hasWorkerController()) {
    postToWorker({ ids, type: "ACK_RESULTS" });
  }
};

type SyncRegistration = ServiceWorkerRegistration & {
  sync: { register: (tag: string) => Promise<void> };
};

const registerBackgroundSync = async () => {
  if (!("SyncManager" in window)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!("sync" in registration)) return;
  try {
    await (registration as SyncRegistration).sync.register("bubsie-sync");
  } catch {
    /* unsupported or refused: SYNC_NOW messages still replay the queue */
  }
};

const setUp = async () => {
  await navigator.serviceWorker.register("/sw.js");

  await loadRuntimeConfig();
  const apiMsg = { type: "SET_API_URL", url: getApiUrl() };
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin param
  const sendApiUrl = (sw: ServiceWorker) => sw.postMessage(apiMsg);
  if (navigator.serviceWorker.controller) {
    sendApiUrl(navigator.serviceWorker.controller);
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (navigator.serviceWorker.controller) {
      sendApiUrl(navigator.serviceWorker.controller);
      void requestWorkerSync();
    }
  });

  await registerBackgroundSync();
  void requestWorkerSync();
};

const removeWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  } catch {
    /* nothing to remove */
  }
};

export const registerServiceWorker = () => {
  if (!workerAvailable()) return;

  if (process.env.NODE_ENV === "development") {
    void removeWorkers();
    return;
  }

  const start = async () => {
    try {
      await setUp();
    } catch (error) {
      console.warn("Service worker setup failed:", error);
    }
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });

  window.addEventListener("online", () => {
    void requestWorkerSync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      void requestWorkerSync();
    }
  });
};
