import { calculateMonthlyAverages } from "./monthly-averages";

const localIso = (date: number, hour: number) =>
  new Date(2026, 0, date, hour).toISOString();

describe("monthly activity averages", () => {
  it("averages feeds, sleep, and diapers over calendar days", () => {
    const month = new Date(2026, 0, 1);
    const events = [
      {
        id: "f1",
        type: "feed",
        startedAt: "2026-01-01T08:00:00Z",
        endedAt: null,
        metadata: '{"amountMl":90}',
      },
      {
        id: "f2",
        type: "feed",
        startedAt: "2026-01-02T08:00:00Z",
        endedAt: null,
        metadata: '{"amountMl":120}',
      },
      {
        id: "s2",
        type: "sleep",
        startedAt: localIso(3, 18),
        endedAt: localIso(3, 20),
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
        startedAt: localIso(1, 20),
        endedAt: localIso(2, 4),
        metadata: "{}",
      },
    ];

    const result = calculateMonthlyAverages(
      events,
      month,
      new Date(2026, 1, 1)
    );

    expect(result.feedingsPerDay).toBeCloseTo(2 / 31);
    expect(result.feedVolumeMlPerDay).toBeCloseTo(210 / 31);
    expect(result.diaperChangesPerDay).toBeCloseTo(1 / 31);
    expect(result.daytimeSleepHoursPerDay).toBeCloseTo(1 / 31);
    expect(result.napsPerDay).toBeCloseTo(1 / 31);
    expect(result.nighttimeSleepHoursPerDay).toBeCloseTo(9 / 31);
  });

  it("uses elapsed days for the current month", () => {
    const result = calculateMonthlyAverages(
      [],
      new Date(2026, 0, 1),
      new Date(2026, 0, 10, 12)
    );

    expect(result.feedingsPerDay).toBe(0);
    expect(result.daytimeSleepHoursPerDay).toBe(0);
    expect(result.napsPerDay).toBe(0);
    expect(result.nighttimeSleepHoursPerDay).toBe(0);
    expect(result.diaperChangesPerDay).toBe(0);
  });
});
