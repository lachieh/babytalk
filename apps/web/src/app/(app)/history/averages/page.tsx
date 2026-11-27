"use client";

import { useCallback } from "react";

import { AveragesSkeleton } from "@/components/skeletons";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { gqlRequest } from "@/lib/gql-request";
import { buildTypicalDay, historyStart } from "@/lib/typical-day-report";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useVolumeUnit } from "@/lib/use-volume-unit";

import { TypicalDay } from "./typical-day";

const EVENTS_IN_RANGE = `
  query EventsInRange(
    $babyId: String!
    $startedAfter: String!
    $startedBefore: String!
  ) {
    eventsInRange(
      babyId: $babyId
      startedAfter: $startedAfter
      startedBefore: $startedBefore
    ) {
      id
      type
      startedAt
      endedAt
      metadata
    }
  }
`;

export default function HistoryAveragesPage() {
  const { unit } = useVolumeUnit();
  const { baby, loading } = useBabyContext();
  const babyId = baby?.id;
  const birthDate = baby?.birthDate;

  const load = useCallback(async () => {
    const now = new Date();
    const data = await gqlRequest<{ eventsInRange: BabyEvent[] }>(
      EVENTS_IN_RANGE,
      {
        babyId,
        startedAfter: historyStart(now, birthDate).toISOString(),
        startedBefore: now.toISOString(),
      }
    );
    return buildTypicalDay(data.eventsInRange, { birthDate, now });
  }, [babyId, birthDate]);

  const {
    data: report,
    failed,
    retry,
  } = useCachedQuery(babyId ? `averages:${babyId}:${birthDate}` : null, load);

  if (failed) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-xl pt-2 pb-8">
          <h2 className="font-serif text-neutral-800 text-xl leading-7">
            Averages could not load
          </h2>
          <p className="mt-2 text-neutral-600 text-sm leading-6">
            Nothing is lost. Check the connection and try again.
          </p>
          <button
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-neutral-200 px-5 font-medium text-neutral-800 text-sm transition-colors hover:bg-neutral-300 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !baby || !report) {
    return <AveragesSkeleton />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4">
      <TypicalDay babyName={baby.name} report={report} unit={unit} />
    </div>
  );
}
