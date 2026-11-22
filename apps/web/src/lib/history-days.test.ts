import type { BabyEvent } from "./baby-context";
import {
  coverageCaption,
  fullyCoveredDays,
  groupEventsByDay,
  parseYmd,
  recapDays,
  recentDays,
  ymd,
} from "./history-days";

const at = (startedAt: Date, id = startedAt.toISOString()): BabyEvent => ({
  endedAt: null,
  id,
  metadata: "{}",
  startedAt: startedAt.toISOString(),
  type: "diaper",
});

const today = new Date(2026, 10, 21, 15, 0);

describe("ymd and parseYmd", () => {
  it("round-trips a local date", () => {
    expect(ymd(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(parseYmd("2026-01-05")?.getTime()).toBe(
      new Date(2026, 0, 5).getTime()
    );
  });

  it("rejects malformed and overflowing dates", () => {
    expect(parseYmd(null)).toBeNull();
    expect(parseYmd("2026-1-5")).toBeNull();
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("2026-13-01")).toBeNull();
  });
});

describe(groupEventsByDay, () => {
  it("groups by local start day and keeps newest-first order", () => {
    const a = at(new Date(2026, 10, 21, 9), "a");
    const b = at(new Date(2026, 10, 21, 1), "b");
    const c = at(new Date(2026, 10, 20, 23, 30), "c");

    const groups = groupEventsByDay([a, b, c]);

    expect(groups.map((g) => g.key)).toStrictEqual([
      "2026-11-21",
      "2026-11-20",
    ]);
    expect(groups[0].events).toStrictEqual([a, b]);
    expect(groups[1].events).toStrictEqual([c]);
    expect(groups[1].date.getTime()).toBe(new Date(2026, 10, 20).getTime());
  });
});

describe(recentDays, () => {
  it("lists local midnights from today backwards across a month boundary", () => {
    expect(recentDays(new Date(2026, 11, 2, 8), 3).map(ymd)).toStrictEqual([
      "2026-12-02",
      "2026-12-01",
      "2026-11-30",
    ]);
  });
});

describe(fullyCoveredDays, () => {
  it("covers every requested day when the fetch returned fewer than the limit", () => {
    const events = [at(new Date(2026, 10, 21, 9))];
    expect(fullyCoveredDays({ events, limit: 100, maxDays: 14, today })).toBe(
      14
    );
  });

  it("excludes the oldest, possibly truncated day when the limit was hit", () => {
    const events = [
      at(new Date(2026, 10, 21, 9), "1"),
      at(new Date(2026, 10, 19, 12), "2"),
      at(new Date(2026, 10, 17, 18), "3"),
    ];
    expect(fullyCoveredDays({ events, limit: 3, maxDays: 14, today })).toBe(4);
  });

  it("never exceeds the requested window or drops below today", () => {
    const old = [
      at(new Date(2026, 9, 1), "1"),
      at(new Date(2026, 10, 21), "2"),
    ];
    expect(
      fullyCoveredDays({ events: old, limit: 2, maxDays: 14, today })
    ).toBe(14);

    const allToday = [
      at(new Date(2026, 10, 21, 1), "1"),
      at(new Date(2026, 10, 21, 2), "2"),
    ];
    expect(
      fullyCoveredDays({ events: allToday, limit: 2, maxDays: 14, today })
    ).toBe(1);
  });
});

describe("recapDays and coverageCaption", () => {
  it("lists only today when nothing else was logged, and says so", () => {
    const { covered, days } = recapDays({
      events: [at(new Date(2026, 10, 21, 9, 0))],
      maxDays: 14,
      now: today.getTime(),
      today,
    });
    expect(covered).toBe(14);
    expect(days.map(ymd)).toStrictEqual(["2026-11-21"]);
    expect(coverageCaption(days.length, covered)).toBe("Showing today");
  });

  it("counts the days listed, not the days searched", () => {
    const { covered, days } = recapDays({
      events: [
        at(new Date(2026, 10, 21, 9, 0)),
        at(new Date(2026, 10, 18, 9, 0)),
      ],
      maxDays: 14,
      now: today.getTime(),
      today,
    });
    expect(days.map(ymd)).toStrictEqual(["2026-11-21", "2026-11-18"]);
    expect(coverageCaption(days.length, covered)).toBe(
      "Showing 2 days with entries from the last 14"
    );
  });

  it("keeps the short caption when every covered day is listed", () => {
    expect(coverageCaption(3, 3)).toBe("Showing the last 3 days");
  });
});
