import { calculateMonthlyAverages } from "./monthly-averages";

describe("monthly activity averages", () => {
  it("averages feeds, sleep, and diapers over calendar days", () => {
    const month = new Date(2026, 0, 1);
    const events = [
      {
        id: "f1",
        type: "feed",
        startedAt: "2026-01-01T08:00:00Z",
        endedAt: null,
        metadata: "{}",
      },
      {
        id: "f2",
        type: "feed",
        startedAt: "2026-01-02T08:00:00Z",
        endedAt: null,
        metadata: "{}",
      },
      {
        id: "d1",
        type: "diaper",
        startedAt: "2026-01-02T09:00:00Z",
        endedAt: null,
        metadata: "{}",
      },
      {
        id: "s1",
        type: "sleep",
        startedAt: "2026-01-01T20:00:00Z",
        endedAt: "2026-01-02T04:00:00Z",
        metadata: "{}",
      },
    ];

    const result = calculateMonthlyAverages(
      events,
      month,
      new Date(2026, 1, 1)
    );

    expect(result.feedingsPerDay).toBeCloseTo(2 / 31);
    expect(result.diaperChangesPerDay).toBeCloseTo(1 / 31);
    expect(result.sleepHoursPerDay).toBeCloseTo(8 / 31);
  });

  it("uses elapsed days for the current month", () => {
    const result = calculateMonthlyAverages(
      [],
      new Date(2026, 0, 1),
      new Date(2026, 0, 10, 12)
    );

    expect(result.feedingsPerDay).toBe(0);
    expect(result.sleepHoursPerDay).toBe(0);
    expect(result.diaperChangesPerDay).toBe(0);
  });
});
