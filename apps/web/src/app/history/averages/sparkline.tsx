import { useId } from "react";

const WIDTH = 120;
const HEIGHT = 44;
const PAD_X = 7;
const PAD_Y = 8;
const BASELINE = HEIGHT - 2;

interface Point {
  x: number;
  y: number;
}

export interface SparklineTone {
  area: string;
  line: string;
}

const round = (value: number): number => Math.round(value * 100) / 100;

function curveThrough(points: Point[]): string {
  const [first] = points;
  if (!first) return "";
  let path = `M${round(first.x)} ${round(first.y)}`;
  const slopes: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] as Point;
    const to = points[index + 1] as Point;
    slopes.push((to.y - from.y) / (to.x - from.x));
  }
  const tangentAt = (index: number): number => {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    if (before * after <= 0) return 0;
    return (2 * before * after) / (before + after);
  };
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] as Point;
    const to = points[index + 1] as Point;
    const third = (to.x - from.x) / 3;
    path += ` C${round(from.x + third)} ${round(from.y + tangentAt(index) * third)} ${round(to.x - third)} ${round(to.y - tangentAt(index + 1) * third)} ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}

function runsOf(points: (Point | null)[]): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of points) {
    if (point) {
      run.push(point);
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

function layout(values: (number | null)[]): (Point | null)[] {
  const known = values.filter((value): value is number => value !== null);
  const highest = Math.max(...known);
  const lowest = Math.min(...known, highest / 2);
  const span = highest - lowest || 1;
  const step =
    values.length > 1 ? (WIDTH - PAD_X * 2) / (values.length - 1) : 0;
  return values.map((value, index) =>
    value === null
      ? null
      : {
          x: values.length > 1 ? PAD_X + index * step : WIDTH - PAD_X,
          y: PAD_Y + (1 - (value - lowest) / span) * (HEIGHT - PAD_Y * 2),
        }
  );
}

const Mark = ({
  className,
  point,
  size,
}: {
  className: string;
  point: Point;
  size: number;
}) => (
  <line
    className={className}
    fill="none"
    strokeLinecap="round"
    strokeWidth={size}
    vectorEffect="non-scaling-stroke"
    x1={point.x}
    x2={point.x + 0.01}
    y1={point.y}
    y2={point.y}
  />
);

export const Sparkline = ({
  className = "",
  label,
  tone,
  values,
}: {
  className?: string;
  label: string;
  tone: SparklineTone;
  values: (number | null)[];
}) => {
  const points = layout(values);
  const runs = runsOf(points);
  const newest = points.at(-1) ?? null;
  const washId = useId();

  return (
    <svg
      aria-label={label}
      className={`shrink-0 overflow-visible ${className}`}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <defs>
        <linearGradient id={washId} x1="0" x2="0" y1="0" y2="1">
          <stop className={tone.area} offset="0" stopColor="currentColor" />
          <stop
            className={tone.area}
            offset="1"
            stopColor="currentColor"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      {runs.map((run) => {
        const start = run[0] as Point;
        const end = run.at(-1) as Point;
        const key = `${start.x}-${end.x}`;
        if (run.length === 1) {
          return start === newest ? null : (
            <Mark className={tone.line} key={key} point={start} size={4} />
          );
        }
        const curve = curveThrough(run);
        return (
          <g key={key}>
            <path
              d={`${curve} L${round(end.x)} ${BASELINE} L${round(start.x)} ${BASELINE} Z`}
              fill={`url(#${washId})`}
              stroke="none"
            />
            <path
              className={tone.line}
              d={curve}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {newest ? (
        <>
          <Mark className="stroke-surface" point={newest} size={11} />
          <Mark className={tone.line} point={newest} size={7} />
        </>
      ) : null}
    </svg>
  );
};
