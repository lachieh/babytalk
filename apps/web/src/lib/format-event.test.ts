import type { BabyEvent } from "./baby-context";
import {
  formatDuration,
  formatEventParts,
  formatEventTimes,
  timerLabel,
} from "./format-event";

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 7, 14, 9, minutes)).toISOString();

const event = (
  type: string,
  meta: Record<string, unknown>,
  durationMinutes: number | null = 0
): BabyEvent => ({
  endedAt: durationMinutes === null ? null : at(durationMinutes),
  id: "e1",
  metadata: JSON.stringify(meta),
  startedAt: at(0),
  type,
});

const detail = (e: BabyEvent) => formatEventParts(e).detail;

describe("duration text", () => {
  it("uses min under an hour and h/m above", () => {
    expect(formatDuration(at(0), at(20), "feed")).toBe("20 min");
    expect(formatDuration(at(0), at(90), "sleep")).toBe("1h 30m");
    expect(formatDuration(at(0), at(120), "sleep")).toBe("2h");
  });

  it("is empty for instants, running and zero-length events", () => {
    expect(formatDuration(at(0), at(5), "diaper")).toBeNull();
    expect(formatDuration(at(0), null, "sleep")).toBeNull();
    expect(formatDuration(at(0), at(0), "feed")).toBeNull();
  });
});

describe("event detail text", () => {
  it("puts the method first and a spaced unit after", () => {
    expect(detail(event("feed", { amountMl: 120, method: "bottle" }))).toBe(
      "Bottle · 120 ml"
    );
  });

  it("joins breast side and duration", () => {
    expect(detail(event("feed", { method: "breast", side: "right" }, 20))).toBe(
      "Breast, right · 20 min"
    );
  });

  it("capitalises the sleep location before the duration", () => {
    expect(detail(event("sleep", { location: "carrier" }, 90))).toBe(
      "Carrier · 1h 30m"
    );
  });

  it("leaves no dangling separator while sleep is in progress", () => {
    expect(detail(event("sleep", { location: "carrier" }, null))).toBe(
      "Carrier"
    );
    expect(detail(event("sleep", {}, null))).toBeNull();
  });

  it("describes pumps by side, amount and duration", () => {
    expect(detail(event("pump", { amountMl: 90, side: "both" }, 15))).toBe(
      "Both · 90 ml · 15 min"
    );
    expect(detail(event("pump", {}, 0))).toBeNull();
  });

  it("describes diapers in words", () => {
    expect(detail(event("diaper", { soiled: true, wet: true }))).toBe(
      "Wet and soiled"
    );
    expect(detail(event("diaper", { color: "Yellow", soiled: true }))).toBe(
      "Soiled, yellow"
    );
  });

  it("labels feeds without a known method plainly", () => {
    expect(formatEventParts(event("feed", {}))).toStrictEqual({
      detail: null,
      label: "Feed",
    });
  });
});

describe("event row times", () => {
  it("shows a single time for an instant bottle feed", () => {
    const bottle = event("feed", { method: "bottle" }, 0);
    expect(formatEventTimes(bottle).distinctEnd).toBeNull();
    expect(
      formatEventTimes({
        ...bottle,
        endedAt: new Date(Date.UTC(2026, 7, 14, 9, 0, 40)).toISOString(),
      }).distinctEnd
    ).toBeNull();
  });

  it("shows the end of a span and flags running spans", () => {
    const feed = event("feed", { method: "breast" }, 20);
    const times = formatEventTimes(feed);
    expect(times.distinctEnd).not.toBeNull();
    expect(times.distinctEnd).not.toBe(times.start);
    expect(formatEventTimes(event("sleep", {}, null))).toMatchObject({
      distinctEnd: null,
      inProgress: true,
    });
  });
});

const timerEvent = (type: string, meta: Record<string, unknown>) => ({
  metadata: JSON.stringify(meta),
  type,
});

describe("running timer label", () => {
  it("names a bottle feed", () => {
    expect(timerLabel(timerEvent("feed", { method: "bottle" }))).toBe(
      "Feed · Bottle"
    );
  });

  it("names the breast side", () => {
    expect(
      timerLabel(timerEvent("feed", { method: "breast", side: "left" }))
    ).toBe("Feed · Left breast");
  });

  it("names where the baby is sleeping", () => {
    expect(timerLabel(timerEvent("sleep", { location: "carrier" }))).toBe(
      "Sleep · Carrier"
    );
  });

  it("names the pumping side", () => {
    expect(timerLabel(timerEvent("pump", { side: "both" }))).toBe(
      "Pump · Both sides"
    );
    expect(timerLabel(timerEvent("pump", { side: "right" }))).toBe(
      "Pump · Right"
    );
  });

  it("falls back to the type when details are missing or unreadable", () => {
    expect(timerLabel(timerEvent("sleep", {}))).toBe("Sleep");
    expect(timerLabel({ metadata: "not json", type: "feed" })).toBe("Feed");
  });
});
