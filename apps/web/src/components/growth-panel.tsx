"use client";

import {
  ViewTransition,
  addTransitionType,
  startTransition,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";

import { readMemory, writeMemory } from "@/lib/app-cache";
import { navTransitionTypes, pageEnter, pageExit } from "@/lib/page-transition";
import type { MeasurementUnit } from "@/lib/use-measurement-unit";
import {
  getPercentileData,
  percentilePosition,
  referenceSexFor,
} from "@/lib/who-growth-data";
import type {
  GrowthMetric,
  PercentilePoint,
  ReferenceSex,
} from "@/lib/who-growth-data";

import { EmptyIllustration } from "./empty-illustration";
import { GrowthChart } from "./growth-chart";
import {
  METRICS,
  ageInDays,
  buildPoints,
  describePosition,
  describePositionBriefly,
  formatAge,
  formatDay,
  formatLength,
  formatWeight,
  parseCalendarDay,
} from "./growth-model";
import type { GrowthPoint, Measurement, MetricConfig } from "./growth-model";
import { ChoiceChips } from "./sheet";

const UNIT_OPTIONS = [
  { label: "kg and cm", value: "metric" },
  { label: "lb and in", value: "imperial" },
] as const;

interface Reference {
  data: PercentilePoint[];
  sex: ReferenceSex;
}

function positionSentence(
  point: GrowthPoint,
  reference: Reference | null
): string | null {
  if (!reference) return null;
  const position = percentilePosition(
    reference.data,
    point.ageDays,
    point.value
  );
  return position ? describePosition(position, reference.sex) : null;
}

function positionPhrase(point: GrowthPoint, reference: Reference): string {
  const position = percentilePosition(
    reference.data,
    point.ageDays,
    point.value
  );
  return position
    ? describePositionBriefly(position)
    : "No reference for this age";
}

const METRIC_MEMORY = "growth:metric";

const MetricOption = ({
  metric,
  name,
  checked,
  onChange,
}: {
  checked: boolean;
  metric: MetricConfig;
  name: string;
  onChange: (metric: GrowthMetric) => void;
}) => {
  const handleChange = useCallback(
    () => onChange(metric.key),
    [onChange, metric.key]
  );
  return (
    <label className="relative flex min-h-[44px] flex-1 cursor-pointer select-none items-center justify-center rounded-xl px-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-800 has-checked:font-semibold has-checked:text-neutral-800 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-ink">
      {checked && (
        <ViewTransition name="growth-metric-pill" share="indicator">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-surface-raised shadow-sm"
          />
        </ViewTransition>
      )}
      {/* Uncontrolled: the choice is selected the moment it is made, while
          the pill and chart follow in a transition. */}
      <input
        className="sr-only"
        defaultChecked={checked}
        name={name}
        onChange={handleChange}
        type="radio"
        value={metric.key}
      />
      {/* Its own layer, so the sliding pill passes under the label. */}
      <ViewTransition name={`growth-metric-${metric.key}`}>
        <span className="relative">{metric.label}</span>
      </ViewTransition>
    </label>
  );
};

const MetricPicker = ({
  value,
  onChange,
}: {
  onChange: (metric: GrowthMetric) => void;
  value: GrowthMetric;
}) => {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">Measurement to chart</legend>
      <div className="flex gap-1 rounded-2xl bg-surface-sunken p-1">
        {METRICS.map((metric) => (
          <MetricOption
            checked={value === metric.key}
            key={metric.key}
            metric={metric}
            name={name}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
};

const Readout = ({
  point,
  metric,
  imperial,
  reference,
  babyName,
}: {
  babyName: string;
  imperial: boolean;
  metric: MetricConfig;
  point: GrowthPoint | null;
  reference: Reference | null;
}) => {
  if (!point) {
    return (
      <>
        <EmptyIllustration className="mb-3" variant="growth" />
        <p className="text-base font-semibold text-neutral-800">
          No {metric.noun} recorded yet
        </p>
        <p className="mt-1 max-w-prose text-sm text-neutral-600">
          {reference
            ? `Add one after a check-up to see where ${babyName} sits in the typical range for ${reference.sex}.`
            : `Add one after a check-up to start ${babyName}'s chart.`}
        </p>
      </>
    );
  }
  const sentence = positionSentence(point, reference);
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-2xl font-semibold text-neutral-800 tabular-nums">
          {metric.format(point.value, imperial)}
        </span>
        <span className="text-sm text-neutral-600">
          {point.fromProfile
            ? `Birth weight, ${formatDay(point.day)}`
            : `${formatDay(point.day)}, ${formatAge(point.ageDays)}`}
        </span>
      </p>
      {sentence && (
        <p className="mt-1 max-w-prose text-sm text-neutral-600">{sentence}</p>
      )}
    </>
  );
};

const Legend = ({
  reference,
  babyName,
  hasPoints,
}: {
  babyName: string;
  hasPoints: boolean;
  reference: Reference | null;
}) => {
  if (!reference) {
    return (
      <p className="mt-3 max-w-prose text-xs text-neutral-600">
        The WHO typical range is published for boys and for girls. To see it
        here, choose one in {babyName}&rsquo;s profile in Settings.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-5 rounded-sm bg-primary-200/60"
        />
        Typical range for {reference.sex} (WHO)
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-px w-5 bg-primary-400" />
        Middle of the range
      </li>
      {hasPoints && (
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded-full bg-neutral-800"
          />
          {babyName}
        </li>
      )}
    </ul>
  );
};

const DataTable = ({
  caption,
  metric,
  imperial,
  points,
  reference,
}: {
  caption: string;
  imperial: boolean;
  metric: MetricConfig;
  points: GrowthPoint[];
  reference: Reference | null;
}) => (
  // A table cannot shrink below its content, so sr-only on the table
  // leaves it wide enough to scroll the page sideways; the div clips it.
  <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Age</th>
          <th scope="col">{metric.label}</th>
          {reference && <th scope="col">Compared with the typical range</th>}
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.id}>
            <th scope="row">{formatDay(point.day)}</th>
            <td>{formatAge(point.ageDays)}</td>
            <td>{metric.format(point.value, imperial)}</td>
            {reference && <td>{positionPhrase(point, reference)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function chartTitle(
  babyName: string,
  metric: MetricConfig,
  latest: GrowthPoint | null,
  reference: Reference | null
): string {
  if (!latest) {
    return `Typical ${metric.noun} range for ${reference?.sex ?? "babies"}`;
  }
  const until =
    latest.ageDays === 0
      ? "at birth"
      : `birth to ${formatAge(latest.ageDays).replace(" old", "")}`;
  return `${babyName}'s ${metric.noun}, ${until}`;
}

function chartDescription(
  metric: MetricConfig,
  imperial: boolean,
  points: GrowthPoint[],
  reference: Reference | null
): string {
  const latest = points.at(-1);
  const parts: (string | null)[] = [];
  if (latest) {
    const count =
      points.length === 1 ? "1 measurement" : `${points.length} measurements`;
    parts.push(
      `${count}. Latest: ${metric.format(latest.value, imperial)} on ${formatDay(latest.day)}.`,
      positionSentence(latest, reference)
    );
  } else {
    parts.push("No measurements yet.");
  }
  if (reference) {
    parts.push(
      `The shaded band is the range most healthy ${reference.sex} fall in, from the WHO growth standards. The line inside it is the middle of that range.`
    );
  }
  return parts.filter(Boolean).join(" ");
}

const ChartSection = ({
  babyName,
  metric,
  imperial,
  points,
  reference,
  currentAgeDays,
}: {
  babyName: string;
  currentAgeDays: number;
  imperial: boolean;
  metric: MetricConfig;
  points: GrowthPoint[];
  reference: Reference | null;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latest = points.at(-1) ?? null;
  const selected = points.find((p) => p.id === selectedId) ?? latest;

  return (
    <>
      <div
        aria-live="polite"
        className={reference ? "mt-5 min-h-[4.75rem]" : "mt-5"}
      >
        <Readout
          babyName={babyName}
          imperial={imperial}
          metric={metric}
          point={selected}
          reference={reference}
        />
      </div>

      {(latest || reference) && (
        <div className="mt-3">
          <GrowthChart
            currentAgeDays={currentAgeDays}
            description={chartDescription(metric, imperial, points, reference)}
            imperial={imperial}
            metric={metric}
            onSelect={setSelectedId}
            points={points}
            reference={reference?.data ?? null}
            selectedId={selected?.id ?? null}
            title={chartTitle(babyName, metric, latest, reference)}
          />
          {latest && (
            <DataTable
              caption={`${babyName}'s ${metric.noun} measurements`}
              imperial={imperial}
              metric={metric}
              points={points}
              reference={reference}
            />
          )}
        </div>
      )}

      <Legend
        babyName={babyName}
        hasPoints={latest !== null}
        reference={reference}
      />
    </>
  );
};

const ROW_CLASS =
  "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left";
const ROW_DATE_CLASS = "w-24 shrink-0 text-sm text-neutral-600";

const MeasurementRow = ({
  measurement,
  imperial,
  onEdit,
}: {
  imperial: boolean;
  measurement: Measurement;
  onEdit: (m: Measurement) => void;
}) => {
  const handleClick = useCallback(
    () => onEdit(measurement),
    [onEdit, measurement]
  );
  const { weightG, lengthMm, headMm, notes } = measurement;
  const details: string[] = [];
  if (lengthMm !== null) {
    details.push(`Length ${formatLength(lengthMm, imperial)}`);
  }
  if (headMm !== null) details.push(`Head ${formatLength(headMm, imperial)}`);

  return (
    <li>
      <button
        className={`${ROW_CLASS} transition-colors hover:bg-neutral-100 active:bg-neutral-100`}
        onClick={handleClick}
        type="button"
      >
        <span className={ROW_DATE_CLASS}>
          {formatDay(parseCalendarDay(measurement.measuredAt))}
        </span>
        <span className="min-w-0 flex-1 tabular-nums">
          {weightG !== null && (
            <span className="block text-sm font-semibold text-neutral-800">
              {formatWeight(weightG, imperial)}
            </span>
          )}
          {details.length > 0 && (
            <span className="flex flex-wrap gap-x-3 text-sm text-neutral-600">
              {details.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
            </span>
          )}
          {notes && (
            <span className="mt-0.5 block text-xs text-neutral-500">
              {notes}
            </span>
          )}
        </span>
        <span className="sr-only">Edit</span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  );
};

const BirthWeightRow = ({
  babyName,
  birth,
  grams,
  imperial,
}: {
  babyName: string;
  birth: Date;
  grams: number;
  imperial: boolean;
}) => (
  <li className={ROW_CLASS}>
    <span className={ROW_DATE_CLASS}>{formatDay(birth)}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-neutral-800 tabular-nums">
        {formatWeight(grams, imperial)}
      </span>
      <span className="mt-0.5 block text-xs text-neutral-500">
        Birth weight, from {babyName}&rsquo;s profile
      </span>
    </span>
  </li>
);

const AddButton = ({
  prominent,
  onAdd,
}: {
  onAdd: () => void;
  prominent: boolean;
}) => (
  <button
    className={`mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background-color,transform] active:scale-[0.98] motion-reduce:active:scale-100 ${
      prominent
        ? "bg-primary-600 text-white hover:bg-primary-700"
        : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
    }`}
    onClick={onAdd}
    type="button"
  >
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14m7-7H5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    Add measurement
  </button>
);

export interface GrowthPanelProps {
  babyName: string;
  birthDate: string;
  gender: string | null;
  birthWeightG: number | null;
  measurements: Measurement[];
  imperial: boolean;
  onUnitChange: (unit: MeasurementUnit) => void;
  onAdd: () => void;
  onEdit: (m: Measurement) => void;
  today?: Date;
}

export const GrowthPanel = ({
  babyName,
  birthDate,
  gender,
  birthWeightG,
  measurements,
  imperial,
  onUnitChange,
  onAdd,
  onEdit,
  today,
}: GrowthPanelProps) => {
  const [metricKey, setMetricKey] = useState<GrowthMetric>(
    () => readMemory<GrowthMetric>(METRIC_MEMORY) ?? "weight"
  );
  const chooseMetric = useCallback(
    (next: GrowthMetric) => {
      writeMemory(METRIC_MEMORY, next);
      const from = METRICS.findIndex((m) => m.key === metricKey);
      const to = METRICS.findIndex((m) => m.key === next);
      startTransition(() => {
        for (const type of navTransitionTypes(from, to) ?? []) {
          addTransitionType(type);
        }
        setMetricKey(next);
      });
    },
    [metricKey]
  );
  const chartHeadingId = useId();
  const listHeadingId = useId();

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const points = useMemo(
    () => buildPoints(measurements, birthDate, metric, birthWeightG),
    [measurements, birthDate, metric, birthWeightG]
  );
  const reference = useMemo((): Reference | null => {
    const sex = referenceSexFor(gender);
    const data = getPercentileData(metric.key, gender);
    return sex && data ? { data, sex } : null;
  }, [metric.key, gender]);

  const birth = parseCalendarDay(birthDate);
  const birthWeight =
    birthWeightG !== null && birthWeightG > 0 ? birthWeightG : null;
  const hasAnything = measurements.length > 0 || birthWeight !== null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-1 pb-10">
      <section aria-labelledby={chartHeadingId}>
        <h2 className="sr-only" id={chartHeadingId}>
          Growth chart
        </h2>
        <MetricPicker onChange={chooseMetric} value={metric.key} />
        <ViewTransition
          default="none"
          enter={pageEnter}
          exit={pageExit}
          key={metric.key}
        >
          <div>
            <ChartSection
              babyName={babyName}
              currentAgeDays={ageInDays(today ?? new Date(), birth)}
              imperial={imperial}
              metric={metric}
              points={points}
              reference={reference}
            />
          </div>
        </ViewTransition>
      </section>

      <AddButton onAdd={onAdd} prominent={!hasAnything} />

      {hasAnything && (
        <section aria-labelledby={listHeadingId} className="mt-9">
          <h2
            className="px-3 text-sm font-semibold text-neutral-800"
            id={listHeadingId}
          >
            Measurements
          </h2>
          <ul className="mt-1">
            {measurements.map((m) => (
              <MeasurementRow
                imperial={imperial}
                key={m.id}
                measurement={m}
                onEdit={onEdit}
              />
            ))}
            {birthWeight !== null && (
              <BirthWeightRow
                babyName={babyName}
                birth={birth}
                grams={birthWeight}
                imperial={imperial}
              />
            )}
          </ul>
        </section>
      )}

      <div className="mt-9 px-3">
        <ChoiceChips
          legend="Units"
          onChange={onUnitChange}
          options={UNIT_OPTIONS}
          value={imperial ? "imperial" : "metric"}
        />
      </div>
    </div>
  );
};
