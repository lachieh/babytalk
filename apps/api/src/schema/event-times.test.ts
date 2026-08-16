/// <reference types="vitest/globals" />

import { normalizeEventEndTime } from "./event-times";

describe("event end-time normalization", () => {
  it("keeps diaper end time aligned with its start time", () => {
    const startedAt = new Date("2026-08-16T10:00:00.000Z");

    expect(
      normalizeEventEndTime(
        "diaper",
        startedAt,
        new Date("2026-08-16T10:30:00.000Z")
      )
    ).toStrictEqual(startedAt);
  });

  it("preserves duration event end times", () => {
    const endedAt = new Date("2026-08-16T10:30:00.000Z");

    expect(
      normalizeEventEndTime(
        "sleep",
        new Date("2026-08-16T10:00:00.000Z"),
        endedAt
      )
    ).toStrictEqual(endedAt);
  });
});
