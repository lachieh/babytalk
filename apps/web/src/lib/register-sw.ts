"use client";

export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Send the API URL to the service worker so it doesn't hardcode localhost.
      // ServiceWorkerContainer.postMessage does not accept targetOrigin
      // (unlike Window.postMessage), so we use a helper to avoid a lint false positive.
      const apiUrl =
        process.env.NEXT_PUBLIC_BABYTALK_WEB_API_URL ||
        "http://localhost:4000/graphql";
      const apiMsg = { type: "SET_API_URL", url: apiUrl };
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
