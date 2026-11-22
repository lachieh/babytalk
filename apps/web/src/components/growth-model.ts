import { ymd } from "../lib/history-days";
import {
  WHO_MAX_AGE_DAYS,
  formatPercentile,
  interpolatePercentile,
} from "../lib/who-growth-data";
import type {
  GrowthMetric,
  PercentilePoint,
  PercentilePosition,
  ReferenceSex,
} from "../lib/who-growth-data";

export interface Measurement {
  id: string;
  babyId: string;
  measuredAt: string;
  weightG: number | null;
  lengthMm: number | null;
  headMm: number | null;
  notes: string | null;
}

export interface GrowthPoint {
  id: string;
  day: Date;
  ageDays: number;
  value: number;
  fromProfile: boolean;
}

const DAY_MS = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CALENDAR_DAY_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(?:00|12):00:00(?:\.0+)?Z$/;

export function parseCalendarDay(value: string): Date {
  const named = DATE_ONLY.exec(value) ?? CALENDAR_DAY_TIMESTAMP.exec(value);
  if (named) {
    return new Date(Number(named[1]), Number(named[2]) - 1, Number(named[3]));
  }
  const instant = new Date(value);
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
}

export function dateInputToIso(value: string): string {
  const day = parseCalendarDay(value);
  return new Date(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12)
  ).toISOString();
}

export function ageInDays(day: Date, birth: Date): number {
  return Math.max(0, Math.round((day.getTime() - birth.getTime()) / DAY_MS));
}

export function formatDay(day: Date, locale?: string): string {
  return day.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAYS_PER_MONTH = 30.4375;

export function formatAge(ageDays: number): string {
  if (ageDays <= 0) return "at birth";
  if (ageDays < 14) return ageDays === 1 ? "1 day old" : `${ageDays} days old`;
  if (ageDays < 84) return `${Math.floor(ageDays / 7)} weeks old`;
  const months = Math.floor(ageDays / DAYS_PER_MONTH);
  return `${months} months old`;
}

const GRAMS_PER_OZ = 28.349_523_125;
const GRAMS_PER_LB = GRAMS_PER_OZ * 16;
const MM_PER_INCH = 25.4;

export function gramsToLbOz(
  grams: number,
  ozDecimals = 0
): { lb: number; oz: number } {
  const scale = 10 ** ozDecimals;
  const totalOz = Math.round((grams / GRAMS_PER_OZ) * scale) / scale;
  const lb = Math.floor(totalOz / 16);
  const oz = Math.round((totalOz - lb * 16) * scale) / scale;
  return { lb, oz };
}

export function lbOzToGrams(lb: number, oz: number): number {
  return Math.round(lb * GRAMS_PER_LB + oz * GRAMS_PER_OZ);
}

export function formatWeight(grams: number, imperial: boolean): string {
  if (imperial) {
    const { lb, oz } = gramsToLbOz(grams);
    return `${lb} lb ${oz} oz`;
  }
  return `${(grams / 1000).toFixed(2)} kg`;
}

export function formatLength(mm: number, imperial: boolean): string {
  if (imperial) return `${(mm / MM_PER_INCH).toFixed(1)} in`;
  return `${(mm / 10).toFixed(1)} cm`;
}

function lengthToInputValue(mm: number, imperial: boolean): string {
  return imperial ? (mm / MM_PER_INCH).toFixed(1) : (mm / 10).toFixed(1);
}

function inputValueToMm(value: number, imperial: boolean): number {
  return Math.round(imperial ? value * MM_PER_INCH : value * 10);
}

export interface FormValues {
  date: string;
  weightKg: string;
  weightLb: string;
  weightOz: string;
  length: string;
  head: string;
  notes: string;
}

export function initialFormValues(
  measurement: Measurement | null,
  imperial: boolean,
  today: Date
): FormValues {
  const values: FormValues = {
    date: ymd(today),
    head: "",
    length: "",
    notes: "",
    weightKg: "",
    weightLb: "",
    weightOz: "",
  };
  if (!measurement) return values;

  values.date = ymd(parseCalendarDay(measurement.measuredAt));
  values.notes = measurement.notes ?? "";
  if (measurement.weightG !== null) {
    if (imperial) {
      const { lb, oz } = gramsToLbOz(measurement.weightG, 1);
      values.weightLb = String(lb);
      values.weightOz = String(oz);
    } else {
      values.weightKg = (measurement.weightG / 1000).toFixed(2);
    }
  }
  if (measurement.lengthMm !== null) {
    values.length = lengthToInputValue(measurement.lengthMm, imperial);
  }
  if (measurement.headMm !== null) {
    values.head = lengthToInputValue(measurement.headMm, imperial);
  }
  return values;
}

const positive = (text: string): number | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

export function buildMeasurementPayload(values: FormValues, imperial: boolean) {
  let weightG: number | null = null;
  if (imperial) {
    const lb = positive(values.weightLb) ?? 0;
    const oz = positive(values.weightOz) ?? 0;
    if (lb > 0 || oz > 0) weightG = lbOzToGrams(lb, oz);
  } else {
    const kg = positive(values.weightKg);
    if (kg !== null) weightG = Math.round(kg * 1000);
  }

  const length = positive(values.length);
  const head = positive(values.head);

  return {
    headMm: head === null ? null : inputValueToMm(head, imperial),
    lengthMm: length === null ? null : inputValueToMm(length, imperial),
    measuredAt: dateInputToIso(values.date),
    notes: values.notes.trim() || null,
    weightG,
  };
}

export interface MetricConfig {
  key: GrowthMetric;
  label: string;
  noun: string;
  accessor: (m: Measurement) => number | null;
  format: (value: number, imperial: boolean) => string;
  axisUnit: (imperial: boolean) => { label: string; size: number };
}

const lengthAxis = (imperial: boolean) =>
  imperial ? { label: "in", size: MM_PER_INCH } : { label: "cm", size: 10 };

export const METRICS: MetricConfig[] = [
  {
    accessor: (m) => m.weightG,
    axisUnit: (imperial) =>
      imperial
        ? { label: "lb", size: GRAMS_PER_LB }
        : { label: "kg", size: 1000 },
    format: formatWeight,
    key: "weight",
    label: "Weight",
    noun: "weight",
  },
  {
    accessor: (m) => m.lengthMm,
    axisUnit: lengthAxis,
    format: formatLength,
    key: "length",
    label: "Length",
    noun: "length",
  },
  {
    accessor: (m) => m.headMm,
    axisUnit: lengthAxis,
    format: formatLength,
    key: "head",
    label: "Head",
    noun: "head circumference",
  },
];

export const BIRTH_POINT_ID = "birth-weight";

export function buildPoints(
  measurements: Measurement[],
  birthDate: string,
  metric: MetricConfig,
  birthWeightG: number | null
): GrowthPoint[] {
  const birth = parseCalendarDay(birthDate);
  const points: GrowthPoint[] = [];

  for (const m of measurements) {
    const value = metric.accessor(m);
    if (value !== null && value !== undefined) {
      const day = parseCalendarDay(m.measuredAt);
      points.push({
        ageDays: ageInDays(day, birth),
        day,
        fromProfile: false,
        id: m.id,
        value,
      });
    }
  }

  if (
    metric.key === "weight" &&
    birthWeightG !== null &&
    birthWeightG > 0 &&
    !points.some((p) => p.ageDays === 0)
  ) {
    points.push({
      ageDays: 0,
      day: birth,
      fromProfile: true,
      id: BIRTH_POINT_ID,
      value: birthWeightG,
    });
  }

  return points.toSorted((a, b) => a.ageDays - b.ageDays);
}

export interface AxisTick {
  value: number;
  label: string;
}

export interface Axis {
  min: number;
  max: number;
  ticks: AxisTick[];
  unit?: string;
}

const WEEK_STEPS = [1, 2, 4];
const MONTH_STEPS = [1, 2, 3, 6, 12];
const WEEKS_UNTIL_DAYS = 84;
const MIN_AGE_SPAN_DAYS = 28;

function pickStep(steps: number[], span: number, unit: number, max: number) {
  return (
    steps.find((step) => Math.ceil(span / (step * unit)) + 1 <= max) ??
    (steps.at(-1) as number)
  );
}

export function ageAxis(latestAgeDays: number, maxTicks: number): Axis {
  const span = Math.max(latestAgeDays, MIN_AGE_SPAN_DAYS);
  const limit = Math.max(2, maxTicks);
  const weeks = span <= WEEKS_UNTIL_DAYS;
  const unit = weeks ? 7 : DAYS_PER_MONTH;
  const step = pickStep(weeks ? WEEK_STEPS : MONTH_STEPS, span, unit, limit);
  const count = Math.ceil(span / (step * unit));

  const ticks: AxisTick[] = [];
  for (let i = 0; i <= count; i += 1) {
    const n = i * step;
    ticks.push({
      label: n === 0 ? "Birth" : `${n} ${weeks ? "wk" : "mo"}`,
      value: n * unit,
    });
  }
  return { max: count * step * unit, min: 0, ticks };
}

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  if (fraction <= 1) return magnitude;
  if (fraction <= 2) return 2 * magnitude;
  if (fraction <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function valueAxis(
  min: number,
  max: number,
  unit: { label: string; size: number },
  maxTicks: number
): Axis {
  const lo = min / unit.size;
  const hi = Math.max(max / unit.size, lo + 0.001);
  const limit = Math.max(2, maxTicks);

  let step = niceStep((hi - lo) / (limit - 1));
  let first = Math.floor(lo / step);
  let last = Math.ceil(hi / step);
  while (last - first + 1 > limit) {
    step = niceStep(step * 1.01);
    first = Math.floor(lo / step);
    last = Math.ceil(hi / step);
  }

  const decimals = step < 1 ? 1 : 0;
  const ticks: AxisTick[] = [];
  for (let i = first; i <= last; i += 1) {
    const shown = i * step;
    ticks.push({
      label: shown.toFixed(decimals),
      value: shown * unit.size,
    });
  }
  return {
    max: last * step * unit.size,
    min: first * step * unit.size,
    ticks,
    unit: unit.label,
  };
}

export interface BandSample {
  ageDays: number;
  low: number;
  median: number;
  high: number;
}

export function bandSamples(
  data: PercentilePoint[],
  untilDays: number
): BandSample[] {
  const end = Math.min(untilDays, WHO_MAX_AGE_DAYS);
  const ages = data.map((row) => row.days).filter((days) => days < end);
  ages.push(end);
  return ages.map((ageDays) => ({
    ageDays,
    high: interpolatePercentile(data, ageDays, "p97"),
    low: interpolatePercentile(data, ageDays, "p3"),
    median: interpolatePercentile(data, ageDays, "p50"),
  }));
}

function placeInRange(percentile: number): string {
  if (percentile < 15) return "toward the lower end of the typical range";
  if (percentile < 40) return "a little below the middle of the typical range";
  if (percentile <= 60) return "near the middle of the typical range";
  if (percentile <= 85) return "a little above the middle of the typical range";
  return "toward the upper end of the typical range";
}

export function describePosition(
  position: PercentilePosition,
  sex: ReferenceSex
): string {
  if (position.kind === "within") {
    const percentile = Math.round(position.percentile);
    return `Around the ${formatPercentile(percentile)} percentile, ${placeInRange(percentile)} for ${sex} this age.`;
  }
  const side = position.kind === "below" ? "Below" : "Above";
  return `${side} the typical range for ${sex} this age. Babies grow at their own pace, and your nurse or doctor can put this in context.`;
}

export function describePositionBriefly(position: PercentilePosition): string {
  if (position.kind === "within") {
    return `Around the ${formatPercentile(position.percentile)} percentile`;
  }
  return position.kind === "below"
    ? "Below the typical range"
    : "Above the typical range";
}

export type Pt = readonly [number, number];

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function smoothSegments(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return "";
  if (n === 2) return `L${fmt(pts[1][0])},${fmt(pts[1][1])}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }

  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent.push(0);
    } else {
      const total = dx[i - 1] + dx[i];
      tangent.push(
        (3 * total) /
          ((total + dx[i]) / slope[i - 1] + (total + dx[i - 1]) / slope[i])
      );
    }
  }
  tangent.push(slope[n - 2]);

  const parts: string[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const third = dx[i] / 3;
    parts.push(
      `C${fmt(x0 + third)},${fmt(y0 + tangent[i] * third)} ${fmt(x1 - third)},${fmt(y1 - tangent[i + 1] * third)} ${fmt(x1)},${fmt(y1)}`
    );
  }
  return parts.join(" ");
}
