/**
 * WHO Child Growth Standards — birth to 12 months
 * Simplified percentile tables (3rd, 15th, 50th, 85th, 97th) at coarse age
 * checkpoints. Weights in grams, lengths and head circumferences in
 * millimeters so the consumer can use the values directly without unit
 * conversion.
 * Source: WHO Multicentre Growth Reference Study (2006), simplified.
 */

interface PercentilePoint {
  days: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

interface MetricTable {
  boys: PercentilePoint[];
  girls: PercentilePoint[];
}

/* ── Weight-for-age (grams) ──────────────────────────────────── */

const WEIGHT: MetricTable = {
  boys: [
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
  ],
  girls: [
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
  ],
};

/* ── Length-for-age (millimeters) ────────────────────────────── */

const LENGTH: MetricTable = {
  boys: [
    { days: 0, p3: 461, p15: 480, p50: 499, p85: 518, p97: 537 },
    { days: 14, p3: 490, p15: 508, p50: 525, p85: 544, p97: 562 },
    { days: 30, p3: 515, p15: 532, p50: 550, p85: 569, p97: 587 },
    { days: 61, p3: 550, p15: 567, p50: 584, p85: 602, p97: 620 },
    { days: 91, p3: 579, p15: 596, p50: 614, p85: 632, p97: 650 },
    { days: 122, p3: 602, p15: 619, p50: 637, p85: 655, p97: 674 },
    { days: 152, p3: 620, p15: 638, p50: 656, p85: 674, p97: 693 },
    { days: 183, p3: 636, p15: 654, p50: 673, p85: 692, p97: 710 },
    { days: 213, p3: 650, p15: 668, p50: 689, p85: 708, p97: 726 },
    { days: 244, p3: 664, p15: 683, p50: 704, p85: 723, p97: 741 },
    { days: 274, p3: 677, p15: 697, p50: 718, p85: 738, p97: 756 },
    { days: 305, p3: 689, p15: 710, p50: 731, p85: 751, p97: 770 },
    { days: 335, p3: 700, p15: 721, p50: 743, p85: 764, p97: 782 },
    { days: 365, p3: 710, p15: 732, p50: 755, p85: 776, p97: 794 },
  ],
  girls: [
    { days: 0, p3: 454, p15: 472, p50: 491, p85: 510, p97: 529 },
    { days: 14, p3: 480, p15: 497, p50: 514, p85: 532, p97: 549 },
    { days: 30, p3: 500, p15: 517, p50: 537, p85: 556, p97: 574 },
    { days: 61, p3: 532, p15: 549, p50: 568, p85: 586, p97: 604 },
    { days: 91, p3: 558, p15: 575, p50: 595, p85: 614, p97: 633 },
    { days: 122, p3: 580, p15: 598, p50: 617, p85: 637, p97: 655 },
    { days: 152, p3: 598, p15: 616, p50: 635, p85: 655, p97: 674 },
    { days: 183, p3: 612, p15: 630, p50: 651, p85: 671, p97: 690 },
    { days: 213, p3: 627, p15: 645, p50: 665, p85: 686, p97: 705 },
    { days: 244, p3: 641, p15: 659, p50: 679, p85: 700, p97: 720 },
    { days: 274, p3: 653, p15: 672, p50: 693, p85: 714, p97: 735 },
    { days: 305, p3: 665, p15: 685, p50: 706, p85: 727, p97: 748 },
    { days: 335, p3: 677, p15: 697, p50: 718, p85: 740, p97: 761 },
    { days: 365, p3: 689, p15: 709, p50: 730, p85: 752, p97: 773 },
  ],
};

/* ── Head circumference-for-age (millimeters) ────────────────── */

const HEAD: MetricTable = {
  boys: [
    { days: 0, p3: 320, p15: 333, p50: 345, p85: 357, p97: 369 },
    { days: 14, p3: 344, p15: 356, p50: 367, p85: 379, p97: 390 },
    { days: 30, p3: 359, p15: 370, p50: 381, p85: 392, p97: 403 },
    { days: 61, p3: 378, p15: 390, p50: 401, p85: 412, p97: 423 },
    { days: 91, p3: 393, p15: 404, p50: 415, p85: 427, p97: 438 },
    { days: 122, p3: 404, p15: 416, p50: 427, p85: 439, p97: 450 },
    { days: 152, p3: 413, p15: 425, p50: 437, p85: 449, p97: 460 },
    { days: 183, p3: 421, p15: 433, p50: 445, p85: 457, p97: 469 },
    { days: 213, p3: 428, p15: 440, p50: 452, p85: 465, p97: 477 },
    { days: 244, p3: 434, p15: 446, p50: 458, p85: 471, p97: 483 },
    { days: 274, p3: 439, p15: 451, p50: 464, p85: 476, p97: 488 },
    { days: 305, p3: 443, p15: 456, p50: 468, p85: 481, p97: 493 },
    { days: 335, p3: 447, p15: 460, p50: 472, p85: 485, p97: 497 },
    { days: 365, p3: 450, p15: 463, p50: 476, p85: 488, p97: 500 },
  ],
  girls: [
    { days: 0, p3: 315, p15: 327, p50: 339, p85: 351, p97: 362 },
    { days: 14, p3: 336, p15: 348, p50: 358, p85: 370, p97: 380 },
    { days: 30, p3: 350, p15: 361, p50: 372, p85: 383, p97: 393 },
    { days: 61, p3: 367, p15: 378, p50: 389, p85: 400, p97: 410 },
    { days: 91, p3: 380, p15: 392, p50: 402, p85: 414, p97: 424 },
    { days: 122, p3: 391, p15: 403, p50: 414, p85: 425, p97: 435 },
    { days: 152, p3: 400, p15: 412, p50: 423, p85: 435, p97: 445 },
    { days: 183, p3: 407, p15: 419, p50: 431, p85: 442, p97: 453 },
    { days: 213, p3: 413, p15: 425, p50: 437, p85: 449, p97: 459 },
    { days: 244, p3: 418, p15: 430, p50: 442, p85: 454, p97: 465 },
    { days: 274, p3: 423, p15: 435, p50: 447, p85: 459, p97: 470 },
    { days: 305, p3: 427, p15: 439, p50: 451, p85: 463, p97: 474 },
    { days: 335, p3: 430, p15: 443, p50: 455, p85: 467, p97: 478 },
    { days: 365, p3: 434, p15: 446, p50: 458, p85: 470, p97: 482 },
  ],
};

/* ── Public API ──────────────────────────────────────────────── */

export type GrowthMetric = "weight" | "length" | "head";
export type PercentileKey = "p3" | "p15" | "p50" | "p85" | "p97";

export const PERCENTILE_LABELS: Record<PercentileKey, string> = {
  p3: "3rd",
  p15: "15th",
  p50: "50th",
  p85: "85th",
  p97: "97th",
};

const TABLES: Record<GrowthMetric, MetricTable> = {
  head: HEAD,
  length: LENGTH,
  weight: WEIGHT,
};

export function getPercentileData(
  metric: GrowthMetric,
  gender: string | null
): PercentilePoint[] | null {
  const table = TABLES[metric];
  if (gender === "male") return table.boys;
  if (gender === "female") return table.girls;
  return null;
}

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

/**
 * Estimate the percentile rank (0-100) of a value at a given age by
 * linearly interpolating between the known percentile points.
 * Returns null if below the 3rd or above the 97th — caller can decide
 * how to display extremes.
 */
export function estimatePercentile(
  data: PercentilePoint[],
  ageDays: number,
  value: number
): number {
  const p3 = interpolatePercentile(data, ageDays, "p3");
  const p15 = interpolatePercentile(data, ageDays, "p15");
  const p50 = interpolatePercentile(data, ageDays, "p50");
  const p85 = interpolatePercentile(data, ageDays, "p85");
  const p97 = interpolatePercentile(data, ageDays, "p97");

  if (value <= p3) return 3;
  if (value <= p15) return 3 + ((value - p3) / (p15 - p3)) * (15 - 3);
  if (value <= p50) return 15 + ((value - p15) / (p50 - p15)) * (50 - 15);
  if (value <= p85) return 50 + ((value - p50) / (p85 - p50)) * (85 - 50);
  if (value <= p97) return 85 + ((value - p85) / (p97 - p85)) * (97 - 85);
  return 97;
}

function ordinalSuffix(n: number): string {
  const v = Math.round(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const mod10 = v % 10;
  if (mod10 === 1) return `${v}st`;
  if (mod10 === 2) return `${v}nd`;
  if (mod10 === 3) return `${v}rd`;
  return `${v}th`;
}

export function formatPercentile(percentile: number): string {
  return ordinalSuffix(percentile);
}
