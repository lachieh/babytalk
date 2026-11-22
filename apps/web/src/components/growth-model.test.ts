import { ymd } from "../lib/history-days";
import { getPercentileData, percentilePosition } from "../lib/who-growth-data";
import {
  BIRTH_POINT_ID,
  METRICS,
  ageAxis,
  ageInDays,
  bandSamples,
  buildMeasurementPayload,
  buildPoints,
  dateInputToIso,
  describePosition,
  formatAge,
  formatDay,
  formatWeight,
  gramsToLbOz,
  initialFormValues,
  lbOzToGrams,
  parseCalendarDay,
  smoothSegments,
  valueAxis,
} from "./growth-model";
import type { Measurement } from "./growth-model";

const [WEIGHT, LENGTH] = METRICS;

const dayParts = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

const ZONES = [
  "Etc/GMT+12",
  "Pacific/Pago_Pago",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Chatham",
  "Pacific/Tongatapu",
  "Pacific/Kiritimati",
];

// Ordinary days plus the US, EU and NZ daylight-saving change days of 2026.
const DAYS = [
  "2026-06-05",
  "2026-01-01",
  "2026-12-31",
  "2026-03-08",
  "2026-11-01",
  "2026-03-29",
  "2026-10-25",
  "2026-04-05",
  "2026-09-27",
];

function inZone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    process.env.TZ = previous;
  }
}

const measurement = (over: Partial<Measurement>): Measurement => ({
  babyId: "b1",
  headMm: null,
  id: "m1",
  lengthMm: null,
  measuredAt: dateInputToIso("2026-11-12"),
  notes: null,
  weightG: null,
  ...over,
});

describe("calendar days", () => {
  it("reads a date-only string as that local day, not the evening before", () => {
    expect(dayParts(parseCalendarDay("2026-11-12"))).toStrictEqual([
      2026, 11, 12,
    ]);
    expect(parseCalendarDay("2026-11-12").getHours()).toBe(0);
  });

  it("stores a chosen day as noon UTC of that day, whatever the zone", () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        expect(dateInputToIso("2026-11-12")).toBe("2026-11-12T12:00:00.000Z");
        expect(dateInputToIso("2026-07-04")).toBe("2026-07-04T12:00:00.000Z");
      });
    }
  });

  it("reads an entered day back as the same day in every zone, after travel too", () => {
    const misread: string[] = [];
    for (const day of DAYS) {
      for (const savedIn of ZONES) {
        const stored = inZone(savedIn, () => dateInputToIso(day));
        for (const readIn of ZONES) {
          const read = inZone(readIn, () => ymd(parseCalendarDay(stored)));
          if (read !== day)
            misread.push(`${day} ${savedIn}→${readIn}: ${read}`);
        }
      }
    }
    expect(misread).toStrictEqual([]);
  });

  it("reads legacy UTC-midnight rows as the day they name in every zone", () => {
    const misread: string[] = [];
    for (const day of DAYS) {
      for (const zone of ZONES) {
        const read = inZone(zone, () =>
          ymd(parseCalendarDay(`${day}T00:00:00.000Z`))
        );
        if (read !== day) misread.push(`${day} in ${zone}: ${read}`);
      }
    }
    expect(misread).toStrictEqual([]);
  });

  it("shows the day that was entered", () => {
    const stored = dateInputToIso("2026-11-12");
    expect(formatDay(parseCalendarDay(stored), "en-US")).toBe("Nov 12, 2026");
    expect(ymd(parseCalendarDay(stored))).toBe("2026-11-12");
  });

  it("reads measurements saved as UTC midnight as the day they name", () => {
    const legacy = "2026-11-12T00:00:00.000Z";
    expect(formatDay(parseCalendarDay(legacy), "en-US")).toBe("Nov 12, 2026");
    expect(ymd(parseCalendarDay(legacy))).toBe("2026-11-12");
  });

  it("reads any other timestamp as the local day it happened on", () => {
    inZone("America/New_York", () => {
      expect(
        dayParts(parseCalendarDay("2026-11-13T02:30:00.000Z"))
      ).toStrictEqual([2026, 11, 12]);
    });
  });

  it("dates, ages and orders measurements by their day in every zone", () => {
    const rows = [
      measurement({
        id: "new",
        measuredAt: dateInputToIso("2026-06-05"),
        weightG: 3600,
      }),
      measurement({
        id: "legacy",
        measuredAt: "2026-06-04T00:00:00.000Z",
        weightG: 3500,
      }),
      measurement({
        id: "birthday",
        measuredAt: dateInputToIso("2026-06-01"),
        weightG: 3300,
      }),
    ];
    for (const zone of ZONES) {
      inZone(zone, () => {
        const points = buildPoints(rows, "2026-06-01", WEIGHT, 3400);
        expect({
          points: points.map((p) => [p.id, p.ageDays, ymd(p.day)]),
          zone,
        }).toStrictEqual({
          points: [
            ["birthday", 0, "2026-06-01"],
            ["legacy", 3, "2026-06-04"],
            ["new", 4, "2026-06-05"],
          ],
          zone,
        });
        const [first] = buildPoints(
          rows.slice(0, 2),
          "2026-06-01",
          WEIGHT,
          3400
        );
        expect({ first: [first.id, first.ageDays], zone }).toStrictEqual({
          first: [BIRTH_POINT_ID, 0],
          zone,
        });
      });
    }
  });

  it("counts age in whole days across a daylight-saving change", () => {
    const birth = parseCalendarDay("2026-10-25");
    expect(ageInDays(parseCalendarDay("2026-11-08"), birth)).toBe(14);
    expect(ageInDays(parseCalendarDay("2026-10-20"), birth)).toBe(0);
  });
});

describe("age in words", () => {
  it("uses days, then weeks, then months", () => {
    expect(formatAge(0)).toBe("at birth");
    expect(formatAge(1)).toBe("1 day old");
    expect(formatAge(9)).toBe("9 days old");
    expect(formatAge(45)).toBe("6 weeks old");
    expect(formatAge(153)).toBe("5 months old");
  });
});

describe("weight units", () => {
  it("never shows 16 oz", () => {
    expect(gramsToLbOz(3620)).toStrictEqual({ lb: 8, oz: 0 });
    expect(formatWeight(3620, true)).toBe("8 lb 0 oz");
  });

  it("round-trips pounds and ounces", () => {
    expect(lbOzToGrams(7, 8)).toBe(3402);
    expect(gramsToLbOz(3402, 1)).toStrictEqual({ lb: 7, oz: 8 });
  });

  it("formats kilograms to two places", () => {
    expect(formatWeight(6420, false)).toBe("6.42 kg");
  });
});

describe("points for a metric", () => {
  const birthDate = "2026-06-10";

  it("orders points oldest first and skips measurements without the metric", () => {
    const points = buildPoints(
      [
        measurement({
          id: "c",
          measuredAt: dateInputToIso("2026-08-10"),
          weightG: 5600,
        }),
        measurement({
          id: "b",
          lengthMm: 540,
          measuredAt: dateInputToIso("2026-07-10"),
        }),
        measurement({
          id: "a",
          measuredAt: dateInputToIso("2026-06-24"),
          weightG: 3700,
        }),
      ],
      birthDate,
      WEIGHT,
      null
    );
    expect(points.map((p) => [p.id, p.ageDays])).toStrictEqual([
      ["a", 14],
      ["c", 61],
    ]);
  });

  it("starts the weight series with the birth weight from the profile", () => {
    const points = buildPoints(
      [
        measurement({
          id: "a",
          measuredAt: dateInputToIso("2026-06-24"),
          weightG: 3700,
        }),
      ],
      birthDate,
      WEIGHT,
      3400
    );
    expect(
      points.map((p) => [p.id, p.ageDays, p.value, p.fromProfile])
    ).toStrictEqual([
      [BIRTH_POINT_ID, 0, 3400, true],
      ["a", 14, 3700, false],
    ]);
    expect(dayParts(points[0].day)).toStrictEqual([2026, 6, 10]);
  });

  it("shows growth from birth weight alone", () => {
    expect(buildPoints([], birthDate, WEIGHT, 3400)).toHaveLength(1);
  });

  it("does not add birth weight to other metrics, or twice", () => {
    expect(buildPoints([], birthDate, LENGTH, 3400)).toStrictEqual([]);
    const logged = buildPoints(
      [
        measurement({
          id: "a",
          measuredAt: dateInputToIso("2026-06-10"),
          weightG: 3380,
        }),
      ],
      birthDate,
      WEIGHT,
      3400
    );
    expect(logged.map((p) => p.id)).toStrictEqual(["a"]);
  });
});

describe("age axis", () => {
  it("counts weeks for a young baby", () => {
    const axis = ageAxis(40, 5);
    expect(axis.ticks.map((t) => t.label)).toStrictEqual([
      "Birth",
      "2 wk",
      "4 wk",
      "6 wk",
    ]);
    expect(axis.max).toBe(42);
  });

  it("switches to months after twelve weeks", () => {
    const axis = ageAxis(155, 7);
    expect(axis.ticks.map((t) => t.label)).toStrictEqual([
      "Birth",
      "1 mo",
      "2 mo",
      "3 mo",
      "4 mo",
      "5 mo",
      "6 mo",
    ]);
    expect(axis.max).toBeGreaterThanOrEqual(155);
  });

  it("thins labels on a narrow chart", () => {
    const axis = ageAxis(155, 4);
    expect(axis.ticks.map((t) => t.label)).toStrictEqual([
      "Birth",
      "2 mo",
      "4 mo",
      "6 mo",
    ]);
  });

  it("gives a newborn a four-week span", () => {
    expect(ageAxis(0, 5).max).toBe(28);
  });
});

describe("value axis", () => {
  it("labels kilograms on round numbers that enclose the data", () => {
    const axis = valueAxis(2440, 9200, { label: "kg", size: 1000 }, 5);
    expect(axis.ticks.map((t) => t.label)).toStrictEqual([
      "2",
      "4",
      "6",
      "8",
      "10",
    ]);
    expect(axis.unit).toBe("kg");
    expect(axis.min).toBe(2000);
    expect(axis.max).toBe(10_000);
  });

  it("labels inches while keeping tick positions in millimeters", () => {
    const axis = valueAxis(456, 700, { label: "in", size: 25.4 }, 5);
    expect(axis.ticks.map((t) => t.label)).toStrictEqual([
      "15",
      "20",
      "25",
      "30",
    ]);
    expect(axis.ticks[1].value).toBeCloseTo(508);
    expect(axis.min).toBeLessThanOrEqual(456);
    expect(axis.max).toBeGreaterThanOrEqual(700);
  });

  it("never exceeds the tick budget", () => {
    for (const [lo, hi] of [
      [2440, 4170],
      [3100, 3101],
      [317, 474],
      [5000, 11_830],
    ]) {
      const axis = valueAxis(lo, hi, { label: "kg", size: 1000 }, 4);
      expect(axis.ticks.length).toBeLessThanOrEqual(4);
      expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("reference band", () => {
  const girls = getPercentileData("weight", "female");

  it("covers birth to the requested age with low < median < high", () => {
    const samples = bandSamples(girls ?? [], 100);
    expect(samples[0].ageDays).toBe(0);
    expect(samples.at(-1)?.ageDays).toBe(100);
    for (const s of samples) {
      expect(s.low).toBeLessThan(s.median);
      expect(s.median).toBeLessThan(s.high);
    }
  });

  it("stops where the WHO table ends", () => {
    expect(bandSamples(girls ?? [], 1000).at(-1)?.ageDays).toBe(730);
  });
});

describe("position in plain words", () => {
  it("says the percentile in plain words", () => {
    expect(
      describePosition({ kind: "within", percentile: 47.2 }, "girls")
    ).toBe(
      "Around the 47th percentile, near the middle of the typical range for girls this age."
    );
    expect(describePosition({ kind: "within", percentile: 8 }, "boys")).toBe(
      "Around the 8th percentile, toward the lower end of the typical range for boys this age."
    );
  });

  it("stays calm outside the range and never quotes a number", () => {
    const text = describePosition({ kind: "below", percentile: 3 }, "girls");
    expect(text).toMatch(/^Below the typical range for girls this age\./);
    expect(text).toMatch(/nurse or doctor/);
    expect(text).not.toMatch(/\d/);
  });

  it("describes a girl's weight at five months against the girls' table", () => {
    const girls = getPercentileData("weight", "female") ?? [];
    const position = percentilePosition(girls, 152, 6900);
    expect(position).toStrictEqual({ kind: "within", percentile: 50 });
  });
});

describe("smooth curve", () => {
  it("passes through every point without overshooting", () => {
    const d = smoothSegments([
      [0, 100],
      [50, 60],
      [100, 55],
      [150, 20],
    ]);
    const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(d).toMatch(/150,20$/);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });

  it("draws a straight line between two points", () => {
    expect(
      smoothSegments([
        [0, 0],
        [10, 5],
      ])
    ).toBe("L10,5");
  });
});

describe("measurement form", () => {
  const today = new Date(2026, 10, 21, 3, 15);

  it("starts a new measurement on today's local date", () => {
    expect(initialFormValues(null, false, today).date).toBe("2026-11-21");
  });

  it("starts today's date correctly late in the evening", () => {
    const late = new Date(2026, 10, 21, 23, 30);
    expect(initialFormValues(null, false, late).date).toBe("2026-11-21");
  });

  it("keeps the entered day through save and edit", () => {
    const values = {
      ...initialFormValues(null, false, today),
      date: "2026-11-12",
      weightKg: "6.42",
    };
    const payload = buildMeasurementPayload(values, false);
    expect(payload.weightG).toBe(6420);
    const reopened = initialFormValues(
      measurement({ measuredAt: payload.measuredAt, weightG: payload.weightG }),
      false,
      today
    );
    expect(reopened.date).toBe("2026-11-12");
    expect(reopened.weightKg).toBe("6.42");
  });

  it("converts imperial entries and leaves blanks empty", () => {
    const values = {
      ...initialFormValues(null, true, today),
      length: "24.5",
      weightLb: "14",
      weightOz: "2.5",
    };
    expect(buildMeasurementPayload(values, true)).toMatchObject({
      headMm: null,
      lengthMm: 622,
      notes: null,
      weightG: 6421,
    });
  });

  it("treats zero and negative entries as blank", () => {
    const values = {
      ...initialFormValues(null, false, today),
      head: "-4",
      weightKg: "0",
    };
    const payload = buildMeasurementPayload(values, false);
    expect(payload.weightG).toBeNull();
    expect(payload.headMm).toBeNull();
  });
});
