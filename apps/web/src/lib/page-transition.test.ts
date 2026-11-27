import { navTransitionTypes } from "./page-transition";

describe("the direction a tab change slides", () => {
  it("goes forward to a tab further along", () => {
    expect(navTransitionTypes(0, 2)).toStrictEqual(["nav-forward"]);
  });

  it("goes back to a tab earlier on", () => {
    expect(navTransitionTypes(3, 1)).toStrictEqual(["nav-back"]);
  });

  it("does not slide when staying on the same tab", () => {
    expect(navTransitionTypes(1, 1)).toBeUndefined();
  });

  it("does not slide from a page that is not a tab", () => {
    expect(navTransitionTypes(-1, 1)).toBeUndefined();
  });
});
