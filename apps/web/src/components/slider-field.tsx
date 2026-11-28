"use client";

import { useCallback, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { resolveTime, toLocalInput } from "@/lib/event-time";
import type { TimeChoice } from "@/lib/event-time";
import { displayToMl, mlToDisplay } from "@/lib/use-volume-unit";
import type { VolumeUnit } from "@/lib/use-volume-unit";

import { FIELD_INPUT_CLASS, FieldError } from "./sheet";

const PICK_CLASS =
  "min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors";

const idsFor = (id: string) => ({
  error: `${id}-error`,
  legend: `${id}-legend`,
  picker: `${id}-picker`,
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const SliderField = ({
  legend,
  readout,
  min,
  max,
  step,
  value,
  fill,
  minLabel,
  maxLabel,
  onSlide,
  picker,
  error,
  readoutOnly = false,
  id,
}: {
  error?: string;
  fill: "below" | "above";
  readoutOnly?: boolean;
  id: string;
  legend: ReactNode;
  max: number;
  maxLabel: string;
  min: number;
  minLabel: string;
  onSlide: (value: number) => void;
  picker: ReactNode;
  readout: string;
  step: number;
  value: number;
}) => {
  const { error: errorId, legend: legendId, picker: pickerId } = idsFor(id);
  const [picking, setPicking] = useState(false);

  const handleSlide = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPicking(false);
      onSlide(Number(e.target.value));
    },
    [onSlide]
  );
  const togglePicking = useCallback(() => setPicking((p) => !p), []);

  const position = clamp(
    min + Math.round((value - min) / step) * step,
    min,
    max
  );
  const pct = ((position - min) / (max - min)) * 100;
  const fillStyle = {
    "--fill-from": fill === "below" ? "0%" : `${pct}%`,
    "--fill-to": fill === "below" ? `${pct}%` : "100%",
  } as CSSProperties;

  return (
    <div aria-labelledby={legendId} role="group">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-neutral-600" id={legendId}>
          {legend}
        </span>
        <span
          aria-hidden="true"
          className="text-right text-sm font-medium tabular-nums text-neutral-800"
        >
          {readout}
        </span>
      </div>
      {!readoutOnly && (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <input
                aria-describedby={error && !picking ? errorId : undefined}
                aria-invalid={error && !picking ? true : undefined}
                aria-labelledby={legendId}
                aria-valuetext={readout}
                className="slider block w-full"
                max={max}
                min={min}
                onChange={handleSlide}
                step={step}
                style={fillStyle}
                type="range"
                value={position}
              />
              <div
                aria-hidden="true"
                className="-mt-1 flex justify-between text-xs text-neutral-500"
              >
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
              </div>
            </div>
            <button
              aria-controls={picking ? pickerId : undefined}
              aria-expanded={picking}
              className={`${PICK_CLASS} ${
                picking
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 bg-surface text-neutral-700 hover:border-neutral-300"
              }`}
              onClick={togglePicking}
              type="button"
            >
              Pick
            </button>
          </div>
          {picking && picker}
        </>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
};

const TIME_STEP = 5;
const SLIDER_MINUTES = 60;

const clockOf = (at: number, now: number): string => {
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return new Date(at).toLocaleString(
    [],
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }
  );
};

export function describeTime(choice: TimeChoice, now = Date.now()): string {
  if (choice.kind === "ago") {
    if (choice.minutes <= 0) return "Now";
    return `${choice.minutes} min ago · ${clockOf(now - choice.minutes * 60_000, now)}`;
  }
  const at = resolveTime(choice, now);
  return Number.isFinite(at) ? clockOf(at, now) : "Pick a time";
}

export const TimeSlider = ({
  legend,
  choice,
  onChange,
  error,
  running = false,
}: {
  choice: TimeChoice;
  error?: string;
  legend: ReactNode;
  onChange: (choice: TimeChoice) => void;
  running?: boolean;
}) => {
  const id = useId();
  const ids = idsFor(id);
  const now = Date.now();
  const at = resolveTime(choice, now);
  const minutesAgo = Number.isFinite(at)
    ? Math.round((now - at) / 60_000)
    : SLIDER_MINUTES;

  const handleSlide = useCallback(
    (value: number) => onChange({ kind: "ago", minutes: -value }),
    [onChange]
  );
  const handlePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ kind: "at", local: e.target.value }),
    [onChange]
  );

  const picker = (
    <>
      <label className="sr-only" htmlFor={ids.picker}>
        {legend}, date and time
      </label>
      <input
        aria-describedby={error ? ids.error : undefined}
        aria-invalid={error ? true : undefined}
        className={FIELD_INPUT_CLASS}
        id={ids.picker}
        max={toLocalInput(now)}
        onChange={handlePicked}
        type="datetime-local"
        value={
          choice.kind === "at"
            ? choice.local
            : toLocalInput(now - choice.minutes * 60_000)
        }
      />
    </>
  );

  return (
    <SliderField
      error={error}
      fill="above"
      legend={legend}
      max={0}
      maxLabel="Now"
      min={-SLIDER_MINUTES}
      minLabel={`${SLIDER_MINUTES} min ago`}
      onSlide={handleSlide}
      picker={picker}
      readoutOnly={running}
      id={id}
      readout={running ? "Still going" : describeTime(choice, now)}
      step={TIME_STEP}
      value={-minutesAgo}
    />
  );
};

const AMOUNT_RANGE: Record<VolumeUnit, { max: number; step: number }> = {
  ml: { max: 240, step: 5 },
  oz: { max: 8, step: 0.5 },
};

export const AmountSlider = ({
  legend,
  amountMl,
  unit,
  onChange,
  error,
}: {
  amountMl: number | undefined;
  error?: string;
  legend: ReactNode;
  onChange: (amountMl: number | undefined) => void;
  unit: VolumeUnit;
}) => {
  const id = useId();
  const ids = idsFor(id);
  const { max, step } = AMOUNT_RANGE[unit];
  const shown = amountMl ? mlToDisplay(amountMl, unit) : 0;

  const [typed, setTyped] = useState<{ text: string; unit: VolumeUnit }>();

  const handleSlide = useCallback(
    (value: number) => {
      setTyped(undefined);
      onChange(value > 0 ? displayToMl(value, unit) : undefined);
    },
    [onChange, unit]
  );
  const handlePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setTyped({ text: e.target.value, unit });
      onChange(value > 0 ? displayToMl(value, unit) : undefined);
    },
    [onChange, unit]
  );

  const picker = (
    <>
      <label className="sr-only" htmlFor={ids.picker}>
        {legend}, in {unit}
      </label>
      <input
        aria-describedby={error ? ids.error : undefined}
        aria-invalid={error ? true : undefined}
        className={FIELD_INPUT_CLASS}
        id={ids.picker}
        inputMode="decimal"
        min="0"
        onChange={handlePicked}
        placeholder={`Amount in ${unit}`}
        step="any"
        type="number"
        value={typed?.unit === unit ? typed.text : shown || ""}
      />
    </>
  );

  return (
    <SliderField
      error={error}
      fill="below"
      id={id}
      legend={legend}
      max={max}
      maxLabel={`${max} ${unit}`}
      min={0}
      minLabel="None"
      onSlide={handleSlide}
      picker={picker}
      readout={shown ? `${shown} ${unit}` : "None"}
      step={step}
      value={shown}
    />
  );
};
