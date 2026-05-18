"use client";

import { getApiUrl, loadRuntimeConfig } from "@/lib/runtime-config";

// Custom event fired on `window` when a new service worker has finished
// installing and is waiting. The UpdateToast component listens for this to
// prompt the user to reload.
export const SW_UPDATE_EVENT = "babytalk:sw-update-available";

// Check for a new SW this often while the app is open. PWAs can stay open
// for hours, so we poke the registration periodically to make sure long
// sessions still pick up deploys.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

const notifyUpdateAvailable = (worker: ServiceWorker) => {
  window.dispatchEvent(
    new CustomEvent(SW_UPDATE_EVENT, { detail: { worker } })
  );
};

const watchForUpdate = (registration: ServiceWorkerRegistration) => {
  // Only treat a newly-installed SW as an "update" when there's an existing
  // controller — otherwise this is the first install and there's nothing to
  // reload for.
  const trackInstalling = (worker: ServiceWorker) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(worker);
      }
    });
  };

  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyUpdateAvailable(registration.waiting);
  }
  if (registration.installing) {
    trackInstalling(registration.installing);
  }
  registration.addEventListener("updatefound", () => {
    if (registration.installing) {
      trackInstalling(registration.installing);
    }
  });
};

export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // When the controller changes (because the new SW called skipWaiting),
  // reload the page so the running JS matches the freshly-activated SW's
  // cache. Guard against the reload loop that can happen during DevTools
  // "Update on reload".
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Send the API URL to the service worker so it doesn't hardcode localhost.
      // Wait for runtime config to be loaded first, then send.
      // ServiceWorkerContainer.postMessage does not accept targetOrigin
      // (unlike Window.postMessage), so we use a helper to avoid a lint false positive.
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

      if ("sync" in registration) {
        await (
          registration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register("babytalk-sync");
      }

      watchForUpdate(registration);

      // Poll for updates while the app is open, and whenever the user
      // brings the tab back to the foreground — long-lived PWA sessions
      // would otherwise never notice a deploy.
      const checkForUpdate = async () => {
        try {
          await registration.update();
        } catch {
          // Network errors are expected when offline; ignore.
        }
      };
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void checkForUpdate();
        }
      });

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

// Tell the waiting service worker to activate. The controllerchange handler
// above will reload the page once activation completes.
export const applyServiceWorkerUpdate = (worker: ServiceWorker) => {
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin param
  worker.postMessage("SKIP_WAITING");
};
