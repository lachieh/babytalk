import { formatRelativeAge } from "./format-relative-age";

describe("relative age labels", () => {
  it("uses just now for a recent event", () => {
    expect(formatRelativeAge(0.5)).toBe("just now");
  });

  it("formats minutes and hours", () => {
    expect(formatRelativeAge(12)).toBe("12m ago");
    expect(formatRelativeAge(60)).toBe("1h ago");
    expect(formatRelativeAge(125)).toBe("2h 5m ago");
  });
});
