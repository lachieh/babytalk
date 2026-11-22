"use client";

import { DaysRecap } from "@/components/days-recap";
import { useBabyContext } from "@/lib/baby-context";

import { AddPastEntryButton } from "../_context";

export default function HistoryDaysPage() {
  const { events, loading } = useBabyContext();

  if (loading) return null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AddPastEntryButton />
      <DaysRecap events={events} />
    </div>
  );
}
