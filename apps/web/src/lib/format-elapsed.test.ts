import { formatElapsed } from "./format-elapsed";

describe("elapsed time display", () => {
  it("formats short durations as minutes and seconds", () => {
    expect(formatElapsed(5 * 60_000 + 12_000)).toBe("5m 12s");
  });

  it("formats long durations as hours and minutes", () => {
    expect(formatElapsed((2 * 60 + 30) * 60_000)).toBe("2h 30m");
  });
});
