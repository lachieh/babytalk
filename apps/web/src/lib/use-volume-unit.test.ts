import { amountChips } from "./use-volume-unit";

describe("amount quick picks", () => {
  it("offers the last amount with one ounce either side", () => {
    expect(amountChips(118, "oz")).toStrictEqual([3, 4, 5]);
  });

  it("offers the last amount with 30 ml either side", () => {
    expect(amountChips(120, "ml")).toStrictEqual([90, 120, 150]);
  });

  it("snaps an untidy converted amount to a pourable one", () => {
    expect(amountChips(100, "oz")).toStrictEqual([2.5, 3.5, 4.5]);
    expect(amountChips(118, "ml")).toStrictEqual([90, 120, 150]);
  });

  it("starts from a typical bottle when there is no history", () => {
    expect(amountChips(null, "oz")).toStrictEqual([3, 4, 5]);
    expect(amountChips(null, "ml")).toStrictEqual([90, 120, 150]);
  });

  it("never offers zero or less for small amounts", () => {
    expect(amountChips(30, "oz")).toStrictEqual([0.5, 1, 2]);
    expect(amountChips(30, "ml")).toStrictEqual([15, 30, 60]);
  });
});
