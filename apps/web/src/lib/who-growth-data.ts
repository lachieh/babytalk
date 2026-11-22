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

const WEIGHT: MetricTable = {
  boys: [
    { days: 0, p3: 2510, p15: 2860, p50: 3350, p85: 3880, p97: 4350 },
    { days: 14, p3: 2850, p15: 3230, p50: 3750, p85: 4330, p97: 4850 },
    { days: 30, p3: 3430, p15: 3870, p50: 4450, p85: 5110, p97: 5690 },
    { days: 61, p3: 4390, p15: 4890, p50: 5570, p85: 6320, p97: 7000 },
    { days: 91, p3: 5090, p15: 5630, p50: 6370, p85: 7180, p97: 7910 },
    { days: 122, p3: 5640, p15: 6220, p50: 7010, p85: 7870, p97: 8640 },
    { days: 152, p3: 6080, p15: 6690, p50: 7510, p85: 8410, p97: 9220 },
    { days: 183, p3: 6440, p15: 7080, p50: 7940, p85: 8890, p97: 9730 },
    { days: 213, p3: 6740, p15: 7400, p50: 8300, p85: 9280, p97: 10_160 },
    { days: 244, p3: 7010, p15: 7700, p50: 8620, p85: 9640, p97: 10_560 },
    { days: 274, p3: 7240, p15: 7950, p50: 8900, p85: 9960, p97: 10_900 },
    { days: 304, p3: 7450, p15: 8180, p50: 9160, p85: 10_250, p97: 11_230 },
    { days: 335, p3: 7660, p15: 8400, p50: 9410, p85: 10_540, p97: 11_540 },
    { days: 365, p3: 7840, p15: 8610, p50: 9650, p85: 10_800, p97: 11_830 },
    { days: 396, p3: 8030, p15: 8810, p50: 9880, p85: 11_060, p97: 12_120 },
    { days: 426, p3: 8200, p15: 9010, p50: 10_090, p85: 11_310, p97: 12_400 },
    { days: 457, p3: 8380, p15: 9200, p50: 10_310, p85: 11_560, p97: 12_680 },
    { days: 487, p3: 8540, p15: 9380, p50: 10_520, p85: 11_800, p97: 12_940 },
    { days: 517, p3: 8710, p15: 9560, p50: 10_730, p85: 12_030, p97: 13_210 },
    { days: 548, p3: 8870, p15: 9750, p50: 10_940, p85: 12_270, p97: 13_480 },
    { days: 578, p3: 9030, p15: 9920, p50: 11_140, p85: 12_510, p97: 13_740 },
    { days: 609, p3: 9190, p15: 10_100, p50: 11_350, p85: 12_750, p97: 14_010 },
    { days: 639, p3: 9340, p15: 10_280, p50: 11_550, p85: 12_980, p97: 14_270 },
    { days: 670, p3: 9500, p15: 10_450, p50: 11_750, p85: 13_220, p97: 14_540 },
    { days: 700, p3: 9650, p15: 10_620, p50: 11_950, p85: 13_450, p97: 14_800 },
    { days: 730, p3: 9800, p15: 10_790, p50: 12_150, p85: 13_680, p97: 15_070 },
  ],
  girls: [
    { days: 0, p3: 2440, p15: 2780, p50: 3230, p85: 3730, p97: 4170 },
    { days: 14, p3: 2700, p15: 3070, p50: 3570, p85: 4130, p97: 4640 },
    { days: 30, p3: 3200, p15: 3610, p50: 4170, p85: 4800, p97: 5370 },
    { days: 61, p3: 4010, p15: 4480, p50: 5130, p85: 5870, p97: 6530 },
    { days: 91, p3: 4600, p15: 5120, p50: 5840, p85: 6650, p97: 7400 },
    { days: 122, p3: 5090, p15: 5650, p50: 6430, p85: 7310, p97: 8120 },
    { days: 152, p3: 5480, p15: 6070, p50: 6900, p85: 7830, p97: 8700 },
    { days: 183, p3: 5820, p15: 6440, p50: 7300, p85: 8290, p97: 9200 },
    { days: 213, p3: 6090, p15: 6740, p50: 7640, p85: 8680, p97: 9640 },
    { days: 244, p3: 6350, p15: 7020, p50: 7950, p85: 9030, p97: 10_040 },
    { days: 274, p3: 6560, p15: 7260, p50: 8230, p85: 9350, p97: 10_390 },
    { days: 304, p3: 6770, p15: 7480, p50: 8480, p85: 9630, p97: 10_720 },
    { days: 335, p3: 6960, p15: 7690, p50: 8720, p85: 9920, p97: 11_040 },
    { days: 365, p3: 7140, p15: 7890, p50: 8950, p85: 10_180, p97: 11_330 },
    { days: 396, p3: 7320, p15: 8090, p50: 9170, p85: 10_440, p97: 11_630 },
    { days: 426, p3: 7490, p15: 8280, p50: 9390, p85: 10_680, p97: 11_900 },
    { days: 457, p3: 7670, p15: 8470, p50: 9600, p85: 10_930, p97: 12_180 },
    { days: 487, p3: 7840, p15: 8650, p50: 9810, p85: 11_170, p97: 12_450 },
    { days: 517, p3: 8000, p15: 8840, p50: 10_020, p85: 11_410, p97: 12_720 },
    { days: 548, p3: 8170, p15: 9030, p50: 10_230, p85: 11_650, p97: 12_990 },
    { days: 578, p3: 8340, p15: 9210, p50: 10_440, p85: 11_880, p97: 13_260 },
    { days: 609, p3: 8510, p15: 9390, p50: 10_650, p85: 12_130, p97: 13_530 },
    { days: 639, p3: 8670, p15: 9570, p50: 10_850, p85: 12_360, p97: 13_790 },
    { days: 670, p3: 8840, p15: 9760, p50: 11_060, p85: 12_600, p97: 14_070 },
    { days: 700, p3: 9000, p15: 9940, p50: 11_270, p85: 12_840, p97: 14_340 },
    { days: 730, p3: 9160, p15: 10_120, p50: 11_470, p85: 13_080, p97: 14_610 },
  ],
};

const LENGTH: MetricTable = {
  boys: [
    { days: 0, p3: 463, p15: 479, p50: 499, p85: 518, p97: 534 },
    { days: 14, p3: 488, p15: 504, p50: 523, p85: 543, p97: 559 },
    { days: 30, p3: 510, p15: 526, p50: 547, p85: 567, p97: 583 },
    { days: 61, p3: 547, p15: 564, p50: 584, p85: 605, p97: 622 },
    { days: 91, p3: 576, p15: 593, p50: 614, p85: 635, p97: 652 },
    { days: 122, p3: 600, p15: 617, p50: 639, p85: 661, p97: 678 },
    { days: 152, p3: 619, p15: 637, p50: 659, p85: 681, p97: 699 },
    { days: 183, p3: 636, p15: 654, p50: 676, p85: 699, p97: 717 },
    { days: 213, p3: 651, p15: 669, p50: 692, p85: 714, p97: 732 },
    { days: 244, p3: 665, p15: 683, p50: 706, p85: 729, p97: 748 },
    { days: 274, p3: 678, p15: 696, p50: 720, p85: 743, p97: 762 },
    { days: 304, p3: 690, p15: 709, p50: 733, p85: 756, p97: 776 },
    { days: 335, p3: 702, p15: 721, p50: 745, p85: 770, p97: 789 },
    { days: 365, p3: 713, p15: 733, p50: 757, p85: 782, p97: 802 },
    { days: 396, p3: 724, p15: 744, p50: 769, p85: 794, p97: 815 },
    { days: 426, p3: 734, p15: 755, p50: 780, p85: 806, p97: 827 },
    { days: 457, p3: 744, p15: 765, p50: 792, p85: 818, p97: 839 },
    { days: 487, p3: 754, p15: 775, p50: 802, p85: 829, p97: 851 },
    { days: 517, p3: 763, p15: 785, p50: 812, p85: 840, p97: 862 },
    { days: 548, p3: 772, p15: 795, p50: 823, p85: 851, p97: 873 },
    { days: 578, p3: 781, p15: 804, p50: 832, p85: 861, p97: 884 },
    { days: 609, p3: 789, p15: 813, p50: 842, p85: 871, p97: 895 },
    { days: 639, p3: 797, p15: 822, p50: 851, p85: 881, p97: 905 },
    { days: 670, p3: 805, p15: 830, p50: 861, p85: 891, p97: 916 },
    { days: 700, p3: 813, p15: 838, p50: 869, p85: 900, p97: 926 },
    { days: 730, p3: 821, p15: 846, p50: 878, p85: 910, p97: 935 },
  ],
  girls: [
    { days: 0, p3: 456, p15: 472, p50: 491, p85: 511, p97: 527 },
    { days: 14, p3: 479, p15: 495, p50: 515, p85: 535, p97: 551 },
    { days: 30, p3: 500, p15: 516, p50: 536, p85: 557, p97: 573 },
    { days: 61, p3: 532, p15: 550, p50: 571, p85: 592, p97: 609 },
    { days: 91, p3: 558, p15: 576, p50: 598, p85: 620, p97: 637 },
    { days: 122, p3: 580, p15: 599, p50: 621, p85: 644, p97: 662 },
    { days: 152, p3: 598, p15: 617, p50: 640, p85: 663, p97: 682 },
    { days: 183, p3: 615, p15: 634, p50: 658, p85: 681, p97: 700 },
    { days: 213, p3: 629, p15: 649, p50: 673, p85: 697, p97: 716 },
    { days: 244, p3: 643, p15: 663, p50: 688, p85: 712, p97: 732 },
    { days: 274, p3: 656, p15: 676, p50: 701, p85: 727, p97: 747 },
    { days: 304, p3: 668, p15: 689, p50: 715, p85: 740, p97: 761 },
    { days: 335, p3: 680, p15: 702, p50: 728, p85: 754, p97: 775 },
    { days: 365, p3: 692, p15: 713, p50: 740, p85: 767, p97: 788 },
    { days: 396, p3: 703, p15: 725, p50: 752, p85: 780, p97: 802 },
    { days: 426, p3: 713, p15: 736, p50: 764, p85: 792, p97: 814 },
    { days: 457, p3: 724, p15: 747, p50: 775, p85: 804, p97: 827 },
    { days: 487, p3: 733, p15: 757, p50: 786, p85: 815, p97: 839 },
    { days: 517, p3: 743, p15: 767, p50: 797, p85: 826, p97: 850 },
    { days: 548, p3: 753, p15: 777, p50: 807, p85: 837, p97: 862 },
    { days: 578, p3: 761, p15: 786, p50: 817, p85: 848, p97: 873 },
    { days: 609, p3: 770, p15: 796, p50: 827, p85: 858, p97: 884 },
    { days: 639, p3: 779, p15: 805, p50: 837, p85: 868, p97: 894 },
    { days: 670, p3: 787, p15: 814, p50: 846, p85: 879, p97: 905 },
    { days: 700, p3: 795, p15: 822, p50: 855, p85: 888, p97: 915 },
    { days: 730, p3: 803, p15: 831, p50: 864, p85: 897, p97: 925 },
  ],
};

const HEAD: MetricTable = {
  boys: [
    { days: 0, p3: 321, p15: 331, p50: 345, p85: 358, p97: 369 },
    { days: 14, p3: 337, p15: 347, p50: 359, p85: 371, p97: 381 },
    { days: 30, p3: 350, p15: 360, p50: 372, p85: 385, p97: 394 },
    { days: 61, p3: 369, p15: 379, p50: 391, p85: 404, p97: 413 },
    { days: 91, p3: 383, p15: 393, p50: 405, p85: 417, p97: 427 },
    { days: 122, p3: 394, p15: 404, p50: 416, p85: 429, p97: 439 },
    { days: 152, p3: 403, p15: 413, p50: 426, p85: 438, p97: 448 },
    { days: 183, p3: 410, p15: 421, p50: 433, p85: 446, p97: 456 },
    { days: 213, p3: 417, p15: 427, p50: 440, p85: 453, p97: 463 },
    { days: 244, p3: 422, p15: 432, p50: 445, p85: 458, p97: 469 },
    { days: 274, p3: 426, p15: 437, p50: 450, p85: 463, p97: 474 },
    { days: 304, p3: 430, p15: 441, p50: 454, p85: 467, p97: 478 },
    { days: 335, p3: 434, p15: 444, p50: 458, p85: 471, p97: 482 },
    { days: 365, p3: 436, p15: 447, p50: 461, p85: 474, p97: 485 },
    { days: 396, p3: 439, p15: 450, p50: 463, p85: 477, p97: 488 },
    { days: 426, p3: 441, p15: 452, p50: 466, p85: 479, p97: 490 },
    { days: 457, p3: 444, p15: 455, p50: 468, p85: 482, p97: 493 },
    { days: 487, p3: 445, p15: 456, p50: 470, p85: 484, p97: 495 },
    { days: 517, p3: 447, p15: 458, p50: 472, p85: 486, p97: 497 },
    { days: 548, p3: 449, p15: 460, p50: 474, p85: 487, p97: 499 },
    { days: 578, p3: 450, p15: 462, p50: 475, p85: 489, p97: 500 },
    { days: 609, p3: 452, p15: 463, p50: 477, p85: 491, p97: 502 },
    { days: 639, p3: 453, p15: 464, p50: 478, p85: 492, p97: 504 },
    { days: 670, p3: 454, p15: 466, p50: 480, p85: 494, p97: 505 },
    { days: 700, p3: 456, p15: 467, p50: 481, p85: 495, p97: 507 },
    { days: 730, p3: 457, p15: 468, p50: 482, p85: 497, p97: 508 },
  ],
  girls: [
    { days: 0, p3: 317, p15: 327, p50: 339, p85: 351, p97: 361 },
    { days: 14, p3: 331, p15: 340, p50: 352, p85: 364, p97: 374 },
    { days: 30, p3: 343, p15: 353, p50: 365, p85: 377, p97: 387 },
    { days: 61, p3: 360, p15: 370, p50: 383, p85: 395, p97: 405 },
    { days: 91, p3: 372, p15: 382, p50: 395, p85: 408, p97: 419 },
    { days: 122, p3: 382, p15: 393, p50: 406, p85: 419, p97: 430 },
    { days: 152, p3: 390, p15: 401, p50: 415, p85: 428, p97: 439 },
    { days: 183, p3: 398, p15: 409, p50: 422, p85: 436, p97: 447 },
    { days: 213, p3: 404, p15: 415, p50: 428, p85: 442, p97: 453 },
    { days: 244, p3: 409, p15: 420, p50: 434, p85: 448, p97: 459 },
    { days: 274, p3: 413, p15: 424, p50: 438, p85: 452, p97: 463 },
    { days: 304, p3: 417, p15: 428, p50: 442, p85: 456, p97: 468 },
    { days: 335, p3: 420, p15: 432, p50: 446, p85: 460, p97: 471 },
    { days: 365, p3: 423, p15: 435, p50: 449, p85: 463, p97: 474 },
    { days: 396, p3: 426, p15: 438, p50: 452, p85: 466, p97: 477 },
    { days: 426, p3: 429, p15: 440, p50: 454, p85: 468, p97: 480 },
    { days: 457, p3: 431, p15: 442, p50: 457, p85: 471, p97: 482 },
    { days: 487, p3: 433, p15: 444, p50: 459, p85: 473, p97: 485 },
    { days: 517, p3: 435, p15: 446, p50: 461, p85: 475, p97: 486 },
    { days: 548, p3: 436, p15: 448, p50: 462, p85: 477, p97: 488 },
    { days: 578, p3: 438, p15: 450, p50: 464, p85: 478, p97: 490 },
    { days: 609, p3: 440, p15: 451, p50: 466, p85: 480, p97: 492 },
    { days: 639, p3: 441, p15: 453, p50: 467, p85: 482, p97: 493 },
    { days: 670, p3: 443, p15: 455, p50: 469, p85: 483, p97: 495 },
    { days: 700, p3: 444, p15: 456, p50: 470, p85: 485, p97: 497 },
    { days: 730, p3: 446, p15: 457, p50: 472, p85: 486, p97: 498 },
  ],
};
/* ── Public API ──────────────────────────────────────────────── */

export type GrowthMetric = "weight" | "length" | "head";
export type PercentileKey = "p3" | "p15" | "p50" | "p85" | "p97";
export type ReferenceSex = "boys" | "girls";
export type { PercentilePoint };

export const WHO_MAX_AGE_DAYS = 730;

const TABLES: Record<GrowthMetric, MetricTable> = {
  head: HEAD,
  length: LENGTH,
  weight: WEIGHT,
};

export function referenceSexFor(gender: string | null): ReferenceSex | null {
  if (gender === "male") return "boys";
  if (gender === "female") return "girls";
  return null;
}

export function getPercentileData(
  metric: GrowthMetric,
  gender: string | null
): PercentilePoint[] | null {
  const sex = referenceSexFor(gender);
  return sex ? TABLES[metric][sex] : null;
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

export interface PercentilePosition {
  kind: "below" | "within" | "above";
  percentile: number;
}

export function percentilePosition(
  data: PercentilePoint[],
  ageDays: number,
  value: number
): PercentilePosition | null {
  if (ageDays < 0 || ageDays > WHO_MAX_AGE_DAYS) return null;

  const p3 = interpolatePercentile(data, ageDays, "p3");
  const p15 = interpolatePercentile(data, ageDays, "p15");
  const p50 = interpolatePercentile(data, ageDays, "p50");
  const p85 = interpolatePercentile(data, ageDays, "p85");
  const p97 = interpolatePercentile(data, ageDays, "p97");

  if (value < p3) return { kind: "below", percentile: 3 };
  if (value > p97) return { kind: "above", percentile: 97 };

  let percentile = 97;
  if (value <= p15) percentile = 3 + ((value - p3) / (p15 - p3)) * 12;
  else if (value <= p50) percentile = 15 + ((value - p15) / (p50 - p15)) * 35;
  else if (value <= p85) percentile = 50 + ((value - p50) / (p85 - p50)) * 35;
  else percentile = 85 + ((value - p85) / (p97 - p85)) * 12;
  return { kind: "within", percentile };
}

export function formatPercentile(percentile: number): string {
  const v = Math.round(percentile);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const mod10 = v % 10;
  if (mod10 === 1) return `${v}st`;
  if (mod10 === 2) return `${v}nd`;
  if (mod10 === 3) return `${v}rd`;
  return `${v}th`;
}
