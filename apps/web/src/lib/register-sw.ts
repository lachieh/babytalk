"use client";

export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      if ("sync" in registration) {
        await (
          registration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register("babytalk-sync");
      }

      navigator.serviceWorker.addEventListener("message", (event) => {
        const { type, id } = event.data;
        switch (type) {
          case "MUTATION_SYNCED": {
            console.log(`[SW] Mutation ${id} synced successfully`);
            break;
          }
          case "MUTATION_FAILED": {
            console.warn(`[SW] Mutation ${id} failed after max retries`);
            break;
          }
          case "STALE_MUTATION": {
            console.warn(
              `[SW] Stale mutation ${id} (${event.data.age} days old)`
            );
            break;
          }
          default: {
            break;
          }
        }
      });
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });

  window.addEventListener("online", () => {
    navigator.serviceWorker.controller?.postMessage("SYNC_NOW");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      navigator.serviceWorker.controller?.postMessage("SYNC_NOW");
    }
  });
};
