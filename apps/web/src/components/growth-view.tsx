"use client";

import { useCallback, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { gqlRequest } from "@/lib/gql-request";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useMeasurementUnit } from "@/lib/use-measurement-unit";

import { MeasurementSheet } from "./growth-measurement-sheet";
import type { Measurement } from "./growth-model";
import { GrowthPanel } from "./growth-panel";
import { GrowthSkeleton } from "./skeletons";

const GET_GROWTH = `
  query Growth($babyId: String!, $limit: Int) {
    measurements(babyId: $babyId, limit: $limit) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
    myBabies { id birthWeightG }
  }
`;

interface GrowthData {
  measurements: Measurement[];
  myBabies: { id: string; birthWeightG: number | null }[];
}

const MEASUREMENT_LIMIT = 200;

export const GrowthView = () => {
  const { baby, loading } = useBabyContext();
  const { imperial, setUnit } = useMeasurementUnit();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Measurement | null>(null);

  const babyId = baby?.id ?? null;

  const load = useCallback(async () => {
    const result = await gqlRequest<GrowthData>(GET_GROWTH, {
      babyId,
      limit: MEASUREMENT_LIMIT,
    });
    return {
      birthWeightG:
        result.myBabies.find((b) => b.id === babyId)?.birthWeightG ?? null,
      measurements: result.measurements,
    };
  }, [babyId]);

  const {
    data,
    failed,
    retry: handleSaved,
    update,
  } = useCachedQuery(babyId && `growth:${babyId}`, load);

  const handleAdd = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback((m: Measurement) => {
    setEditing(m);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => setSheetOpen(false), []);
  const handleDeleted = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        measurements: prev.measurements.filter((m) => m.id !== id),
      }));
      // A refresh started before the delete would bring it back.
      handleSaved();
    },
    [update, handleSaved]
  );

  if (loading) return <GrowthSkeleton />;
  if (!baby) return null;

  if (!data) {
    if (!failed) return <GrowthSkeleton />;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <p className="text-base font-semibold text-neutral-800">
          Growth didn&rsquo;t load
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Check your connection, then try again. Nothing has been lost.
        </p>
        <button
          className="mt-4 min-h-[48px] rounded-xl border border-neutral-300 px-5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          onClick={handleSaved}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <GrowthPanel
        babyName={baby.name}
        birthDate={baby.birthDate}
        birthWeightG={data.birthWeightG}
        gender={baby.gender ?? null}
        imperial={imperial}
        measurements={data.measurements}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onUnitChange={setUnit}
      />
      <MeasurementSheet
        babyId={baby.id}
        imperial={imperial}
        measurement={editing}
        onClose={handleClose}
        onDeleted={handleDeleted}
        onSaved={handleSaved}
        open={sheetOpen}
      />
    </>
  );
};
