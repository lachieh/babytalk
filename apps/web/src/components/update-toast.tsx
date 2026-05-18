"use client";

import { useCallback, useEffect, useState } from "react";

import { applyServiceWorkerUpdate, SW_UPDATE_EVENT } from "@/lib/register-sw";

export const UpdateToast = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const { detail } = event as CustomEvent<{ worker: ServiceWorker }>;
      if (detail?.worker) {
        setWaitingWorker(detail.worker);
      }
    };
    window.addEventListener(SW_UPDATE_EVENT, handler);
    return () => window.removeEventListener(SW_UPDATE_EVENT, handler);
  }, []);

  const handleReload = useCallback(() => {
    if (!waitingWorker || reloading) return;
    setReloading(true);
    applyServiceWorkerUpdate(waitingWorker);
  }, [waitingWorker, reloading]);

  if (!waitingWorker) return null;

  return (
    <div
      aria-live="polite"
      className="animate-fade-up fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-surface-raised px-4 py-3 shadow-lg">
        <span className="flex-1 text-sm font-medium text-neutral-700">
          A new version of BabyTalk is ready.
        </span>
        <button
          className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-50 active:scale-[0.96] disabled:opacity-60"
          disabled={reloading}
          onClick={handleReload}
          type="button"
        >
          {reloading ? "Reloading…" : "Reload"}
        </button>
      </div>
    </div>
  );
};
