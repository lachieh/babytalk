"use client";

import { useCallback, useState } from "react";

import { unsavedTotal } from "@/lib/event-outbox";
import {
  forgetOutbox,
  getOutboxState,
  sendBeforeSignOut,
} from "@/lib/outbox-store";

/** How long sign-out waits for unsent entries to go. */
const SEND_WITHIN_MS = 5000;

const plural = (count: number) =>
  `${count} ${count === 1 ? "entry hasn't" : "entries haven't"}`;

/** Signs out, but not past unsent entries without saying so: it tries to
 * send them first, and if some are left, asks before removing them. */
export const SignOutButton = ({ onSignOut }: { onSignOut: () => void }) => {
  const [phase, setPhase] = useState<"idle" | "saving" | number>("idle");

  const signOut = useCallback(() => {
    forgetOutbox();
    onSignOut();
  }, [onSignOut]);

  const handleTap = useCallback(async () => {
    if (unsavedTotal(getOutboxState()) === 0) {
      signOut();
      return;
    }
    setPhase("saving");
    const left = await sendBeforeSignOut(SEND_WITHIN_MS);
    if (left === 0) signOut();
    else setPhase(left);
  }, [signOut]);

  const stay = useCallback(() => setPhase("idle"), []);

  if (typeof phase === "number") {
    return (
      <div
        className="space-y-3 rounded-xl border border-neutral-200 p-4"
        role="alert"
      >
        <p className="text-sm text-neutral-700">
          {plural(phase)} saved yet. Signing out removes{" "}
          {phase === 1 ? "it" : "them"} from this device.
        </p>
        <div className="flex gap-2">
          <button
            className="min-h-[44px] flex-1 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            onClick={stay}
            type="button"
          >
            Stay signed in
          </button>
          <button
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            onClick={signOut}
            type="button"
          >
            Sign out anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-60"
      disabled={phase === "saving"}
      onClick={handleTap}
      type="button"
    >
      {phase === "saving" ? "Saving your entries…" : "Sign out"}
    </button>
  );
};
