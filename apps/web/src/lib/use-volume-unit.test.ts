import { displayToMl, mlToDisplay } from "./use-volume-unit";

describe("ounce slider steps", () => {
  it("shows every half-ounce step as the amount picked", () => {
    for (let oz = 0.5; oz <= 8; oz += 0.5) {
      expect(mlToDisplay(displayToMl(oz, "oz"), "oz")).toBe(oz);
    }
  });
});
