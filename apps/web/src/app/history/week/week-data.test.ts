import { describe, expect, it } from "vitest";

import type { BabyEvent } from "@/lib/baby-context";
import { filterWeekEvents } from "./week-data";

const event = (type: BabyEvent["type"]): BabyEvent => ({
  endedAt: null,
  id: `${type}-1`,
  metadata: "",
  startedAt: "2026-08-15T12:00:00.000Z",
  type,
});

describe("filterWeekEvents", () => {
  it("reads the eventsOverlappingRange GraphQL field and excludes pumps", () => {
    const result = filterWeekEvents({
      eventsOverlappingRange: [event("feed"), event("pump")],
    });

    expect(result).toEqual([event("feed")]);
  });
});
