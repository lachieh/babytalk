"use client";

import { useCallback, useEffect, useState } from "react";

import { useBabyContext } from "@/lib/baby-context";
import { triggerFeedback } from "@/lib/haptics";
import { gqlRequest } from "@/lib/tambo/graphql";
import {
  getPercentileData,
  interpolatePercentile,
  PERCENTILE_LABELS,
} from "@/lib/who-growth-data";
import type { PercentileKey } from "@/lib/who-growth-data";

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

function isImperialLocale(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.language.startsWith("en-US");
}

/* ── SVG Weight Chart with WHO Percentiles ─────────────────── */

const PERCENTILE_KEYS: PercentileKey[] = ["p3", "p15", "p50", "p85", "p97"];
const PERCENTILE_COLORS: Record<PercentileKey, string> = {
  p3: "oklch(80% 0.02 60)",
  p15: "oklch(75% 0.03 60)",
  p50: "oklch(65% 0.04 60)",
  p85: "oklch(75% 0.03 60)",
  p97: "oklch(80% 0.02 60)",
};

const WeightChart = ({
  measurements,
  birthDate,
  gender,
}: {
  measurements: Measurement[];
  birthDate: string;
  gender: string | null;
}) => {
  const filtered = measurements.filter((m: Measurement) => m.weightG !== null);
  const withWeight = [...filtered].toReversed();

  if (withWeight.length < 1) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-neutral-50 text-sm text-neutral-400">
        Add a weight to see the chart
      </div>
    );
  }

  const birthTime = new Date(birthDate).getTime();
  const percentileData = getPercentileData(gender);

  // Calculate age in days for each measurement
  const dataPoints = withWeight.map((m) => ({
    ageDays: Math.max(
      0,
      (new Date(m.measuredAt).getTime() - birthTime) / 86_400_000
    ),
    weightG: m.weightG as number,
    id: m.id,
  }));

  // Determine chart range — use percentile range if available, otherwise data range
  const allWeights = dataPoints.map((d) => d.weightG);
  const minAge = Math.min(...dataPoints.map((d) => d.ageDays));
  const maxAge = Math.max(...dataPoints.map((d) => d.ageDays), 30);
  const ageRange = maxAge - minAge || 30;

  let minW = Math.min(...allWeights);
  let maxW = Math.max(...allWeights);

  // Extend range to fit percentile curves if visible
  if (percentileData) {
    const p3AtMinAge = interpolatePercentile(percentileData, minAge, "p3");
    const p97AtMaxAge = interpolatePercentile(percentileData, maxAge, "p97");
    minW = Math.min(minW, p3AtMinAge);
    maxW = Math.max(maxW, p97AtMaxAge);
  }

  const weightPadding = (maxW - minW) * 0.1;
  minW -= weightPadding;
  maxW += weightPadding;
  const rangeW = maxW - minW || 1;

  const padding = 16;
  const width = 320;
  const height = 160;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const toX = (ageDays: number) =>
    padding + ((ageDays - minAge) / ageRange) * chartW;
  const toY = (weightG: number) =>
    padding + chartH - ((weightG - minW) / rangeW) * chartH;

  // Build percentile curve paths
  const percentilePaths: { key: PercentileKey; d: string }[] = [];
  if (percentileData) {
    const steps = 20;
    for (const key of PERCENTILE_KEYS) {
      const pathPoints: string[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const age = minAge + (i / steps) * ageRange;
        const w = interpolatePercentile(percentileData, age, key);
        const x = toX(age);
        const y = toY(w);
        pathPoints.push(`${i === 0 ? "M" : "L"}${x},${y}`);
      }
      percentilePaths.push({ key, d: pathPoints.join(" ") });
    }
  }

  // Build data polyline
  const points = dataPoints.map((d) => ({
    x: toX(d.ageDays),
    y: toY(d.weightG),
    id: d.id,
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-2xl bg-neutral-50 p-3">
      <svg
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Percentile curves */}
        {percentilePaths.map((curve) => (
          <path
            d={curve.d}
            fill="none"
            key={curve.key}
            stroke={PERCENTILE_COLORS[curve.key]}
            strokeDasharray={curve.key === "p50" ? "none" : "4 3"}
            strokeWidth={curve.key === "p50" ? "1.5" : "1"}
          />
        ))}

        {/* Percentile labels */}
        {percentileData &&
          PERCENTILE_KEYS.map((key) => {
            const w = interpolatePercentile(percentileData, maxAge, key);
            return (
              <text
                fill="oklch(65% 0.02 60)"
                fontSize="7"
                key={key}
                x={width - padding + 2}
                y={toY(w) + 2}
              >
                {PERCENTILE_LABELS[key]}
              </text>
            );
          })}

        {/* Baby's actual weight line */}
        {points.length > 1 && (
          <polyline
            fill="none"
            points={polyline}
            stroke="oklch(55% 0.14 30)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        )}
        {points.map((p) => (
          <circle
            cx={p.x}
            cy={p.y}
            fill="oklch(55% 0.14 30)"
            key={p.id}
            r="4"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-3 text-[10px] text-neutral-400">
          <span>{formatDate(withWeight[0].measuredAt)}</span>
          {withWeight.length > 1 && (
            <span>{formatDate(withWeight.at(-1)?.measuredAt ?? "")}</span>
          )}
        </div>
        {percentileData && (
          <span className="text-[10px] text-neutral-300">
            WHO {gender === "male" ? "boys" : "girls"}
          </span>
        )}
      </div>
    </div>
  );
};

/* ── Summary Card ──────────────────────────────────────────── */

const SummaryCard = ({
  measurements,
  imperial,
}: {
  measurements: Measurement[];
  imperial: boolean;
}) => {
  const latest = measurements.find((m) => m.weightG !== null);
  const withWeightList = measurements.filter((m) => m.weightG !== null);
  const [, previous] = withWeightList;

  if (!latest?.weightG) {
    return (
      <div className="rounded-2xl bg-neutral-50 px-4 py-5 text-center">
        <p className="text-sm text-neutral-400">No measurements yet</p>
        <p className="mt-1 text-xs text-neutral-300">
          Tap + to record baby&apos;s first measurement
        </p>
      </div>
    );
  }

  const change =
    previous?.weightG !== null && previous?.weightG !== undefined
      ? latest.weightG - previous.weightG
      : null;

  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
        Latest weight
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-800">
        {formatWeight(latest.weightG, imperial)}
      </p>
      {change !== null && (
        <p className="mt-0.5 text-sm text-neutral-500">
          {change >= 0 ? "+" : ""}
          {formatWeight(Math.abs(change), imperial)} since{" "}
          {formatDate(previous?.measuredAt ?? "")}
        </p>
      )}
    </div>
  );
};

/* ── Measurement Row ───────────────────────────────────────── */

const MeasurementRow = ({
  measurement,
  imperial,
  onDelete,
}: {
  measurement: Measurement;
  imperial: boolean;
  onDelete: (id: string) => void;
}) => {
  const handleDelete = useCallback(
    () => onDelete(measurement.id),
    [onDelete, measurement.id]
  );

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50">
      <span className="w-20 text-xs text-neutral-400">
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
      <button
        className="min-h-[36px] min-w-[36px] rounded-lg px-1 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
        onClick={handleDelete}
        type="button"
        aria-label="Delete measurement"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

/* ── Add Measurement Sheet ─────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const AddMeasurementSheet = ({
  open,
  imperial,
  babyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  imperial: boolean;
  babyId: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [date, setDate] = useState(todayDate);
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [length, setLength] = useState("");
  const [head, setHead] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayDate());
      setWeightLbs("");
      setWeightOz("");
      setWeightKg("");
      setLength("");
      setHead("");
      setNotes("");
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
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

      await gqlRequest(ADD_MEASUREMENT, {
        babyId,
        headMm,
        lengthMm,
        measuredAt: new Date(date).toISOString(),
        notes: notes || null,
        weightG,
      });
      triggerFeedback("logged");
      onSaved();
      onClose();
    } catch {
      // stay open
    } finally {
      setSaving(false);
    }
  }, [
    babyId,
    date,
    weightLbs,
    weightOz,
    weightKg,
    length,
    head,
    notes,
    imperial,
    onSaved,
    onClose,
  ]);

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
      aria-label="Add measurement"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-surface-raised shadow-lg safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-base font-semibold text-neutral-700">
            Add measurement
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

        <div className="space-y-4 px-5 pb-6">
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
              <div className="mt-1 flex gap-2">
                <input
                  className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
                  inputMode="numeric"
                  onChange={handleWeightLbsChange}
                  placeholder="lbs"
                  type="number"
                  value={weightLbs}
                />
                <input
                  className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
                  inputMode="decimal"
                  onChange={handleWeightOzChange}
                  placeholder="oz"
                  step="0.1"
                  type="number"
                  value={weightOz}
                />
              </div>
            ) : (
              <input
                className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
                inputMode="decimal"
                onChange={handleWeightKgChange}
                placeholder="kg"
                step="0.01"
                type="number"
                value={weightKg}
              />
            )}
          </div>

          {/* Length */}
          <label className="block text-xs font-medium text-neutral-500">
            Length
            <input
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
              inputMode="decimal"
              onChange={handleLengthChange}
              placeholder={imperial ? "inches" : "cm"}
              step="0.1"
              type="number"
              value={length}
            />
          </label>

          {/* Head */}
          <label className="block text-xs font-medium text-neutral-500">
            Head circumference
            <input
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm text-neutral-800"
              inputMode="decimal"
              onChange={handleHeadChange}
              placeholder={imperial ? "inches" : "cm"}
              step="0.1"
              type="number"
              value={head}
            />
          </label>

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

          <button
            className="min-h-[48px] w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Growth View ───────────────────────────────────────────── */

export const GrowthView = () => {
  const { baby, loading } = useBabyContext();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [imperial, setImperial] = useState(isImperialLocale);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

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

  const handleAdd = useCallback(() => setSheetOpen(true), []);
  const handleClose = useCallback(() => setSheetOpen(false), []);
  const handleSaved = useCallback(() => setFetchKey((k) => k + 1), []);

  const handleDelete = useCallback(async (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    try {
      await gqlRequest(DELETE_MEASUREMENT, { id });
    } catch {
      setFetchKey((k) => k + 1);
    }
  }, []);

  const handleToggleUnits = useCallback(() => setImperial((v) => !v), []);

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

      {/* Summary card */}
      <SummaryCard imperial={imperial} measurements={measurements} />

      {/* Weight chart */}
      <div className="mt-3">
        <WeightChart
          birthDate={baby.birthDate}
          gender={baby.gender ?? null}
          measurements={measurements}
        />
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
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add sheet */}
      <AddMeasurementSheet
        babyId={baby.id}
        imperial={imperial}
        onClose={handleClose}
        onSaved={handleSaved}
        open={sheetOpen}
      />
    </div>
  );
};
