import { formatElapsed } from "./format-elapsed";

describe("elapsed time display", () => {
  it("formats elapsed time as hours and minutes", () => {
    expect(formatElapsed(5 * 60_000)).toBe("0:05");
    expect(formatElapsed((2 * 60 + 30) * 60_000)).toBe("2:30");
  });
});
