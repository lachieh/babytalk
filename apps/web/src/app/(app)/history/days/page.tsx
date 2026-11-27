"use client";

import { DaysRecap } from "@/components/days-recap";
import { DaysSkeleton } from "@/components/skeletons";
import { useBabyContext } from "@/lib/baby-context";

import { AddPastEntryButton } from "../_context";

export default function HistoryDaysPage() {
  const { events, eventsLoading } = useBabyContext();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AddPastEntryButton />
      {eventsLoading && events.length === 0 ? (
        <div aria-label="Loading days" role="status">
          <DaysSkeleton />
        </div>
      ) : (
        <DaysRecap events={events} />
      )}
    </div>
  );
}
