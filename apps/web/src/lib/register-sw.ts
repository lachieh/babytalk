"use client";

import { currentAuthorization, restoreSession } from "@/lib/gql-request";
import { getApiUrl, loadRuntimeConfig } from "@/lib/runtime-config";

/* The worker caches static assets and replays, once, the offline queue the
 * previously deployed worker left behind. It needs the API URL (legacy items
 * do not record it) and a current session (theirs has long expired).
 *
 * Deliberately absent: the `bubsie-sync` background-sync tag and the
 * "SYNC_NOW" message. The previous worker replays its queue on either, and
 * until the new worker takes over it still controls this page. Sending
 * neither keeps it from replaying requests this page will resend itself. */

const tellWorker = async (worker: ServiceWorker) => {
  if (navigator.onLine) await restoreSession();
  const message = {
    authorization: currentAuthorization(),
    type: "SET_API_URL",
    url: getApiUrl(),
  };
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin param
  worker.postMessage(message);
};

const setUp = async () => {
  await navigator.serviceWorker.register("/sw.js");
  await loadRuntimeConfig();
  const { controller } = navigator.serviceWorker;
  if (controller) await tellWorker(controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const next = navigator.serviceWorker.controller;
    if (next) void tellWorker(next);
  });
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
};
