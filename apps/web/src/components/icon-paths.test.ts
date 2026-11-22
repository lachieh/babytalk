import { readFileSync } from "node:fs";

import { ICON_PATHS, pebblePath } from "./icon-paths";

const numbers = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe(pebblePath, () => {
  it("draws the same outline as the app icon", () => {
    const svg = readFileSync(
      new URL("../../public/icons/icon.svg", import.meta.url),
      "utf8"
    );
    const drawn = /fill="#655f35" d="([^"]+)"/.exec(svg)?.[1] ?? "";
    expect(numbers(pebblePath(8, 3.04, 496))).toStrictEqual(numbers(drawn));
  });

  it("joins its arcs smoothly: each is a quarter ellipse between extreme points", () => {
    const n = numbers(pebblePath(0, 0, 100));
    let [x, y] = n;
    for (let i = 2; i < n.length; i += 7) {
      const [rx, ry] = n.slice(i, i + 2);
      const [nx, ny] = n.slice(i + 5, i + 7);
      expect(Math.abs(nx - x)).toBeCloseTo(rx);
      expect(Math.abs(ny - y)).toBeCloseTo(ry);
      [x, y] = [nx, ny];
    }
  });
});

describe("icon glyphs", () => {
  it("keeps every glyph inside the 24px grid", () => {
    for (const d of Object.values(ICON_PATHS)) {
      for (const [, args] of d.matchAll(/[MLHVQCA]([^a-zA-Z]*)/g)) {
        for (const value of numbers(args)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(24);
        }
      }
    }
  });
});
