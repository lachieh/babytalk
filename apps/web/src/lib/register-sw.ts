"use client";

import { getApiUrl, loadRuntimeConfig } from "@/lib/runtime-config";

export type SyncMessage =
  | { type: "MUTATION_SYNCED"; id: string }
  | { type: "MUTATION_FAILED"; id: string };

export const onSyncMessage = (
  handler: (message: SyncMessage) => void
): (() => void) => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => {
      /* nothing subscribed */
    };
  }
  const listener = (event: MessageEvent) => {
    const { data } = event as { data: unknown };
    if (!data || typeof data !== "object") return;
    const { type, id } = data as { type?: unknown; id?: unknown };
    if (
      (type === "MUTATION_SYNCED" || type === "MUTATION_FAILED") &&
      typeof id === "string"
    ) {
      handler({ id, type });
    }
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
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
    }
  });

  await registerBackgroundSync();
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
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

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
    navigator.serviceWorker.controller?.postMessage("SYNC_NOW");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      navigator.serviceWorker.controller?.postMessage("SYNC_NOW");
    }
  });
};
