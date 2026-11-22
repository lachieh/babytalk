import { formatElapsed } from "./format-elapsed";

describe("elapsed time display", () => {
  it("shows seconds from the first tick", () => {
    expect(formatElapsed(5000)).toBe("0:05");
  });

  it("formats short durations as minutes and seconds", () => {
    expect(formatElapsed(5 * 60_000 + 12_000)).toBe("5:12");
  });

  it("formats long durations as hours, minutes and seconds", () => {
    expect(formatElapsed((2 * 60 + 3) * 60_000 + 7000)).toBe("2:03:07");
  });

  it("never shows a negative time when clocks disagree", () => {
    expect(formatElapsed(-4000)).toBe("0:00");
  });
});
