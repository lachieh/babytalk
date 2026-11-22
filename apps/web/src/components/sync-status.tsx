"use client";

import { usePathname } from "next/navigation";

import { useBabyContext } from "@/lib/baby-context";
import { syncMessage } from "@/lib/sync-copy";

const NAV_CLEARANCE =
  "calc(max(1.5rem, env(safe-area-inset-bottom)) + 5.375rem)";
const BARE_CLEARANCE =
  "calc(max(0.5rem, env(safe-area-inset-bottom)) + 0.75rem)";

const hasBottomNav = (pathname: string) =>
  !pathname.startsWith("/station") &&
  !pathname.startsWith("/dashboard/setup") &&
  !pathname.startsWith("/dashboard/join");

export const floatingBottom = (pathname: string, lift?: string): string => {
  const base = hasBottomNav(pathname) ? NAV_CLEARANCE : BARE_CLEARANCE;
  return lift ? `calc(${base} + ${lift})` : base;
};

const TOAST_LIFT = "4.5rem";

export const SyncStatus = () => {
  const pathname = usePathname();
  const { sync, retryFailed, undoableAction } = useBabyContext();
  const onboarding =
    pathname.startsWith("/dashboard/setup") ||
    pathname.startsWith("/dashboard/join");

  const status = onboarding ? null : syncMessage(sync);
  const message = status?.text ?? null;
  const canRetry = status?.canRetry ?? false;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-[bottom] duration-200 ease-out motion-reduce:transition-none"
      role="status"
      style={{
        bottom: floatingBottom(
          pathname,
          undoableAction ? TOAST_LIFT : undefined
        ),
      }}
    >
      {message ? (
        <div className="animate-fade-up pointer-events-auto flex min-h-9 items-center gap-2 rounded-full border border-neutral-200 bg-surface-raised py-1 pl-4 pr-1 text-neutral-600 text-sm shadow-sm">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400"
          />
          <span className={canRetry ? "" : "pr-3"}>{message}</span>
          {canRetry ? (
            <span aria-hidden="true" className="-mr-2 text-neutral-400">
              ·
            </span>
          ) : null}
          {canRetry ? (
            <button
              className="-my-1 min-h-[44px] min-w-[44px] rounded-full px-4 font-semibold text-primary-ink transition-colors hover:bg-primary-50 active:scale-[0.96] motion-reduce:active:scale-100"
              onClick={retryFailed}
              type="button"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
