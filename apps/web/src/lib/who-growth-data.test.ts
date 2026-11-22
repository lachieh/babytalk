import {
  WHO_MAX_AGE_DAYS,
  formatPercentile,
  getPercentileData,
  interpolatePercentile,
  percentilePosition,
  referenceSexFor,
} from "./who-growth-data";
import type { GrowthMetric, PercentileKey } from "./who-growth-data";

const METRICS: GrowthMetric[] = ["weight", "length", "head"];
const KEYS: PercentileKey[] = ["p3", "p15", "p50", "p85", "p97"];

const table = (metric: GrowthMetric, gender: "male" | "female") => {
  const data = getPercentileData(metric, gender);
  if (!data) throw new Error("missing table");
  return data;
};

describe("reference selection", () => {
  it("uses the boys' table for male and the girls' for female", () => {
    expect(referenceSexFor("male")).toBe("boys");
    expect(referenceSexFor("female")).toBe("girls");
    expect(table("weight", "male")[0].p50).toBeGreaterThan(
      table("weight", "female")[0].p50
    );
  });

  it("has no reference when sex is unknown or other", () => {
    expect(getPercentileData("weight", null)).toBeNull();
    expect(getPercentileData("weight", "other")).toBeNull();
  });
});

describe("who tables", () => {
  it.each([
    ["weight", "male", 0, 3350],
    ["weight", "male", 183, 7940],
    ["weight", "male", 365, 9650],
    ["weight", "female", 0, 3230],
    ["weight", "female", 183, 7300],
    ["weight", "female", 365, 8950],
    ["length", "male", 0, 499],
    ["length", "male", 183, 676],
    ["length", "female", 183, 658],
    ["length", "female", 365, 740],
    ["head", "male", 0, 345],
    ["head", "male", 183, 433],
    ["head", "female", 0, 339],
    ["head", "female", 365, 449],
  ] as const)(
    "%s median for %s at day %i is %i",
    (metric, gender, days, expected) => {
      expect(interpolatePercentile(table(metric, gender), days, "p50")).toBe(
        expected
      );
    }
  );

  it("covers birth to 24 months with ages in days", () => {
    for (const metric of METRICS) {
      for (const gender of ["male", "female"] as const) {
        const data = table(metric, gender);
        expect(data[0].days).toBe(0);
        expect(data.at(-1)?.days).toBe(WHO_MAX_AGE_DAYS);
      }
    }
  });

  it("rises across percentiles in every row", () => {
    for (const metric of METRICS) {
      for (const gender of ["male", "female"] as const) {
        for (const row of table(metric, gender)) {
          const values = KEYS.map((key) => row[key]);
          expect(values).toStrictEqual(values.toSorted((x, y) => x - y));
          expect(new Set(values).size).toBe(KEYS.length);
        }
      }
    }
  });

  it("rises with age", () => {
    for (const metric of METRICS) {
      for (const gender of ["male", "female"] as const) {
        const data = table(metric, gender);
        for (const key of ["days", "p3", "p50", "p97"] as const) {
          const column = data.map((row) => row[key]);
          expect(column).toStrictEqual(column.toSorted((x, y) => x - y));
          expect(new Set(column).size).toBe(column.length);
        }
      }
    }
  });
});

describe("interpolation", () => {
  it("interpolates linearly between checkpoints", () => {
    const girls = table("weight", "female");
    expect(interpolatePercentile(girls, 7, "p50")).toBe(3400);
  });
});

describe("percentile position", () => {
  const girls = table("weight", "female");

  it("places the median at the 50th percentile", () => {
    expect(percentilePosition(girls, 0, 3230)).toStrictEqual({
      kind: "within",
      percentile: 50,
    });
  });

  it("interpolates between curves", () => {
    const position = percentilePosition(girls, 0, 3005);
    expect(position?.kind).toBe("within");
    expect(position?.percentile).toBeCloseTo(32.5);
  });

  it("reports values outside the 3rd to 97th range as below or above", () => {
    expect(percentilePosition(girls, 0, 2000)?.kind).toBe("below");
    expect(percentilePosition(girls, 0, 5000)?.kind).toBe("above");
    expect(percentilePosition(girls, 0, 2440)?.kind).toBe("within");
  });

  it("has no answer beyond the table instead of reusing its last row", () => {
    expect(percentilePosition(girls, WHO_MAX_AGE_DAYS + 1, 12_000)).toBeNull();
  });
});

describe("ordinals", () => {
  it("adds the right ordinal suffix", () => {
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 47.2, 93].map(formatPercentile)
    ).toStrictEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "47th",
      "93rd",
    ]);
  });
});
