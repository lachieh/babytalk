"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import type { PercentilePoint } from "@/lib/who-growth-data";

import {
  ageAxis,
  bandSamples,
  formatAge,
  formatDay,
  smoothSegments,
  valueAxis,
} from "./growth-model";
import type { Axis, GrowthPoint, MetricConfig, Pt } from "./growth-model";

const BAND = "var(--color-primary-200)";
const MEDIAN = "var(--color-primary-400)";
const INK = "var(--color-neutral-800)";
const GRID = "var(--color-neutral-200)";
const AXIS_TEXT = "var(--color-neutral-500)";
const SURFACE = "var(--color-surface)";

const GUTTER = { bottom: 30, right: 22, top: 18 };
const AXIS_CHAR_WIDTH = 7;
const TYPICAL_LEFT_GUTTER = 46;
const HIT = 44;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 320;
const FALLBACK_WIDTH = 320;

const px = (n: number) => Math.round(n * 100) / 100;
const moveTo = ([x, y]: Pt) => `M${px(x)},${px(y)}`;
const lineTo = ([x, y]: Pt) => `L${px(x)},${px(y)}`;

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

interface Placed {
  point: GrowthPoint;
  x: number;
  y: number;
}

interface Layout {
  height: number;
  plot: { bottom: number; left: number; right: number; top: number };
  xAxis: Axis;
  yAxis: Axis;
  toX: (ageDays: number) => number;
  toY: (value: number) => number;
  bandPath: string | null;
  medianPath: string | null;
  placed: Placed[];
}

function layoutChart({
  width,
  points,
  reference,
  currentAgeDays,
  unit,
}: {
  currentAgeDays: number;
  points: GrowthPoint[];
  reference: PercentilePoint[] | null;
  unit: { label: string; size: number };
  width: number;
}): Layout {
  const height = Math.round(
    Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, width * 0.66))
  );
  const bottom = height - GUTTER.bottom;
  const plotHeight = bottom - GUTTER.top;

  const latestAge = points.at(-1)?.ageDays ?? currentAgeDays;
  const roomForAges = width - TYPICAL_LEFT_GUTTER - GUTTER.right;
  const xAxis = ageAxis(latestAge, Math.floor(roomForAges / 62) + 1);
  const band = reference ? bandSamples(reference, xAxis.max) : [];

  const values = points.map((p) => p.value);
  let low = Math.min(...values, ...band.map((s) => s.low));
  let high = Math.max(...values, ...band.map((s) => s.high));
  if (band.length === 0) {
    const air = (high - low) * 0.15 || high * 0.1;
    low -= air;
    high += air;
  }
  const yAxis = valueAxis(low, high, unit, Math.floor(plotHeight / 44) + 1);

  const topLabel = `${yAxis.ticks.at(-1)?.label ?? ""} ${yAxis.unit ?? ""}`;
  const left = Math.round(topLabel.length * AXIS_CHAR_WIDTH + 12);
  const plot = {
    bottom,
    left,
    right: Math.max(left + 1, width - GUTTER.right),
    top: GUTTER.top,
  };
  const plotWidth = plot.right - plot.left;

  const toX = (ageDays: number) =>
    plot.left + ((ageDays - xAxis.min) / (xAxis.max - xAxis.min)) * plotWidth;
  const toY = (value: number) =>
    plot.bottom - ((value - yAxis.min) / (yAxis.max - yAxis.min)) * plotHeight;

  let bandPath: string | null = null;
  let medianPath: string | null = null;
  if (band.length > 1) {
    const upper = band.map((s): Pt => [toX(s.ageDays), toY(s.high)]);
    const lower = band
      .map((s): Pt => [toX(s.ageDays), toY(s.low)])
      .toReversed();
    const median = band.map((s): Pt => [toX(s.ageDays), toY(s.median)]);
    bandPath = `${moveTo(upper[0])} ${smoothSegments(upper)} ${lineTo(lower[0])} ${smoothSegments(lower)} Z`;
    medianPath = `${moveTo(median[0])} ${smoothSegments(median)}`;
  }

  return {
    bandPath,
    height,
    medianPath,
    placed: points.map((point) => ({
      point,
      x: toX(point.ageDays),
      y: toY(point.value),
    })),
    plot,
    toX,
    toY,
    xAxis,
    yAxis,
  };
}

function placeLabel(at: Placed, plot: Layout["plot"]) {
  let anchor: "start" | "middle" | "end" = "middle";
  let dx = 0;
  if (plot.right - at.x < 36) {
    anchor = "end";
    dx = 8;
  } else if (at.x - plot.left < 36) {
    anchor = "start";
    dx = -8;
  }
  const above = at.y - plot.top > 30;
  return { anchor, x: at.x + dx, y: above ? at.y - 18 : at.y + 29 };
}

const Axes = ({ layout }: { layout: Layout }) => {
  const { plot, xAxis, yAxis, toX, toY } = layout;
  const topTick = yAxis.ticks.at(-1);
  return (
    <>
      {yAxis.ticks.map((tick) => {
        const y = Math.round(toY(tick.value)) + 0.5;
        return (
          <g key={tick.value}>
            <line
              stroke={GRID}
              strokeWidth={1}
              x1={plot.left}
              x2={plot.right}
              y1={y}
              y2={y}
            />
            <text
              dominantBaseline="middle"
              fill={AXIS_TEXT}
              fontSize={12}
              textAnchor="end"
              x={plot.left - 8}
              y={y}
            >
              {tick === topTick && yAxis.unit
                ? `${tick.label} ${yAxis.unit}`
                : tick.label}
            </text>
          </g>
        );
      })}
      {xAxis.ticks.map((tick) => {
        const x = Math.round(toX(tick.value)) + 0.5;
        return (
          <g key={tick.value}>
            <line
              stroke={GRID}
              strokeWidth={1}
              x1={x}
              x2={x}
              y1={plot.bottom}
              y2={plot.bottom + 5}
            />
            <text
              fill={AXIS_TEXT}
              fontSize={12}
              textAnchor="middle"
              x={x}
              y={plot.bottom + 21}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </>
  );
};

const BabySeries = ({
  placed,
  selected,
  valueLabel,
  plot,
}: {
  placed: Placed[];
  plot: Layout["plot"];
  selected: Placed | null;
  valueLabel: string | null;
}) => {
  const label = selected ? placeLabel(selected, plot) : null;
  return (
    <>
      {placed.length > 1 && (
        <polyline
          fill="none"
          points={placed.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")}
          stroke={INK}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.25}
        />
      )}
      {placed.map((p) =>
        p === selected ? (
          <circle
            cx={px(p.x)}
            cy={px(p.y)}
            fill={SURFACE}
            key={p.point.id}
            r={5.5}
            stroke={INK}
            strokeWidth={3}
          />
        ) : (
          <circle
            cx={px(p.x)}
            cy={px(p.y)}
            fill={INK}
            key={p.point.id}
            r={4}
            stroke={SURFACE}
            strokeWidth={1.5}
          />
        )
      )}
      {label && valueLabel && (
        <text
          className="tabular-nums"
          fill={INK}
          fontSize={13}
          fontWeight={600}
          paintOrder="stroke"
          stroke={SURFACE}
          strokeLinejoin="round"
          strokeWidth={4}
          textAnchor={label.anchor}
          x={px(label.x)}
          y={px(label.y)}
        >
          {valueLabel}
        </text>
      )}
    </>
  );
};

const PointButton = ({
  at,
  left,
  right,
  height,
  label,
  selected,
  onSelect,
  onStep,
  register,
}: {
  at: Placed;
  height: number;
  label: string;
  left: number;
  onSelect: (id: string) => void;
  onStep: (from: string, delta: number) => void;
  register: (id: string, el: HTMLButtonElement | null) => void;
  right: number;
  selected: boolean;
}) => {
  const { id } = at.point;
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      onStep(id, e.key === "ArrowLeft" ? -1 : 1);
    },
    [onStep, id]
  );
  const handleRef = useCallback(
    (el: HTMLButtonElement | null) => register(id, el),
    [register, id]
  );

  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className="group absolute top-0 cursor-pointer outline-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={handleRef}
      style={{ height, left, width: Math.max(0, right - left) }}
      tabIndex={selected ? 0 : -1}
      type="button"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-6 w-6 rounded-full group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary-ink"
        style={{ left: at.x - left - 12, top: at.y - 12 }}
      />
    </button>
  );
};

export interface GrowthChartProps {
  title: string;
  description: string;
  metric: MetricConfig;
  imperial: boolean;
  points: GrowthPoint[];
  reference: PercentilePoint[] | null;
  currentAgeDays: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const GrowthChart = ({
  title,
  description,
  metric,
  imperial,
  points,
  reference,
  currentAgeDays,
  selectedId,
  onSelect,
}: GrowthChartProps) => {
  const { ref, width } = useElementWidth();
  const titleId = useId();
  const descId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const layout = layoutChart({
    currentAgeDays,
    points,
    reference,
    unit: metric.axisUnit(imperial),
    width: width || FALLBACK_WIDTH,
  });
  const { placed, plot, height } = layout;
  const selected =
    placed.find((p) => p.point.id === selectedId) ?? placed.at(-1) ?? null;

  const register = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(id, el);
    else buttons.current.delete(id);
  }, []);

  const handleStep = useCallback(
    (from: string, delta: number) => {
      const next = points[points.findIndex((p) => p.id === from) + delta];
      if (!next) return;
      onSelect(next.id);
      buttons.current.get(next.id)?.focus();
    },
    [points, onSelect]
  );

  return (
    <div className="relative w-full" ref={ref} style={{ height }}>
      {width > 0 && (
        <>
          <svg
            aria-describedby={descId}
            aria-labelledby={titleId}
            className="block select-none"
            height={height}
            role="img"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            <title id={titleId}>{title}</title>
            <desc id={descId}>{description}</desc>
            <Axes layout={layout} />
            {layout.bandPath && (
              <path d={layout.bandPath} fill={BAND} fillOpacity={0.6} />
            )}
            {layout.medianPath && (
              <path
                d={layout.medianPath}
                fill="none"
                stroke={MEDIAN}
                strokeLinecap="round"
                strokeWidth={1.25}
              />
            )}
            <BabySeries
              placed={placed}
              plot={plot}
              selected={selected}
              valueLabel={
                selected ? metric.format(selected.point.value, imperial) : null
              }
            />
          </svg>

          {placed.map((p, i) => {
            const prev = placed[i - 1];
            const next = placed[i + 1];
            return (
              <PointButton
                at={p}
                height={plot.bottom}
                key={p.point.id}
                label={`${formatDay(p.point.day)}, ${formatAge(p.point.ageDays)}: ${metric.format(p.point.value, imperial)}`}
                left={prev ? (prev.x + p.x) / 2 : Math.max(0, p.x - HIT / 2)}
                onSelect={onSelect}
                onStep={handleStep}
                register={register}
                right={
                  next ? (p.x + next.x) / 2 : Math.min(width, p.x + HIT / 2)
                }
                selected={p === selected}
              />
            );
          })}
        </>
      )}
    </div>
  );
};
