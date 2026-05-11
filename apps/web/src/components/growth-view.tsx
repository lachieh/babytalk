"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";
import { gqlRequest } from "@/lib/tambo/graphql";
import { useMeasurementUnit } from "@/lib/use-measurement-unit";
import {
  estimatePercentile,
  formatPercentile,
  getPercentileData,
  interpolatePercentile,
} from "@/lib/who-growth-data";
import type { GrowthMetric, PercentileKey } from "@/lib/who-growth-data";

/* ── Types ─────────────────────────────────────────────────── */

interface Measurement {
  id: string;
  babyId: string;
  measuredAt: string;
  weightG: number | null;
  lengthMm: number | null;
  headMm: number | null;
  notes: string | null;
}

/* ── GraphQL ───────────────────────────────────────────────── */

const GET_MEASUREMENTS = `
  query Measurements($babyId: String!, $limit: Int) {
    measurements(babyId: $babyId, limit: $limit) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
  }
`;

const ADD_MEASUREMENT = `
  mutation AddMeasurement(
    $babyId: String!
    $measuredAt: String
    $weightG: Int
    $lengthMm: Int
    $headMm: Int
    $notes: String
  ) {
    addMeasurement(
      babyId: $babyId
      measuredAt: $measuredAt
      weightG: $weightG
      lengthMm: $lengthMm
      headMm: $headMm
      notes: $notes
    ) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
  }
`;

const DELETE_MEASUREMENT = `
  mutation DeleteMeasurement($id: String!) {
    deleteMeasurement(id: $id)
  }
`;

const UPDATE_MEASUREMENT = `
  mutation UpdateMeasurement(
    $id: String!
    $measuredAt: String
    $weightG: Int
    $lengthMm: Int
    $headMm: Int
    $notes: String
  ) {
    updateMeasurement(
      id: $id
      measuredAt: $measuredAt
      weightG: $weightG
      lengthMm: $lengthMm
      headMm: $headMm
      notes: $notes
    ) {
      id babyId measuredAt weightG lengthMm headMm notes
    }
  }
`;

/* ── Unit Helpers ──────────────────────────────────────────── */

function formatWeight(grams: number, imperial: boolean): string {
  if (imperial) {
    const lbs = Math.floor(grams / 453.592);
    const oz = Math.round((grams % 453.592) / 28.3495);
    return `${lbs} lb ${oz} oz`;
  }
  return `${(grams / 1000).toFixed(2)} kg`;
}

function formatLength(mm: number, imperial: boolean): string {
  if (imperial) {
    const inches = mm / 25.4;
    return `${inches.toFixed(1)} in`;
  }
  return `${(mm / 10).toFixed(1)} cm`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Metric configuration ──────────────────────────────────── */

interface MetricConfig {
  key: GrowthMetric;
  label: string;
  accessor: (m: Measurement) => number | null;
  color: string;
  format: (value: number, imperial: boolean) => string;
}

const METRICS: MetricConfig[] = [
  {
    accessor: (m) => m.weightG,
    color: "var(--color-feed-500)",
    format: formatWeight,
    key: "weight",
    label: "Weight",
  },
  {
    accessor: (m) => m.lengthMm,
    color: "var(--color-sleep-500)",
    format: formatLength,
    key: "length",
    label: "Height",
  },
  {
    accessor: (m) => m.headMm,
    color: "var(--color-pump-500)",
    format: formatLength,
    key: "head",
    label: "Head",
  },
];

const PERCENTILE_KEYS: PercentileKey[] = ["p3", "p15", "p50", "p85", "p97"];
const PERCENTILE_COLORS: Record<PercentileKey, string> = {
  p3: "oklch(80% 0.02 60)",
  p15: "oklch(75% 0.03 60)",
  p50: "oklch(65% 0.04 60)",
  p85: "oklch(75% 0.03 60)",
  p97: "oklch(80% 0.02 60)",
};

interface MetricSeries {
  config: MetricConfig;
  points: { ageDays: number; value: number; id: string }[];
}

function buildSeries(
  measurements: Measurement[],
  birthDate: string
): MetricSeries[] {
  const birthTime = new Date(birthDate).getTime();
  const ordered = [...measurements].toReversed();

  return METRICS.map((config) => {
    const points = ordered
      .map((m) => {
        const value = config.accessor(m);
        if (value === null) return null;
        return {
          ageDays: Math.max(
            0,
            (new Date(m.measuredAt).getTime() - birthTime) / 86_400_000
          ),
          id: m.id,
          value,
        };
      })
      .filter(
        (p): p is { ageDays: number; value: number; id: string } => p !== null
      );
    return { config, points };
  });
}

/* ── Multi-metric Chart ────────────────────────────────────── */

const MultiMetricChart = ({
  series,
  active,
  gender,
}: {
  series: MetricSeries[];
  active: Set<GrowthMetric>;
  gender: string | null;
}) => {
  const visible = series.filter(
    (s) => active.has(s.config.key) && s.points.length > 0
  );

  if (visible.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl bg-neutral-50 text-sm text-neutral-400">
        {series.some((s) => s.points.length > 0)
          ? "Toggle a metric above to see its trend"
          : "Add a measurement to see the chart"}
      </div>
    );
  }

  const padding = 16;
  const width = 320;
  const height = 180;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  // Shared X scale (age in days) across all visible series.
  const allAges = visible.flatMap((s) => s.points.map((p) => p.ageDays));
  const minAge = Math.min(...allAges);
  const maxAge = Math.max(...allAges, minAge + 30);
  const ageRange = maxAge - minAge || 30;
  const toX = (ageDays: number) =>
    padding + ((ageDays - minAge) / ageRange) * chartW;

  // When only one metric is visible, show WHO percentile bands.
  const showCurves = visible.length === 1;
  const soloMetric = showCurves ? visible[0] : null;
  const percentileData = soloMetric
    ? getPercentileData(soloMetric.config.key, gender)
    : null;

  // Per-series normalization. When a percentile band is drawn the band
  // extends the value range so the data line stays inside the bands.
  const seriesScales = visible.map((s) => {
    const values = s.points.map((p) => p.value);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);

    if (s === soloMetric && percentileData) {
      const p3Min = interpolatePercentile(percentileData, minAge, "p3");
      const p97Max = interpolatePercentile(percentileData, maxAge, "p97");
      minV = Math.min(minV, p3Min);
      maxV = Math.max(maxV, p97Max);
    }

    const pad = (maxV - minV) * 0.1 || maxV * 0.05 || 1;
    minV -= pad;
    maxV += pad;
    const range = maxV - minV || 1;

    return {
      series: s,
      toY: (v: number) => padding + chartH - ((v - minV) / range) * chartH,
    };
  });

  return (
    <div className="rounded-2xl bg-neutral-50 p-3">
      <svg
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* WHO percentile bands (single-metric view only) */}
        {soloMetric &&
          percentileData &&
          PERCENTILE_KEYS.map((key) => {
            const scale = seriesScales.find((sc) => sc.series === soloMetric);
            if (!scale) return null;
            const steps = 20;
            const pathPoints: string[] = [];
            for (let i = 0; i <= steps; i += 1) {
              const age = minAge + (i / steps) * ageRange;
              const w = interpolatePercentile(percentileData, age, key);
              pathPoints.push(
                `${i === 0 ? "M" : "L"}${toX(age)},${scale.toY(w)}`
              );
            }
            return (
              <path
                d={pathPoints.join(" ")}
                fill="none"
                key={key}
                stroke={PERCENTILE_COLORS[key]}
                strokeDasharray={key === "p50" ? "none" : "4 3"}
                strokeWidth={key === "p50" ? "1.5" : "1"}
              />
            );
          })}

        {/* Data lines */}
        {seriesScales.map(({ series: s, toY }) => {
          const points = s.points.map((p) => ({
            id: p.id,
            x: toX(p.ageDays),
            y: toY(p.value),
          }));
          const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={s.config.key}>
              {points.length > 1 && (
                <polyline
                  fill="none"
                  points={polyline}
                  stroke={s.config.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              )}
              {points.map((p) => (
                <circle
                  cx={p.x}
                  cy={p.y}
                  fill={s.config.color}
                  key={p.id}
                  r="3.5"
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ── Metric Toggle (chip with value + percentile) ──────────── */

interface ToggleSummary {
  config: MetricConfig;
  latest: number | null;
  percentile: number | null;
}

function summariseMetrics(
  measurements: Measurement[],
  birthDate: string,
  gender: string | null
): ToggleSummary[] {
  const birthTime = new Date(birthDate).getTime();
  return METRICS.map((config) => {
    const latestMeasurement = measurements.find(
      (m) => config.accessor(m) !== null
    );
    if (!latestMeasurement) {
      return { config, latest: null, percentile: null };
    }
    const value = config.accessor(latestMeasurement) as number;
    const ageDays = Math.max(
      0,
      (new Date(latestMeasurement.measuredAt).getTime() - birthTime) /
        86_400_000
    );
    const data = getPercentileData(config.key, gender);
    const percentile = data ? estimatePercentile(data, ageDays, value) : null;
    return { config, latest: value, percentile };
  });
}

const MetricToggle = ({
  summary,
  active,
  imperial,
  onToggle,
}: {
  summary: ToggleSummary;
  active: boolean;
  imperial: boolean;
  onToggle: (key: GrowthMetric) => void;
}) => {
  const handleClick = useCallback(
    () => onToggle(summary.config.key),
    [onToggle, summary.config.key]
  );

  const valueLabel =
    summary.latest === null
      ? "—"
      : summary.config.format(summary.latest, imperial);
  const percentileLabel =
    summary.percentile === null ? null : formatPercentile(summary.percentile);

  return (
    <button
      aria-pressed={active}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors ${
        active
          ? "border-transparent bg-neutral-100 shadow-sm"
          : "border-neutral-200 bg-transparent hover:bg-neutral-50"
      }`}
      onClick={handleClick}
      type="button"
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="block h-2 w-2 rounded-full transition-opacity"
          style={{
            backgroundColor: summary.config.color,
            opacity: active ? 1 : 0.35,
          }}
        />
        <span
          className={`text-[11px] font-medium uppercase tracking-wider ${
            active ? "text-neutral-700" : "text-neutral-400"
          }`}
        >
          {summary.config.label}
        </span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          active ? "text-neutral-800" : "text-neutral-500"
        }`}
      >
        {valueLabel}
      </span>
      <span className="text-[10px] text-neutral-400">
        {percentileLabel ? `${percentileLabel} pct` : "—"}
      </span>
    </button>
  );
};

/* ── Measurement Row ───────────────────────────────────────── */

const MeasurementRow = ({
  measurement,
  imperial,
  onEdit,
}: {
  measurement: Measurement;
  imperial: boolean;
  onEdit: (m: Measurement) => void;
}) => {
  const handleClick = useCallback(
    () => onEdit(measurement),
    [onEdit, measurement]
  );

  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-neutral-50"
      onClick={handleClick}
      type="button"
    >
      <span className="w-20 shrink-0 text-xs text-neutral-400">
        {formatDate(measurement.measuredAt)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex gap-3 text-sm">
          {measurement.weightG !== null &&
            measurement.weightG !== undefined && (
              <span className="font-medium text-neutral-700">
                {formatWeight(measurement.weightG, imperial)}
              </span>
            )}
          {measurement.lengthMm !== null &&
            measurement.lengthMm !== undefined && (
              <span className="text-neutral-500">
                {formatLength(measurement.lengthMm, imperial)}
              </span>
            )}
          {measurement.headMm !== null && measurement.headMm !== undefined && (
            <span className="text-neutral-400">
              Head {formatLength(measurement.headMm, imperial)}
            </span>
          )}
        </div>
        {measurement.notes && (
          <p className="mt-0.5 text-xs text-neutral-400">{measurement.notes}</p>
        )}
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

/* ── Measurement Edit Sheet ────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

function toDateString(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayDate(): string {
  return toDateString(new Date().toISOString());
}

function gramsToLbs(g: number): string {
  return String(Math.floor(g / 453.592));
}

function gramsToOz(g: number): string {
  return String(Math.round((g % 453.592) / 28.3495));
}

function gramsToKg(g: number): string {
  return (g / 1000).toFixed(2);
}

function mmToDisplay(mm: number, imperial: boolean): string {
  return imperial ? (mm / 25.4).toFixed(1) : (mm / 10).toFixed(1);
}

const MeasurementEditSheet = ({
  open,
  imperial,
  babyId,
  measurement,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  imperial: boolean;
  babyId: string;
  measurement: Measurement | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}) => {
  const isEdit = measurement !== null;
  const [date, setDate] = useState(todayDate);
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [length, setLength] = useState("");
  const [head, setHead] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (measurement) {
      setDate(toDateString(measurement.measuredAt));
      if (measurement.weightG !== null && measurement.weightG !== undefined) {
        if (imperial) {
          setWeightLbs(gramsToLbs(measurement.weightG));
          setWeightOz(gramsToOz(measurement.weightG));
          setWeightKg("");
        } else {
          setWeightKg(gramsToKg(measurement.weightG));
          setWeightLbs("");
          setWeightOz("");
        }
      } else {
        setWeightLbs("");
        setWeightOz("");
        setWeightKg("");
      }
      setLength(
        measurement.lengthMm !== null && measurement.lengthMm !== undefined
          ? mmToDisplay(measurement.lengthMm, imperial)
          : ""
      );
      setHead(
        measurement.headMm !== null && measurement.headMm !== undefined
          ? mmToDisplay(measurement.headMm, imperial)
          : ""
      );
      setNotes(measurement.notes ?? "");
    } else {
      setDate(todayDate());
      setWeightLbs("");
      setWeightOz("");
      setWeightKg("");
      setLength("");
      setHead("");
      setNotes("");
    }
  }, [open, measurement, imperial]);

  const buildPayload = useCallback(() => {
    let weightG: number | null = null;
    if (imperial && (weightLbs || weightOz)) {
      const lbs = Number(weightLbs) || 0;
      const oz = Number(weightOz) || 0;
      weightG = Math.round(lbs * 453.592 + oz * 28.3495);
    } else if (!imperial && weightKg) {
      weightG = Math.round(Number(weightKg) * 1000);
    }

    let lengthMm: number | null = null;
    if (length) {
      lengthMm = imperial
        ? Math.round(Number(length) * 25.4)
        : Math.round(Number(length) * 10);
    }

    let headMm: number | null = null;
    if (head) {
      headMm = imperial
        ? Math.round(Number(head) * 25.4)
        : Math.round(Number(head) * 10);
    }

    return {
      headMm,
      lengthMm,
      measuredAt: new Date(date).toISOString(),
      notes: notes || null,
      weightG,
    };
  }, [imperial, weightLbs, weightOz, weightKg, length, head, date, notes]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await (isEdit
        ? gqlRequest(UPDATE_MEASUREMENT, { id: measurement.id, ...payload })
        : gqlRequest(ADD_MEASUREMENT, { babyId, ...payload }));
      triggerFeedback("logged");
      onSaved();
      onClose();
    } catch {
      // stay open
    } finally {
      setSaving(false);
    }
  }, [isEdit, measurement, babyId, buildPayload, onSaved, onClose]);

  const handleDelete = useCallback(async () => {
    if (!measurement) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await gqlRequest(DELETE_MEASUREMENT, { id: measurement.id });
      triggerFeedback("logged");
      onDeleted(measurement.id);
      onClose();
    } catch {
      // stay open
    }
  }, [measurement, confirmDelete, onDeleted, onClose]);

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value),
    []
  );
  const handleWeightLbsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeightLbs(e.target.value),
    []
  );
  const handleWeightOzChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeightOz(e.target.value),
    []
  );
  const handleWeightKgChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeightKg(e.target.value),
    []
  );
  const handleLengthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLength(e.target.value),
    []
  );
  const handleHeadChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setHead(e.target.value),
    []
  );
  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value),
    []
  );

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit measurement" : "Add measurement"}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            {isEdit ? "Edit measurement" : "Add measurement"}
          </h2>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pb-6">
          {/* Date */}
          <label className="block text-xs font-medium text-neutral-500">
            Date
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2.5 text-sm text-neutral-800"
              onChange={handleDateChange}
              type="date"
              value={date}
            />
          </label>

          {/* Weight */}
          <div>
            <p className="text-xs font-medium text-neutral-500">Weight</p>
            {imperial ? (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    className="min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 pr-10 text-sm text-neutral-800"
                    inputMode="numeric"
                    onChange={handleWeightLbsChange}
                    placeholder="0"
                    type="number"
                    value={weightLbs}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                    lb
                  </span>
                </div>
                <div className="relative">
                  <input
                    className="min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 pr-10 text-sm text-neutral-800"
                    inputMode="decimal"
                    onChange={handleWeightOzChange}
                    placeholder="0"
                    step="0.1"
                    type="number"
                    value={weightOz}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                    oz
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative mt-1">
                <input
                  className="min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 pr-12 text-sm text-neutral-800"
                  inputMode="decimal"
                  onChange={handleWeightKgChange}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={weightKg}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  kg
                </span>
              </div>
            )}
          </div>

          {/* Length */}
          <div>
            <p className="text-xs font-medium text-neutral-500">Length</p>
            <div className="relative mt-1">
              <input
                className="min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 pr-12 text-sm text-neutral-800"
                inputMode="decimal"
                onChange={handleLengthChange}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={length}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                {imperial ? "in" : "cm"}
              </span>
            </div>
          </div>

          {/* Head */}
          <div>
            <p className="text-xs font-medium text-neutral-500">
              Head circumference
            </p>
            <div className="relative mt-1">
              <input
                className="min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 pr-12 text-sm text-neutral-800"
                inputMode="decimal"
                onChange={handleHeadChange}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={head}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                {imperial ? "in" : "cm"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <label className="block text-xs font-medium text-neutral-500">
            Notes
            <input
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
              onChange={handleNotesChange}
              placeholder="2-month checkup"
              type="text"
              value={notes}
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              className="min-h-[48px] w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {isEdit && (
              <button
                className="min-h-[48px] rounded-xl border border-danger-200 px-4 py-3 text-sm font-medium text-danger-500 transition-colors hover:bg-danger-50"
                onClick={handleDelete}
                type="button"
              >
                {confirmDelete ? "Tap again to confirm" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Growth View ───────────────────────────────────────────── */

const ALL_METRICS: GrowthMetric[] = ["weight", "length", "head"];

export const GrowthView = () => {
  const { baby, loading } = useBabyContext();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const { imperial, toggle: handleToggleUnits } = useMeasurementUnit();
  const [active, setActive] = useState<Set<GrowthMetric>>(
    () => new Set(ALL_METRICS)
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] =
    useState<Measurement | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const toggleMetric = useCallback((key: GrowthMetric) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Keep at least one metric active so the chart is never empty.
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!baby) return;
    const load = async () => {
      try {
        const data = await gqlRequest<{ measurements: Measurement[] }>(
          GET_MEASUREMENTS,
          { babyId: baby.id, limit: 50 }
        );
        setMeasurements(data.measurements);
      } catch {
        /* non-critical */
      }
    };
    load();
  }, [baby, fetchKey]);

  const handleAdd = useCallback(() => {
    setEditingMeasurement(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback((m: Measurement) => {
    setEditingMeasurement(m);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetOpen(false);
    setEditingMeasurement(null);
  }, []);

  const handleSaved = useCallback(() => setFetchKey((k) => k + 1), []);

  const handleDeleted = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const series = useMemo(
    () => (baby ? buildSeries(measurements, baby.birthDate) : []),
    [baby, measurements]
  );

  const summaries = useMemo(
    () =>
      baby
        ? summariseMetrics(measurements, baby.birthDate, baby.gender ?? null)
        : [],
    [baby, measurements]
  );

  if (loading || !baby) return null;

  return (
    <div className="px-4 py-3">
      {/* Header with unit toggle */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Growth</h3>
        <button
          className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
          onClick={handleToggleUnits}
          type="button"
        >
          {imperial ? "lb / in" : "kg / cm"}
        </button>
      </div>

      {/* Chart */}
      <MultiMetricChart
        active={active}
        gender={baby.gender ?? null}
        series={series}
      />

      {/* Metric toggles with current value + percentile */}
      <div className="mt-3 flex gap-2">
        {summaries.map((summary) => (
          <MetricToggle
            active={active.has(summary.config.key)}
            imperial={imperial}
            key={summary.config.key}
            onToggle={toggleMetric}
            summary={summary}
          />
        ))}
      </div>

      {/* Add button */}
      <button
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        onClick={handleAdd}
        type="button"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add measurement
      </button>

      {/* Measurement list */}
      {measurements.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Measurements
          </p>
          <div className="space-y-0.5">
            {measurements.map((m) => (
              <MeasurementRow
                imperial={imperial}
                key={m.id}
                measurement={m}
                onEdit={handleEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit/Add sheet */}
      <MeasurementEditSheet
        babyId={baby.id}
        imperial={imperial}
        measurement={editingMeasurement}
        onClose={handleClose}
        onDeleted={handleDeleted}
        onSaved={handleSaved}
        open={sheetOpen}
      />
    </div>
  );
};
