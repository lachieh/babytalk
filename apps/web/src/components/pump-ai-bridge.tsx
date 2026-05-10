"use client";

import { useEffect } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { subscribePumpIntent } from "@/lib/pump-hint-bus";
import { usePumpThread } from "@/lib/use-pump-thread";

/**
 * Mounted only when Tambo is ready. Drives the pump coach thread:
 * hydrates from DB, listens to pump intent signals from the UI, and
 * publishes hint updates onto the pump-hint bus when the agent calls
 * the updatePumpHint tool.
 */
export const PumpAiBridge = ({
  babyId,
  events,
}: {
  babyId: string | null;
  events: BabyEvent[];
}) => {
  const { notifyPumpStart, refreshIfStale } = usePumpThread(babyId, events);

  useEffect(
    () =>
      subscribePumpIntent((intent) => {
        if (intent.kind === "page-open") {
          void refreshIfStale();
        } else if (intent.kind === "pump-start") {
          void notifyPumpStart(intent.side);
        }
      }),
    [notifyPumpStart, refreshIfStale]
  );

  return null;
};
