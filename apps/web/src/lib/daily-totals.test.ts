import type { BabyEvent } from "./baby-context";
import {
  eventAwaitingAmount,
  formatSleepDuration,
  lastAmountMl,
  lastEventDetails,
  oneTapAction,
  totalFeeds,
} from "./daily-totals";

const NOW = Date.parse("2026-09-26T12:00:00Z");

const minutesAgo = (minutes: number): string =>
  new Date(NOW - minutes * 60_000).toISOString();

const event = (
  id: string,
  type: string,
  meta: Record<string, unknown>,
  startedMinutesAgo: number,
  endedMinutesAgo: number | null
): BabyEvent => ({
  endedAt: endedMinutesAgo === null ? null : minutesAgo(endedMinutesAgo),
  id,
  metadata: JSON.stringify(meta),
  startedAt: minutesAgo(startedMinutesAgo),
  type,
});

describe("sleep total display", () => {
  it("shows a dash instead of a zero when nothing was recorded", () => {
    expect(formatSleepDuration(0)).toBe("—");
    expect(formatSleepDuration(0.4)).toBe("—");
  });

  it("shows minutes alone under an hour", () => {
    expect(formatSleepDuration(45)).toBe("45m");
  });

  it("shows hours and minutes", () => {
    expect(formatSleepDuration(125)).toBe("2h 5m");
    expect(formatSleepDuration(120)).toBe("2h");
  });
});

describe("feed count", () => {
  it("counts feeds whether or not they have an amount", () => {
    const events = [
      event("a", "feed", { method: "breast", side: "left" }, 60, 50),
      event("b", "feed", { amountMl: 90, method: "bottle" }, 30, 20),
      event("c", "diaper", { soiled: false, wet: true }, 10, 10),
    ];
    expect(totalFeeds(events)).toBe(2);
  });
});

describe("last amount used", () => {
  it("returns the amount of the most recent event that has one", () => {
    const events = [
      event("newest", "feed", { method: "breast", side: "left" }, 5, 1),
      event("older", "feed", { amountMl: 60, method: "bottle" }, 300, 290),
      event("recent", "feed", { amountMl: 120, method: "formula" }, 90, 80),
      event("pump", "pump", { amountMl: 150, side: "both" }, 30, 10),
    ];
    expect(lastAmountMl(events, "feed")).toBe(120);
    expect(lastAmountMl(events, "pump")).toBe(150);
  });

  it("returns null when no amount was ever recorded", () => {
    expect(
      lastAmountMl([event("a", "feed", { method: "breast" }, 5, 1)], "feed")
    ).toBeNull();
  });
});

describe("event awaiting an amount", () => {
  it("picks the bottle that was stopped, not a breastfeed running beside it", () => {
    const events = [
      event("breast", "feed", { method: "breast", side: "left" }, 20, null),
      event("bottle", "feed", { method: "bottle" }, 15, 1),
    ];
    expect(eventAwaitingAmount(events, "feed", NOW)?.id).toBe("bottle");
  });

  it("does not ask after a breastfeed", () => {
    const events = [
      event("breast", "feed", { method: "breast", side: "right" }, 15, 1),
    ];
    expect(eventAwaitingAmount(events, "feed", NOW)).toBeNull();
  });

  it("asks after a pump session", () => {
    const events = [event("pump", "pump", { side: "both" }, 25, 2)];
    expect(eventAwaitingAmount(events, "pump", NOW)?.id).toBe("pump");
  });

  it("stops asking once an amount is saved, skipped, or too old", () => {
    const saved = event("s", "feed", { amountMl: 90, method: "bottle" }, 15, 1);
    const skipped = event("k", "feed", { method: "bottle" }, 15, 1);
    const old = event("o", "feed", { method: "formula" }, 90, 40);
    expect(eventAwaitingAmount([saved], "feed", NOW)).toBeNull();
    expect(
      eventAwaitingAmount([skipped], "feed", NOW, new Set(["k"]))
    ).toBeNull();
    expect(eventAwaitingAmount([old], "feed", NOW)).toBeNull();
  });

  it("ignores entries logged as a single finished moment", () => {
    const instant = event("i", "feed", { method: "bottle" }, 10, 10);
    expect(eventAwaitingAmount([instant], "feed", NOW)).toBeNull();
  });

  it("prefers the most recently stopped event", () => {
    const events = [
      event("first", "feed", { method: "bottle" }, 30, 10),
      event("second", "feed", { method: "formula" }, 40, 2),
    ];
    expect(eventAwaitingAmount(events, "feed", NOW)?.id).toBe("second");
  });
});

describe("last-event lines under the home summary", () => {
  it("uses an event logged a moment ago, not the one before it", () => {
    const events = [
      event("bottle", "feed", { amountMl: 118, method: "bottle" }, 0, 0),
      event("breast", "feed", { method: "breast", side: "left" }, 60, 40),
    ];
    const justNow = NOW + 20_000;
    events[0] = {
      ...events[0],
      startedAt: new Date(NOW + 10_000).toISOString(),
    };
    expect(lastEventDetails(events, justNow, "oz").feed).toStrictEqual({
      active: false,
      ago: "just now",
      detail: "4 oz · Bottle",
    });
  });

  it("names the breast side of the latest feed", () => {
    const events = [
      event("bottle", "feed", { amountMl: 118, method: "bottle" }, 30, 30),
      event("right", "feed", { method: "breast", side: "right" }, 5, null),
    ];
    expect(lastEventDetails(events, NOW, "oz").feed).toStrictEqual({
      active: true,
      ago: "feeding now",
      detail: "Right breast",
    });
  });

  it("says asleep while a sleep runs, even after an earlier nap ended", () => {
    const events = [
      event("nap", "sleep", {}, 120, 90),
      event("now", "sleep", {}, 1, null),
    ];
    expect(lastEventDetails(events, NOW, "ml").sleep).toStrictEqual({
      active: true,
      ago: "asleep now",
      detail: null,
    });
  });

  it("has a woke line for a sleep shorter than a minute", () => {
    const sleep = {
      ...event("short", "sleep", {}, 0, 0),
      startedAt: new Date(NOW - 30_000).toISOString(),
    };
    expect(lastEventDetails([sleep], NOW, "ml").sleep).toStrictEqual({
      active: false,
      ago: "just woke",
      detail: null,
    });
  });

  it("keeps the age short enough for one line", () => {
    const events = [
      event("nap", "sleep", {}, 200, 140),
      event("wet", "diaper", { wet: true }, 140, 140),
    ];
    const details = lastEventDetails(events, NOW, "ml");
    expect(details.sleep?.ago).toBe("awake 2h 20m");
    expect(details.sleep?.detail).toBe("slept 1h");
    expect(details.diaper?.ago).toBe("2h 20m ago");
  });

  it("ignores entries that start in the future", () => {
    const events = [event("later", "diaper", { wet: true }, -30, -30)];
    expect(lastEventDetails(events, NOW, "ml").diaper).toBeNull();
  });
});

describe("one tap on a log button", () => {
  it("asks for the amount of a bottle or formula feed instead of timing it", () => {
    expect(oneTapAction("feed", { method: "bottle" })).toBe("amount");
    expect(oneTapAction("feed", { method: "formula" })).toBe("amount");
  });

  it("logs a solid feed and a diaper as a single moment", () => {
    expect(oneTapAction("feed", { method: "solid" })).toBe("instant");
    expect(oneTapAction("diaper", { wet: true })).toBe("instant");
  });

  it("times breastfeeds, sleep and pumping", () => {
    expect(oneTapAction("feed", { method: "breast", side: "left" })).toBe(
      "timer"
    );
    expect(oneTapAction("sleep", { location: "crib" })).toBe("timer");
    expect(oneTapAction("pump", { side: "both" })).toBe("timer");
  });
});
