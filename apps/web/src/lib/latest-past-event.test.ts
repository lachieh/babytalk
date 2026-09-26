import type { BabyEvent } from "./baby-context";
import { latestPastEvent } from "./latest-past-event";

const event = (id: string, startedAt: string): BabyEvent => ({
  endedAt: startedAt,
  id,
  metadata: "{}",
  startedAt,
  type: "diaper",
});

describe("latest past event", () => {
  it("ignores future events and selects the latest past event", () => {
    const now = Date.parse("2026-09-26T12:00:00Z");
    const result = latestPastEvent(
      [
        event("future", "2026-09-26T12:01:00Z"),
        event("old", "2026-09-26T10:00:00Z"),
        event("latest", "2026-09-26T11:30:00Z"),
      ],
      "diaper",
      now
    );

    expect(result?.id).toBe("latest");
  });
});
