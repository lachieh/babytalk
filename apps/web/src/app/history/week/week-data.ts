import type { BabyEvent } from "@/lib/baby-context";

export interface WeekEventsResponse {
  eventsOverlappingRange: BabyEvent[];
}

export function filterWeekEvents(data: WeekEventsResponse): BabyEvent[] {
  return data.eventsOverlappingRange.filter((event) => event.type !== "pump");
}
