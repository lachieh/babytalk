"use client";

import { useEffect, useState } from "react";

import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import {
  calculateMonthlyAverages,
  monthStartsThrough,
} from "@/lib/monthly-averages";
import { gqlRequest } from "@/lib/tambo/graphql";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

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

const formatAverage = (value: number, suffix = "") =>
  `${value.toFixed(1)}${suffix}`;

export default function HistoryAveragesPage() {
  const { unit } = useVolumeUnit();
  const { baby, loading } = useBabyContext();
  const [averages, setAverages] = useState<
    ReturnType<typeof calculateMonthlyAverages>[]
  >([]);
  const [loadingAverages, setLoadingAverages] = useState(true);

  useEffect(() => {
    if (!baby) return;
    let cancelled = false;

    const loadAverages = async () => {
      setLoadingAverages(true);
      const months = monthStartsThrough(12);
      const results = await Promise.all(
        months.map(async (month) => {
          const nextMonth = new Date(month);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          try {
            const data = await gqlRequest<{ eventsInRange: BabyEvent[] }>(
              EVENTS_IN_RANGE,
              {
                babyId: baby.id,
                startedAfter: month.toISOString(),
                startedBefore: nextMonth.toISOString(),
              }
            );
            return calculateMonthlyAverages(data.eventsInRange, month);
          } catch {
            return calculateMonthlyAverages([], month);
          }
        })
      );
      if (!cancelled) {
        setAverages(results);
        setLoadingAverages(false);
      }
    };

    loadAverages();
    return () => {
      cancelled = true;
    };
  }, [baby]);

  if (loading || loadingAverages) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-neutral-700">
          Monthly averages
        </h1>
        <p className="mt-1 text-neutral-400 text-sm">
          Average activity per calendar day.
        </p>
      </div>

      <div className="space-y-3 pb-6">
        {averages.map((average) => (
          <section
            className="rounded-2xl border border-neutral-200 bg-surface-raised p-4"
            key={average.month}
          >
            <h2 className="font-serif text-lg text-neutral-700">
              {average.month}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-feed-50 px-2 py-3 text-center">
                <p className="font-sans text-xl tabular-nums text-neutral-700">
                  {formatAverage(average.feedingsPerDay)}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                  feeds / day
                </p>
              </div>
              <div className="rounded-xl bg-feed-50 px-2 py-3 text-center">
                <p className="font-sans text-xl tabular-nums text-neutral-700">
                  {formatVolume(average.feedVolumeMlPerDay, unit)}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                  volume / day
                </p>
              </div>
              <div className="rounded-xl bg-sleep-50 px-2 py-3 text-center">
                <p className="font-sans text-xl tabular-nums text-neutral-700">
                  {formatAverage(average.sleepHoursPerDay, "h")}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                  sleep / day
                </p>
              </div>
              <div className="rounded-xl bg-diaper-50 px-2 py-3 text-center">
                <p className="font-sans text-xl tabular-nums text-neutral-700">
                  {formatAverage(average.diaperChangesPerDay)}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                  changes / day
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
