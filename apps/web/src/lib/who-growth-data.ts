/**
 * WHO Child Growth Standards — Weight-for-age (birth to 12 months)
 * Simplified dataset with key percentile curves (3rd, 15th, 50th, 85th, 97th)
 * Values in grams at age in days.
 * Source: WHO Multicentre Growth Reference Study (2006)
 */

interface PercentilePoint {
  days: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

// Boys weight-for-age (grams)
const BOYS: PercentilePoint[] = [
  { days: 0, p3: 2500, p15: 2900, p50: 3300, p85: 3700, p97: 4200 },
  { days: 14, p3: 2900, p15: 3300, p50: 3800, p85: 4300, p97: 4800 },
  { days: 30, p3: 3400, p15: 3900, p50: 4500, p85: 5100, p97: 5700 },
  { days: 61, p3: 4300, p15: 4900, p50: 5600, p85: 6300, p97: 7100 },
  { days: 91, p3: 5000, p15: 5700, p50: 6400, p85: 7200, p97: 8000 },
  { days: 122, p3: 5600, p15: 6200, p50: 7000, p85: 7800, p97: 8700 },
  { days: 152, p3: 6000, p15: 6700, p50: 7500, p85: 8400, p97: 9300 },
  { days: 183, p3: 6400, p15: 7100, p50: 7900, p85: 8800, p97: 9800 },
  { days: 213, p3: 6700, p15: 7400, p50: 8300, p85: 9200, p97: 10_200 },
  { days: 244, p3: 6900, p15: 7700, p50: 8600, p85: 9600, p97: 10_500 },
  { days: 274, p3: 7100, p15: 7900, p50: 8900, p85: 9900, p97: 10_900 },
  { days: 305, p3: 7300, p15: 8100, p50: 9100, p85: 10_100, p97: 11_200 },
  { days: 335, p3: 7500, p15: 8300, p50: 9400, p85: 10_400, p97: 11_500 },
  { days: 365, p3: 7700, p15: 8500, p50: 9600, p85: 10_700, p97: 11_800 },
];

// Girls weight-for-age (grams)
const GIRLS: PercentilePoint[] = [
  { days: 0, p3: 2400, p15: 2800, p50: 3200, p85: 3600, p97: 4000 },
  { days: 14, p3: 2800, p15: 3200, p50: 3600, p85: 4100, p97: 4600 },
  { days: 30, p3: 3200, p15: 3600, p50: 4200, p85: 4800, p97: 5400 },
  { days: 61, p3: 3900, p15: 4500, p50: 5100, p85: 5800, p97: 6600 },
  { days: 91, p3: 4500, p15: 5200, p50: 5800, p85: 6600, p97: 7400 },
  { days: 122, p3: 5000, p15: 5700, p50: 6400, p85: 7300, p97: 8100 },
  { days: 152, p3: 5400, p15: 6100, p50: 6900, p85: 7800, p97: 8700 },
  { days: 183, p3: 5700, p15: 6500, p50: 7300, p85: 8200, p97: 9200 },
  { days: 213, p3: 6000, p15: 6800, p50: 7600, p85: 8600, p97: 9600 },
  { days: 244, p3: 6200, p15: 7000, p50: 7900, p85: 8900, p97: 9900 },
  { days: 274, p3: 6400, p15: 7300, p50: 8200, p85: 9200, p97: 10_200 },
  { days: 305, p3: 6600, p15: 7500, p50: 8400, p85: 9400, p97: 10_500 },
  { days: 335, p3: 6800, p15: 7700, p50: 8600, p85: 9700, p97: 10_800 },
  { days: 365, p3: 7000, p15: 7900, p50: 8900, p85: 9900, p97: 11_000 },
];

export type PercentileKey = "p3" | "p15" | "p50" | "p85" | "p97";

export const PERCENTILE_LABELS: Record<PercentileKey, string> = {
  p3: "3rd",
  p15: "15th",
  p50: "50th",
  p85: "85th",
  p97: "97th",
};

/**
 * Get WHO percentile data for a given gender.
 * Returns null if gender is unknown (we can't show curves without it).
 */
export function getPercentileData(
  gender: string | null
): PercentilePoint[] | null {
  if (gender === "male") return BOYS;
  if (gender === "female") return GIRLS;
  return null;
}

/**
 * Interpolate a percentile value at a given age in days.
 */
export function interpolatePercentile(
  data: PercentilePoint[],
  ageDays: number,
  key: PercentileKey
): number {
  const [first] = data;
  if (ageDays <= first.days) return first[key];
  const lastIdx = data.length - 1;
  if (ageDays >= data[lastIdx].days) return data[lastIdx][key];

  for (let i = 1; i < data.length; i += 1) {
    if (ageDays <= data[i].days) {
      const prev = data[i - 1];
      const curr = data[i];
      const ratio = (ageDays - prev.days) / (curr.days - prev.days);
      return prev[key] + ratio * (curr[key] - prev[key]);
    }
  }
  return data[lastIdx][key];
}
