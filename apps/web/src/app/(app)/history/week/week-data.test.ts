import type { BabyEvent } from "@/lib/baby-context";

import {
  buildWeekMarks,
  describeDay,
  filterWeekEvents,
  formatSpan,
  getWeekStart,
  summarizeWeek,
  weekDayIndex,
  weekDayStart,
} from "./week-data";

let nextId = 0;
const iso = (value: Date | string) =>
  typeof value === "string" ? value : value.toISOString();
const make = (
  type: BabyEvent["type"],
  startedAt: Date | string,
  endedAt: Date | string | null = null
): BabyEvent => {
  nextId += 1;
  return {
    endedAt: endedAt === null ? null : iso(endedAt),
    id: `${type}-${nextId}`,
    metadata: "{}",
    startedAt: iso(startedAt),
    type,
  };
};

const HOUR = 3_600_000;

const WEEK = new Date(2026, 7, 16);
const AFTER_WEEK = new Date(2026, 8, 1).getTime();

const shape = (marks: ReturnType<typeof buildWeekMarks>) =>
  marks.map((mark) => ({
    after: mark.continuesAfter,
    before: mark.continuesBefore,
    day: mark.dayIdx,
    end: mark.endHour,
    kind: mark.kind,
    open: mark.openEnd,
    start: mark.startHour,
  }));

describe("week event filtering", () => {
  it("reads the eventsOverlappingRange field and keeps every placeable type", () => {
    const feed = make("feed", new Date(2026, 7, 17, 9));
    const pump = make("pump", new Date(2026, 7, 17, 10));

    expect(
      filterWeekEvents({ eventsOverlappingRange: [feed, pump] })
    ).toStrictEqual([feed, pump]);
  });

  it("drops events whose start time cannot be read", () => {
    const feed = make("feed", new Date(2026, 7, 17, 9));
    const broken = make("sleep", "not a date");

    expect(
      filterWeekEvents({ eventsOverlappingRange: [broken, feed] })
    ).toStrictEqual([feed]);
  });
});

describe("week start", () => {
  it("is local midnight of the Sunday on or before the date", () => {
    expect(getWeekStart(new Date(2026, 7, 19, 15, 30))).toStrictEqual(WEEK);
    expect(getWeekStart(new Date(2026, 7, 16, 0, 0))).toStrictEqual(WEEK);
    expect(getWeekStart(new Date(2026, 7, 22, 23, 59))).toStrictEqual(WEEK);
  });

  it("stays on local midnight across both DST changes", () => {
    expect(getWeekStart(new Date(2026, 2, 11, 15))).toStrictEqual(
      new Date("2026-03-08T05:00:00.000Z")
    );
    expect(getWeekStart(new Date(2026, 10, 4, 15))).toStrictEqual(
      new Date("2026-11-01T04:00:00.000Z")
    );
    expect(weekDayStart(new Date(2026, 2, 8), 7)).toStrictEqual(
      new Date("2026-03-15T04:00:00.000Z")
    );
    expect(weekDayStart(new Date(2026, 10, 1), 7)).toStrictEqual(
      new Date("2026-11-08T05:00:00.000Z")
    );
  });
});

describe("week marks", () => {
  it("places a finished event inside one day by wall-clock time", () => {
    const marks = buildWeekMarks(
      [make("feed", new Date(2026, 7, 18, 9, 30), new Date(2026, 7, 18, 10))],
      WEEK,
      AFTER_WEEK
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: false,
        before: false,
        day: 2,
        end: 10,
        kind: "span",
        open: false,
        start: 9.5,
      },
    ]);
  });

  it("splits an event that crosses midnight into one piece per day", () => {
    const marks = buildWeekMarks(
      [
        make(
          "sleep",
          new Date(2026, 7, 18, 22, 30),
          new Date(2026, 7, 19, 6, 15)
        ),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: true,
        before: false,
        day: 2,
        end: 24,
        kind: "span",
        open: false,
        start: 22.5,
      },
      {
        after: false,
        before: true,
        day: 3,
        end: 6.25,
        kind: "span",
        open: false,
        start: 0,
      },
    ]);
  });

  it("clips events that cross the start or the end of the week", () => {
    const marks = buildWeekMarks(
      [
        make("sleep", new Date(2026, 7, 15, 23), new Date(2026, 7, 16, 5)),
        make("sleep", new Date(2026, 7, 22, 21), new Date(2026, 7, 23, 4)),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: false,
        before: true,
        day: 0,
        end: 5,
        kind: "span",
        open: false,
        start: 0,
      },
      {
        after: true,
        before: false,
        day: 6,
        end: 24,
        kind: "span",
        open: false,
        start: 21,
      },
    ]);
  });

  it("leaves out events that only touch the week boundaries", () => {
    const marks = buildWeekMarks(
      [
        make("sleep", new Date(2026, 7, 15, 20), new Date(2026, 7, 16, 0)),
        make("sleep", new Date(2026, 7, 23, 0), new Date(2026, 7, 23, 3)),
        make("diaper", new Date(2026, 7, 15, 23, 59)),
        make("diaper", new Date(2026, 7, 23, 0)),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(marks).toStrictEqual([]);
  });

  it("runs an event with no end up to now and marks that end as open", () => {
    const now = new Date(2026, 7, 19, 14, 45).getTime();
    const marks = buildWeekMarks(
      [make("sleep", new Date(2026, 7, 19, 13))],
      WEEK,
      now
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: false,
        before: false,
        day: 3,
        end: 14.75,
        kind: "span",
        open: true,
        start: 13,
      },
    ]);
    expect(marks[0].running).toBeTruthy();
  });

  it("only opens the last piece of a running event that crossed midnight", () => {
    const now = new Date(2026, 7, 20, 2).getTime();
    const marks = buildWeekMarks(
      [make("sleep", new Date(2026, 7, 19, 21))],
      WEEK,
      now
    );

    expect(marks.map((mark) => [mark.dayIdx, mark.openEnd])).toStrictEqual([
      [3, false],
      [4, true],
    ]);
    expect(marks.every((mark) => mark.running)).toBeTruthy();
  });

  it("clips a still-running event at the end of a past week without opening it", () => {
    const marks = buildWeekMarks(
      [make("sleep", new Date(2026, 7, 22, 20))],
      WEEK,
      AFTER_WEEK
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: true,
        before: false,
        day: 6,
        end: 24,
        kind: "span",
        open: false,
        start: 20,
      },
    ]);
    expect(marks[0].running).toBeTruthy();
  });

  it("draws diapers, notes and zero-length events as instants", () => {
    const at = new Date(2026, 7, 17, 8, 15);
    const marks = buildWeekMarks(
      [
        make("diaper", at),
        make("note", at, new Date(2026, 7, 17, 9)),
        make("feed", at, at),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(marks.map((mark) => [mark.kind, mark.startHour])).toStrictEqual([
      ["instant", 8.25],
      ["instant", 8.25],
      ["instant", 8.25],
    ]);
  });

  it("keeps an event whose end is before its start, as an instant", () => {
    const marks = buildWeekMarks(
      [make("feed", new Date(2026, 7, 17, 9), new Date(2026, 7, 17, 8))],
      WEEK,
      AFTER_WEEK
    );

    expect(shape(marks)).toStrictEqual([
      {
        after: false,
        before: false,
        day: 1,
        end: 9,
        kind: "instant",
        open: false,
        start: 9,
      },
    ]);
  });

  it("does not stretch a timer whose start is still in the future", () => {
    const now = new Date(2026, 7, 17, 9).getTime();
    const marks = buildWeekMarks(
      [make("sleep", new Date(2026, 7, 17, 9, 5))],
      WEEK,
      now
    );

    expect(marks.map((mark) => [mark.kind, mark.running])).toStrictEqual([
      ["instant", false],
    ]);
  });

  it("skips events with an unreadable start", () => {
    expect(
      buildWeekMarks([make("sleep", "nope")], WEEK, AFTER_WEEK)
    ).toStrictEqual([]);
  });

  it("orders pieces by day, then time", () => {
    const late = make("diaper", new Date(2026, 7, 17, 18));
    const early = make("diaper", new Date(2026, 7, 17, 6));
    const sunday = make("diaper", new Date(2026, 7, 16, 23));

    const marks = buildWeekMarks([late, early, sunday], WEEK, AFTER_WEEK);

    expect(marks.map((mark) => mark.event.id)).toStrictEqual([
      sunday.id,
      early.id,
      late.id,
    ]);
  });
});

describe("week marks across DST (America/New_York)", () => {
  const SPRING = new Date(2026, 2, 8);
  const FALL = new Date(2026, 10, 1);
  const LATER = new Date(2026, 11, 1).getTime();

  it("keeps day columns aligned in the 23-hour spring week", () => {
    const marks = buildWeekMarks(
      [
        make("sleep", "2026-03-08T06:00:00.000Z", "2026-03-08T08:00:00.000Z"),
        make("diaper", "2026-03-09T04:30:00.000Z"),
        make("diaper", "2026-03-15T03:30:00.000Z"),
        make("diaper", "2026-03-15T04:00:00.000Z"),
      ],
      SPRING,
      LATER
    );

    expect(
      marks.map((mark) => [mark.dayIdx, mark.startHour, mark.endHour])
    ).toStrictEqual([
      [0, 1, 4],
      [1, 0.5, 0.5],
      [6, 23.5, 23.5],
    ]);
  });

  it("splits at local midnight, not 24 hours on, in the spring week", () => {
    const marks = buildWeekMarks(
      [make("sleep", "2026-03-08T05:00:00.000Z", "2026-03-10T04:00:00.000Z")],
      SPRING,
      LATER
    );

    expect(
      marks.map((mark) => [mark.dayIdx, mark.startHour, mark.endHour])
    ).toStrictEqual([
      [0, 0, 24],
      [1, 0, 24],
    ]);
  });

  it("never ends a piece before it starts in the repeated autumn hour", () => {
    const marks = buildWeekMarks(
      [make("sleep", "2026-11-01T05:50:00.000Z", "2026-11-01T06:10:00.000Z")],
      FALL,
      LATER
    );

    expect(marks).toHaveLength(1);
    expect(marks[0].dayIdx).toBe(0);
    expect(marks[0].endHour).toBe(marks[0].startHour);
    expect(marks[0].startHour).toBeCloseTo(1 + 50 / 60, 6);
  });

  it("keeps the 25-hour autumn Sunday in one column", () => {
    const marks = buildWeekMarks(
      [
        make("sleep", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"),
        make("diaper", "2026-11-02T05:30:00.000Z"),
      ],
      FALL,
      LATER
    );

    expect(
      marks.map((mark) => [mark.dayIdx, mark.startHour, mark.endHour])
    ).toStrictEqual([
      [0, 0, 24],
      [1, 0.5, 0.5],
    ]);
  });

  it("indexes days by calendar date on both sides of a change", () => {
    expect(weekDayIndex(new Date("2026-03-08T04:59:00.000Z"), SPRING)).toBe(-1);
    expect(weekDayIndex(new Date("2026-03-14T03:59:00.000Z"), SPRING)).toBe(5);
    expect(weekDayIndex(new Date("2026-03-14T04:00:00.000Z"), SPRING)).toBe(6);
    expect(weekDayIndex(new Date("2026-11-07T05:00:00.000Z"), FALL)).toBe(6);
    expect(weekDayIndex(new Date("2026-11-08T05:00:00.000Z"), FALL)).toBe(7);
  });

  it("totals real elapsed sleep on short and long days", () => {
    const spring = summarizeWeek(
      [make("sleep", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z")],
      SPRING,
      LATER
    );
    const fall = summarizeWeek(
      [make("sleep", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z")],
      FALL,
      LATER
    );

    expect(spring[0].sleepMs).toBe(23 * HOUR);
    expect(spring[1].sleepMs).toBe(0);
    expect(fall[0].sleepMs).toBe(25 * HOUR);
    expect(fall[1].sleepMs).toBe(0);
  });
});

describe("week summaries", () => {
  it("counts events on the day they start and shares sleep across midnight", () => {
    const days = summarizeWeek(
      [
        make(
          "sleep",
          new Date(2026, 7, 18, 22, 30),
          new Date(2026, 7, 19, 6, 15)
        ),
        make("feed", new Date(2026, 7, 18, 23, 50), new Date(2026, 7, 19, 0)),
        make("diaper", new Date(2026, 7, 19, 7)),
        make("pump", new Date(2026, 7, 19, 8), new Date(2026, 7, 19, 8, 20)),
        make("note", new Date(2026, 7, 19, 9)),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(days).toHaveLength(7);
    expect(days[2]).toStrictEqual({
      date: new Date(2026, 7, 18),
      diapers: 0,
      feeds: 1,
      notes: 0,
      pumps: 0,
      sleepMs: 1.5 * HOUR,
      sleeps: 1,
    });
    expect(days[3]).toStrictEqual({
      date: new Date(2026, 7, 19),
      diapers: 1,
      feeds: 0,
      notes: 1,
      pumps: 1,
      sleepMs: 6.25 * HOUR,
      sleeps: 1,
    });
  });

  it("counts a running sleep only up to now", () => {
    const now = new Date(2026, 7, 19, 14, 45).getTime();
    const days = summarizeWeek(
      [make("sleep", new Date(2026, 7, 19, 13))],
      WEEK,
      now
    );

    expect(days[3].sleepMs).toBe(1.75 * HOUR);
    expect(days[4].sleepMs).toBe(0);
  });

  it("ignores events outside the week", () => {
    const days = summarizeWeek(
      [
        make("feed", new Date(2026, 7, 15, 12)),
        make("diaper", new Date(2026, 7, 23, 0)),
      ],
      WEEK,
      AFTER_WEEK
    );

    expect(days.map(describeDay)).toStrictEqual(
      Array.from({ length: 7 }, () => "Nothing logged")
    );
  });

  it("describes a day in one line", () => {
    expect(
      describeDay({
        date: WEEK,
        diapers: 8,
        feeds: 1,
        notes: 0,
        pumps: 2,
        sleepMs: 13 * HOUR + 20 * 60_000,
        sleeps: 6,
      })
    ).toBe("13h 20m sleep, 1 feed, 8 diapers, 2 pumps");
  });

  it("formats spans to the minute", () => {
    expect(formatSpan(20_000)).toBe("1m");
    expect(formatSpan(45 * 60_000)).toBe("45m");
    expect(formatSpan(2 * HOUR)).toBe("2h");
    expect(formatSpan(2 * HOUR + 5 * 60_000)).toBe("2h 5m");
  });
});
