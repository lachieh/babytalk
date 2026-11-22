import type { BabyEvent } from "./baby-context";
import {
  BACKDATE_MINUTES,
  changeTiming,
  dayRange,
  durationWithinRange,
  editShape,
  entryShape,
  eventOverlapsRange,
  eventsOverlappingDay,
  logTimes,
  resolveEntryTiming,
  timingFromEvent,
  toLocalInput,
} from "./event-time";

const event = (overrides: Partial<BabyEvent> = {}): BabyEvent => ({
  endedAt: "2026-08-14T10:00:00.000Z",
  id: "event-1",
  metadata: "{}",
  startedAt: "2026-08-14T09:00:00.000Z",
  type: "sleep",
  ...overrides,
});

describe("event time ranges", () => {
  it("includes one overnight event in both calendar days", () => {
    const sleep = event({
      endedAt: "2026-08-15T06:00:00-04:00",
      startedAt: "2026-08-14T23:30:00-04:00",
    });

    expect(
      eventsOverlappingDay([sleep], new Date("2026-08-14T12:00:00Z"))
    ).toStrictEqual([sleep]);
    expect(
      eventsOverlappingDay([sleep], new Date("2026-08-15T12:00:00Z"))
    ).toStrictEqual([sleep]);
  });

  it("clips an overnight duration to each day", () => {
    const sleep = event({
      endedAt: "2026-08-15T06:00:00-04:00",
      startedAt: "2026-08-14T23:30:00-04:00",
    });

    expect(
      durationWithinRange(sleep, dayRange(new Date("2026-08-14T12:00:00Z")))
    ).toBe(30 * 60_000);
    expect(
      durationWithinRange(sleep, dayRange(new Date("2026-08-15T12:00:00Z")))
    ).toBe(6 * 60 * 60_000);
  });

  it("uses now as the end of an active event", () => {
    const sleep = event({
      endedAt: null,
      startedAt: "2026-08-14T23:30:00-04:00",
    });
    const now = new Date("2026-08-15T00:15:00-04:00").getTime();

    expect(
      durationWithinRange(
        sleep,
        dayRange(new Date("2026-08-15T12:00:00Z")),
        now
      )
    ).toBe(15 * 60_000);
  });

  it("does not double-count an event ending exactly at midnight", () => {
    const sleep = event({
      endedAt: "2026-08-15T00:00:00-04:00",
      startedAt: "2026-08-14T23:30:00-04:00",
    });

    expect(
      eventOverlapsRange(sleep, dayRange(new Date("2026-08-14T12:00:00Z")))
    ).toBeTruthy();
    expect(
      eventOverlapsRange(sleep, dayRange(new Date("2026-08-15T12:00:00Z")))
    ).toBeFalsy();
  });

  it("keeps point events on their start day", () => {
    const diaper = event({
      endedAt: "2026-08-14T23:30:00-04:00",
      startedAt: "2026-08-14T23:30:00-04:00",
      type: "diaper",
    });

    expect(
      eventsOverlappingDay([diaper], new Date("2026-08-14T12:00:00Z"))
    ).toStrictEqual([diaper]);
    expect(
      eventsOverlappingDay([diaper], new Date("2026-08-15T12:00:00Z"))
    ).toStrictEqual([]);
  });

  it("ignores invalid negative durations", () => {
    const sleep = event({
      endedAt: "2026-08-14T09:00:00.000Z",
      startedAt: "2026-08-14T10:00:00.000Z",
    });

    expect(
      eventOverlapsRange(sleep, dayRange(new Date("2026-08-14T12:00:00Z")))
    ).toBeFalsy();
    expect(
      durationWithinRange(sleep, dayRange(new Date("2026-08-14T12:00:00Z")))
    ).toBe(0);
  });

  it("uses calendar midnights across daylight-saving changes", () => {
    const springForward = dayRange(new Date("2026-03-08T12:00:00-04:00"));
    const fallBack = dayRange(new Date("2026-11-01T12:00:00-05:00"));

    expect(springForward.end - springForward.start).toBe(23 * 60 * 60_000);
    expect(fallBack.end - fallBack.start).toBe(25 * 60 * 60_000);
  });
});

describe("entry timing", () => {
  const now = new Date("2026-08-14T12:00:00Z").getTime();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

  it("treats bottle, formula and solid feeds as instant and breast as a span", () => {
    expect(entryShape("feed", "bottle")).toBe("instant");
    expect(entryShape("feed", "formula")).toBe("instant");
    expect(entryShape("feed", "solid")).toBe("instant");
    expect(entryShape("feed", "breast")).toBe("span");
    expect(entryShape("sleep")).toBe("span");
    expect(entryShape("pump")).toBe("span");
    expect(entryShape("diaper")).toBe("instant");
  });

  it("gives an instant entry the same start and end", () => {
    expect(
      resolveEntryTiming(
        "instant",
        { length: null, running: false, time: { kind: "ago", minutes: 30 } },
        now
      )
    ).toStrictEqual({
      endedAt: minutesAgo(30),
      ok: true,
      startedAt: minutesAgo(30),
    });
  });

  it("requires a length for a finished span instead of leaving it running", () => {
    expect(
      resolveEntryTiming(
        "span",
        { length: null, running: false, time: { kind: "ago", minutes: 0 } },
        now
      )
    ).toMatchObject({ field: "length", ok: false });
  });

  it("derives the start from the end and a preset length", () => {
    expect(
      resolveEntryTiming(
        "span",
        {
          length: { kind: "minutes", minutes: 20 },
          running: false,
          time: { kind: "ago", minutes: 15 },
        },
        now
      )
    ).toStrictEqual({
      endedAt: minutesAgo(15),
      ok: true,
      startedAt: minutesAgo(35),
    });
  });

  it("only leaves an entry running when that was chosen", () => {
    expect(
      resolveEntryTiming(
        "span",
        { length: null, running: true, time: { kind: "ago", minutes: 30 } },
        now
      )
    ).toStrictEqual({ endedAt: null, ok: true, startedAt: minutesAgo(30) });
  });

  it("rejects an end in the future", () => {
    expect(
      resolveEntryTiming(
        "span",
        {
          length: { kind: "minutes", minutes: 10 },
          running: false,
          time: { kind: "at", local: toLocalInput(now + 60 * 60_000) },
        },
        now
      )
    ).toMatchObject({ field: "time", message: "End can't be in the future." });
  });

  it("rejects a picked start at or after the end", () => {
    expect(
      resolveEntryTiming(
        "span",
        {
          length: { kind: "start", local: toLocalInput(now - 5 * 60_000) },
          running: false,
          time: { kind: "at", local: toLocalInput(now - 10 * 60_000) },
        },
        now
      )
    ).toMatchObject({
      field: "length",
      message: "Start must be before the end.",
    });
  });

  it("asks for a time when the picker is empty", () => {
    expect(
      resolveEntryTiming(
        "instant",
        { length: null, running: false, time: { kind: "at", local: "" } },
        now
      )
    ).toMatchObject({ field: "time", ok: false });
  });

  it("reads a saved span back as end plus matching preset", () => {
    expect(
      timingFromEvent(
        { endedAt: minutesAgo(10), startedAt: minutesAgo(30) },
        "span",
        [10, 20]
      )
    ).toStrictEqual({
      length: { kind: "minutes", minutes: 20 },
      running: false,
      stored: { endedAt: minutesAgo(10), startedAt: minutesAgo(30) },
      time: { kind: "at", local: toLocalInput(minutesAgo(10)) },
    });
  });

  it("reads a saved running span back as running", () => {
    expect(
      timingFromEvent({ endedAt: null, startedAt: minutesAgo(30) }, "span")
    ).toMatchObject({ running: true });
  });
});

describe("editing a stored entry", () => {
  const stored = (
    type: string,
    meta: Record<string, unknown>,
    startedAt: string,
    endedAt: string | null
  ) => event({ endedAt, metadata: JSON.stringify(meta), startedAt, type });

  const STORED = [
    stored(
      "feed",
      { method: "bottle" },
      "2026-08-14T03:00:00.000Z",
      "2026-08-14T03:20:00.000Z"
    ),
    stored(
      "feed",
      { method: "formula" },
      "2026-08-14T03:00:41.250Z",
      "2026-08-14T03:17:09.004Z"
    ),
    stored(
      "feed",
      { method: "bottle" },
      "2026-08-14T03:00:12.000Z",
      "2026-08-14T03:00:12.000Z"
    ),
    stored("feed", { method: "bottle" }, "2026-08-14T03:00:12.000Z", null),
    stored("feed", { method: "solid" }, "2026-08-14T03:00:00.000Z", null),
    stored(
      "feed",
      { method: "breast", side: "left" },
      "2026-08-14T02:59:30.500Z",
      "2026-08-14T03:14:45.000Z"
    ),
    stored("feed", { method: "breast" }, "2026-08-14T03:00:30.000Z", null),
    stored(
      "sleep",
      { location: "crib" },
      "2026-08-13T23:41:07.000Z",
      "2026-08-14T05:02:58.000Z"
    ),
    stored("sleep", { location: "held" }, "2026-08-14T03:00:30.000Z", null),
    stored(
      "pump",
      { side: "both" },
      "2026-08-14T03:00:00.000Z",
      "2026-08-14T03:15:00.000Z"
    ),
    stored(
      "diaper",
      { wet: true },
      "2026-08-14T03:00:59.999Z",
      "2026-08-14T03:00:59.999Z"
    ),
    stored("diaper", { wet: true }, "2026-08-14T03:00:00.000Z", null),
    stored("note", { text: "hi" }, "2026-08-14T03:00:00.000Z", null),
  ];

  const reopen = (e: BabyEvent) => {
    const shape = editShape(e, e.type, JSON.parse(e.metadata).method);
    return { shape, timing: timingFromEvent(e, shape, [5, 10, 15, 20, 30]) };
  };

  it.each(STORED)(
    "saves a $type from $startedAt to $endedAt unchanged when timing was not touched",
    (e) => {
      const { shape, timing } = reopen(e);
      expect(
        resolveEntryTiming(shape, timing, Date.parse("2026-08-14T12:00:00Z"))
      ).toStrictEqual({ endedAt: e.endedAt, ok: true, startedAt: e.startedAt });
    }
  );

  it("opens a timed bottle feed as a span, so its duration is shown", () => {
    const { shape, timing } = reopen(STORED[0]);
    expect(shape).toBe("span");
    expect(timing).toMatchObject({
      length: { kind: "minutes", minutes: 20 },
      running: false,
    });
  });

  it("opens a running bottle feed as running instead of ending it", () => {
    const { shape, timing } = reopen(STORED[3]);
    expect(shape).toBe("span");
    expect(timing.running).toBeTruthy();
  });

  it("keeps new bottle, formula and solid entries instant", () => {
    for (const method of ["bottle", "formula", "solid"]) {
      expect(editShape(null, "feed", method)).toBe("instant");
    }
    expect(editShape(STORED[2], "feed", "bottle")).toBe("instant");
  });

  it("uses the new timing once a timing field is changed", () => {
    const { shape, timing } = reopen(STORED[0]);
    const edited = changeTiming(timing, {
      length: { kind: "minutes", minutes: 10 },
    });
    expect(
      resolveEntryTiming(shape, edited, Date.parse("2026-08-14T12:00:00Z"))
    ).toStrictEqual({
      endedAt: "2026-08-14T03:20:00.000Z",
      ok: true,
      startedAt: "2026-08-14T03:10:00.000Z",
    });
  });
});

describe("log timing", () => {
  const now = new Date("2026-03-01T08:30:00.000Z").getTime();

  it("offers now first, then earlier starts", () => {
    expect([...BACKDATE_MINUTES]).toStrictEqual([0, 5, 10, 15, 30]);
  });

  it("leaves a timer that starts now to the server default", () => {
    expect(logTimes(0, false, now)).toStrictEqual({});
  });

  it("backdates the start of a running timer without ending it", () => {
    expect(logTimes(10, false, now)).toStrictEqual({
      _startedAt: "2026-03-01T08:20:00.000Z",
    });
  });

  it("records a finished entry as a single moment", () => {
    expect(logTimes(10, true, now)).toStrictEqual({
      _endedAt: "2026-03-01T08:20:00.000Z",
      _startedAt: "2026-03-01T08:20:00.000Z",
    });
    expect(logTimes(0, true, now)).toStrictEqual({
      _endedAt: "2026-03-01T08:30:00.000Z",
      _startedAt: "2026-03-01T08:30:00.000Z",
    });
  });
});
