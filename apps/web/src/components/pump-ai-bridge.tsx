"use client";

import { useEffect } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import {
  publishPumpRefreshing,
  subscribePumpIntent,
} from "@/lib/pump-hint-bus";
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
  const { forceRefresh, notifyPumpStart, refreshIfStale, refreshing } =
    usePumpThread(babyId, events);

  useEffect(() => {
    publishPumpRefreshing(refreshing);
  }, [refreshing]);

  useEffect(
    () =>
      subscribePumpIntent((intent) => {
        if (intent.kind === "page-open") {
          void refreshIfStale();
        } else if (intent.kind === "pump-start") {
          void notifyPumpStart(intent.side);
        } else if (intent.kind === "refresh") {
          void forceRefresh();
        }
      }),
    [forceRefresh, notifyPumpStart, refreshIfStale]
  );

  return null;
};
