import type { BabyEvent } from "./baby-context";
import {
  dayRange,
  durationWithinRange,
  eventOverlapsRange,
  eventsOverlappingDay,
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
