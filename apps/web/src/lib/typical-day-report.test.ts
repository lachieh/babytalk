import type { BabyEvent } from "./baby-context";
import {
  buildTypicalDay,
  compareValues,
  describeSeries,
  formatCount,
  formatMinutes,
  historyStart,
} from "./typical-day-report";

const local = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date => new Date(year, month - 1, day, hour, minute);

let nextId = 0;
const make = (
  type: string,
  start: Date,
  end: Date | null = null,
  metadata: Record<string, unknown> = {}
): BabyEvent => {
  nextId += 1;
  return {
    endedAt: end ? end.toISOString() : null,
    id: `${type}-${nextId}`,
    metadata: JSON.stringify(metadata),
    startedAt: start.toISOString(),
    type,
  };
};

const feedsOn = (
  year: number,
  month: number,
  day: number,
  count: number,
  metadata: Record<string, unknown> = {}
): BabyEvent[] =>
  Array.from({ length: count }, (_, index) => {
    const minutes = 60 + Math.round((index * (22.5 * 60)) / (count - 1 || 1));
    return make(
      "feed",
      local(year, month, day, Math.floor(minutes / 60), minutes % 60),
      null,
      metadata
    );
  });

describe("typical-day averages", () => {
  it("averages over logged days, not calendar days", () => {
    const events = [9, 10, 12, 14, 15].flatMap((day) =>
      feedsOn(2026, 1, day, 7)
    );

    const report = buildTypicalDay(events, { now: local(2026, 1, 16, 9) });

    expect(report.status).toBe("ready");
    expect(report.granularity).toBe("week");
    expect(report.metrics.feedsPerDay.current).toBe(7);
    expect(report.metrics.feedsPerDay.currentDays).toBe(5);
    expect(report.currentLoggedDays).toBe(5);
  });

  it("leaves today out, because the day is not over", () => {
    const events = [
      ...[13, 14, 15].flatMap((day) => feedsOn(2026, 1, day, 8)),
      make("feed", local(2026, 1, 16, 2)),
      make("feed", local(2026, 1, 16, 6)),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 1, 16, 9) });

    expect(report.metrics.feedsPerDay.current).toBe(8);
    expect(report.metrics.feedsPerDay.currentDays).toBe(3);
  });

  it("keeps the average honest in the first days of a month", () => {
    const events = [
      ...[28, 29, 30, 31].flatMap((day) => feedsOn(2026, 1, day, 7)),
      ...[1, 2].flatMap((day) => feedsOn(2026, 2, day, 7)),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 2, 3, 8) });

    expect(report.windows).toHaveLength(1);
    expect(report.metrics.feedsPerDay.current).toBe(7);
    expect(report.metrics.feedsPerDay.currentDays).toBe(6);
  });

  it("puts a late-evening event on its local day across a month boundary", () => {
    const lateFeed = make("feed", local(2026, 1, 31, 23, 30));
    expect(lateFeed.startedAt).toBe("2026-02-01T04:30:00.000Z");

    const events = [
      ...feedsOn(2026, 1, 31, 6).map((event, index) => ({
        ...event,
        startedAt: local(2026, 1, 31, 2 + index * 3).toISOString(),
      })),
      lateFeed,
      ...feedsOn(2026, 2, 1, 7),
      ...feedsOn(2026, 2, 2, 7),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 2, 3, 8) });

    expect(report.metrics.feedsPerDay.current).toBe(7);

    const diapers = [
      make("diaper", local(2026, 1, 30, 10)),
      make("diaper", local(2026, 1, 31, 23, 45)),
      make("diaper", local(2026, 2, 1, 10)),
    ];
    const diaperReport = buildTypicalDay(diapers, {
      now: local(2026, 2, 2, 8),
    });
    expect(diaperReport.metrics.diapersPerDay.currentDays).toBe(3);
    expect(diaperReport.metrics.diapersPerDay.current).toBe(1);
  });

  it("ignores anything before the birth date", () => {
    const events = [
      ...feedsOn(2026, 1, 2, 20),
      ...[10, 11, 12].flatMap((day) => feedsOn(2026, 1, day, 9)),
    ];

    const report = buildTypicalDay(events, {
      birthDate: "2026-01-09",
      now: local(2026, 1, 13, 9),
    });

    expect(report.firstLoggedDay).toStrictEqual(local(2026, 1, 10));
    expect(report.windows).toHaveLength(1);
    expect(report.metrics.feedsPerDay.current).toBe(9);
  });

  it("reads the birth date as a local calendar day", () => {
    const now = local(2026, 1, 20, 9);
    expect(historyStart(now, "2026-01-09")).toStrictEqual(local(2026, 1, 9));
    expect(historyStart(now, "2026-03-01")).toStrictEqual(local(2025, 1, 25));
    expect(historyStart(now, null)).toStrictEqual(local(2025, 1, 25));
  });

  it("states no value until a period has three logged days", () => {
    const events = [
      ...feedsOn(2026, 1, 14, 7),
      ...feedsOn(2026, 1, 15, 7),
      make("feed", local(2026, 1, 16, 3)),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 1, 16, 9) });

    expect(report.status).toBe("thin");
    expect(report.currentLoggedDays).toBe(2);
    expect(report.metrics.feedsPerDay.current).toBeNull();
    expect(report.windows).toHaveLength(0);
  });

  it("separates nothing logged from only today logged", () => {
    const now = local(2026, 1, 16, 9);
    expect(buildTypicalDay([], { now }).status).toBe("empty");
    expect(
      buildTypicalDay([make("feed", local(2026, 1, 16, 3))], { now }).status
    ).toBe("thin");
  });

  it("splits sleep at local midnight and credits the stretch to the wake day", () => {
    const events = [10, 11, 12, 13].flatMap((day) => [
      make("sleep", local(2026, 1, day, 20), local(2026, 1, day + 1, 2)),
      make("sleep", local(2026, 1, day, 12), local(2026, 1, day, 13)),
    ]);

    const report = buildTypicalDay(events, { now: local(2026, 1, 14, 9) });

    expect(report.metrics.sleepPerDay.currentDays).toBe(4);
    expect(report.metrics.sleepPerDay.current).toBeCloseTo((5 + 7 * 3) * 15);
    expect(report.metrics.longestSleep.currentDays).toBe(4);
    expect(report.metrics.longestSleep.current).toBeCloseTo((60 + 360 * 3) / 4);
  });

  it("measures real elapsed sleep across a daylight-saving change", () => {
    const events = [6, 7, 8].map((day) =>
      make("sleep", local(2026, 3, day, 1), local(2026, 3, day, 4))
    );

    const report = buildTypicalDay(events, { now: local(2026, 3, 9, 9) });

    expect(report.metrics.sleepPerDay.current).toBeCloseTo(
      (180 + 180 + 120) / 3
    );
    expect(report.metrics.sleepPerDay.currentDays).toBe(3);
  });

  it("ignores a sleep timer that was left running", () => {
    const events = [
      ...[10, 11, 12].map((day) =>
        make("sleep", local(2026, 1, day, 12), local(2026, 1, day, 14))
      ),
      make("sleep", local(2026, 1, 12, 15), local(2026, 1, 13, 20)),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 1, 14, 9) });

    expect(report.metrics.sleepPerDay.current).toBe(120);
    expect(report.metrics.longestSleep.current).toBe(120);
  });

  it("averages volume only over days that have an amount logged", () => {
    const events = [
      ...[10, 11, 12].flatMap((day) =>
        feedsOn(2026, 1, day, 6, { amountMl: 100, method: "bottle" })
      ),
      ...[13, 14].flatMap((day) =>
        feedsOn(2026, 1, day, 8, { method: "breast" })
      ),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 1, 15, 9) });

    expect(report.metrics.feedVolumePerDay.current).toBe(600);
    expect(report.metrics.feedVolumePerDay.currentDays).toBe(3);
    expect(report.metrics.feedsPerDay.current).toBeCloseTo((18 + 16) / 5);
  });

  it("averages feed length per timed feed", () => {
    const events = [10, 11, 12].flatMap((day) => [
      make("feed", local(2026, 1, day, 8), local(2026, 1, day, 8, 20)),
      make("feed", local(2026, 1, day, 12), local(2026, 1, day, 12, 30)),
      make("feed", local(2026, 1, day, 16)),
    ]);

    const report = buildTypicalDay(events, { now: local(2026, 1, 13, 9) });

    expect(report.metrics.feedLength.current).toBe(25);
    expect(report.metrics.feedsPerDay.current).toBe(3);
  });

  it("reports pumping only when there is pumping", () => {
    const feeds = [10, 11, 12].flatMap((day) => feedsOn(2026, 1, day, 7));
    const now = local(2026, 1, 13, 9);

    expect(
      buildTypicalDay(feeds, { now }).metrics.pumpsPerDay.hasData
    ).toBeFalsy();

    const pumps = [10, 11, 12].flatMap((day) => [
      make("pump", local(2026, 1, day, 7), local(2026, 1, day, 7, 15), {
        amountMl: 90,
        side: "both",
      }),
      make("pump", local(2026, 1, day, 19), local(2026, 1, day, 19, 15), {
        amountMl: 60,
        side: "both",
      }),
    ]);
    const report = buildTypicalDay([...feeds, ...pumps], { now });

    expect(report.metrics.pumpsPerDay.current).toBe(2);
    expect(report.metrics.pumpVolumePerDay.current).toBe(150);
  });

  it("builds one point per week, oldest first, ending yesterday", () => {
    const perWeek = [10, 8, 7];
    const events = perWeek.flatMap((count, week) =>
      Array.from({ length: 7 }, (_, day) =>
        feedsOn(2026, 1, 1 + week * 7 + day, count)
      ).flat()
    );

    const report = buildTypicalDay(events, { now: local(2026, 1, 22, 9) });

    expect(report.metrics.feedsPerDay.points).toStrictEqual([10, 8, 7]);
    expect(report.metrics.feedsPerDay.previous).toBe(8);
    expect(report.windows.at(-1)).toStrictEqual({
      end: local(2026, 1, 22),
      start: local(2026, 1, 15),
    });
    expect(report.windows.at(0)?.start).toStrictEqual(local(2026, 1, 1));
  });

  it("leaves a gap for a week that was not logged", () => {
    const events = [
      ...[1, 2, 3, 4, 5, 6, 7].flatMap((day) => feedsOn(2026, 1, day, 9)),
      ...[15, 16, 17, 18, 19, 20, 21].flatMap((day) =>
        feedsOn(2026, 1, day, 7)
      ),
    ];

    const report = buildTypicalDay(events, { now: local(2026, 1, 22, 9) });

    expect(report.metrics.feedsPerDay.points).toStrictEqual([9, null, 7]);
    expect(report.metrics.feedsPerDay.previous).toBeNull();
  });

  it("switches to 30-day periods once there are three months of history", () => {
    const start = local(2026, 1, 1);
    const daily = (totalDays: number) =>
      Array.from({ length: totalDays }, (_, index) => {
        const day = new Date(start);
        day.setDate(day.getDate() + index);
        return make("diaper", new Date(day.getTime() + 10 * 3_600_000));
      });
    const nowAfter = (totalDays: number) => {
      const now = new Date(start);
      now.setDate(now.getDate() + totalDays);
      now.setHours(9);
      return now;
    };

    const short = buildTypicalDay(daily(90), { now: nowAfter(90) });
    expect(short.granularity).toBe("week");
    expect(short.windowDays).toBe(7);
    expect(short.windows).toHaveLength(12);

    const long = buildTypicalDay(daily(100), { now: nowAfter(100) });
    expect(long.granularity).toBe("month");
    expect(long.windowDays).toBe(30);
    expect(long.metrics.diapersPerDay.points).toStrictEqual([1, 1, 1, 1]);
    expect(long.metrics.diapersPerDay.currentDays).toBe(30);
  });
});

describe("typical-day wording", () => {
  it("formats durations as minutes or hours and minutes", () => {
    expect(formatMinutes(0.4 * 60)).toBe("24 min");
    expect(formatMinutes(25)).toBe("25 min");
    expect(formatMinutes(59.4)).toBe("59 min");
    expect(formatMinutes(80)).toBe("1h 20m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(14 * 60 + 22)).toBe("14h 20m");
    expect(formatMinutes(118)).toBe("2h");
  });

  it("formats counts without a trailing .0", () => {
    expect(formatCount(7)).toBe("7");
    expect(formatCount(6.96)).toBe("7");
    expect(formatCount(7.44)).toBe("7.4");
  });

  it("treats small changes as steady", () => {
    expect(compareValues(7.3, 7)).toBe("steady");
    expect(compareValues(8, 7)).toBe("up");
    expect(compareValues(6, 7)).toBe("down");
  });

  it("describes a series from its first value to its last", () => {
    expect(describeSeries([null, 10, null, 8, 7])).toStrictEqual({
      direction: "down",
      first: 10,
      last: 7,
      periods: 3,
    });
    expect(describeSeries([null, 7])).toBeNull();
  });
});
