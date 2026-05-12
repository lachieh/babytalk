"use client";

import { useCallback, useMemo } from "react";
import {
  CartesianGrid,
  Customized,
  ResponsiveContainer,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";

import type { BabyEvent } from "@/lib/baby-context";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const Y_TICKS = [0, 4, 8, 12, 16, 20, 24];

const COLORS: Record<string, { fill: string; stroke: string; dot: string }> = {
  feed: {
    fill: "var(--color-feed-200)",
    stroke: "var(--color-feed-500)",
    dot: "var(--color-feed-500)",
  },
  sleep: {
    fill: "var(--color-sleep-200)",
    stroke: "var(--color-sleep-500)",
    dot: "var(--color-sleep-500)",
  },
  diaper: {
    fill: "var(--color-diaper-200)",
    stroke: "var(--color-diaper-500)",
    dot: "var(--color-diaper-500)",
  },
  pump: {
    fill: "var(--color-pump-200)",
    stroke: "var(--color-pump-500)",
    dot: "var(--color-pump-500)",
  },
  note: {
    fill: "var(--color-note-200)",
    stroke: "var(--color-note-500)",
    dot: "var(--color-note-500)",
  },
};

const INSTANT_TYPES = new Set(["diaper"]);

export function getWeekStart(reference: Date): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function hoursOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function dayIndex(d: Date, weekStart: Date): number {
  const ms = d.getTime() - weekStart.getTime();
  return Math.floor(ms / 86_400_000);
}

function formatHour(h: number): string {
  const v = Math.round(h);
  if (v === 0 || v === 24) return "12a";
  if (v === 12) return "12p";
  if (v < 12) return `${v}a`;
  return `${v - 12}p`;
}

interface EventBlock {
  event: BabyEvent;
  dayIdx: number;
  startHour: number;
  endHour: number;
  isInstant: boolean;
}

function buildBlocks(events: BabyEvent[], weekStart: Date): EventBlock[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const now = Date.now();

  const blocks: EventBlock[] = [];
  for (const event of events) {
    const start = new Date(event.startedAt);
    if (start >= weekEnd) continue;

    const isInstant =
      INSTANT_TYPES.has(event.type) ||
      (event.endedAt !== null && event.startedAt === event.endedAt);

    if (isInstant) {
      if (start < weekStart) continue;
      blocks.push({
        dayIdx: dayIndex(start, weekStart),
        endHour: hoursOf(start),
        event,
        isInstant: true,
        startHour: hoursOf(start),
      });
      continue;
    }

    const endTs = event.endedAt ? new Date(event.endedAt).getTime() : now;
    const end = new Date(endTs);
    if (end <= weekStart) continue;

    const clampedStart = start < weekStart ? new Date(weekStart) : start;
    const clampedEnd = end > weekEnd ? new Date(weekEnd) : end;

    let cursor = clampedStart;
    while (cursor < clampedEnd) {
      const dIdx = dayIndex(cursor, weekStart);
      const dayEnd = new Date(weekStart);
      dayEnd.setDate(dayEnd.getDate() + dIdx + 1);
      const segmentEnd = clampedEnd < dayEnd ? clampedEnd : dayEnd;
      const startHour = hoursOf(cursor);
      const endHour =
        segmentEnd.getTime() === dayEnd.getTime() ? 24 : hoursOf(segmentEnd);

      blocks.push({
        dayIdx: dIdx,
        endHour,
        event,
        isInstant: false,
        startHour,
      });

      cursor = dayEnd;
    }
  }
  return blocks;
}

interface ChartScalesProps {
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
}

function pickFirst<T>(map: Record<string, T> | undefined): T | null {
  if (!map) return null;
  const values = Object.values(map);
  return values.length > 0 ? values[0] : null;
}

const EventLayer = ({
  blocks,
  onTap,
  chartProps,
}: {
  blocks: EventBlock[];
  onTap?: (e: BabyEvent) => void;
  chartProps: ChartScalesProps;
}) => {
  const xAxis = pickFirst(chartProps.xAxisMap);
  const yAxis = pickFirst(chartProps.yAxisMap);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      if (!onTap) return;
      const target = (e.target as Element).closest<HTMLElement>(
        "[data-event-id]"
      );
      const id = target?.dataset.eventId;
      if (!id) return;
      const block = blocks.find((b) => b.event.id === id);
      if (block) onTap(block.event);
    },
    [blocks, onTap]
  );

  if (!(xAxis && yAxis)) return null;

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const colWidth = Math.max(Math.abs(xScale(1) - xScale(0)) * 0.78, 6);
  const cursor = onTap ? "pointer" : undefined;

  return (
    <g onClick={handleClick}>
      {blocks.map((b) => {
        const colors = COLORS[b.event.type] ?? COLORS.note;
        const cx = xScale(b.dayIdx);
        const blockKey = `${b.event.id}-${b.dayIdx}`;

        if (b.isInstant) {
          const cy = yScale(b.startHour);
          return (
            <circle
              cx={cx}
              cy={cy}
              data-event-id={b.event.id}
              fill={colors.dot}
              key={blockKey}
              r={3}
              style={{ cursor }}
            />
          );
        }

        const y1 = yScale(b.startHour);
        const y2 = yScale(b.endHour);
        const top = Math.min(y1, y2);
        const height = Math.max(Math.abs(y2 - y1), 3);

        return (
          <rect
            data-event-id={b.event.id}
            fill={colors.fill}
            height={height}
            key={blockKey}
            rx={2}
            stroke={colors.stroke}
            strokeWidth={1}
            style={{ cursor }}
            width={colWidth}
            x={cx - colWidth / 2}
            y={top}
          />
        );
      })}
    </g>
  );
};

const NowMarker = ({
  weekStart,
  chartProps,
}: {
  weekStart: Date;
  chartProps: ChartScalesProps;
}) => {
  const xAxis = pickFirst(chartProps.xAxisMap);
  const yAxis = pickFirst(chartProps.yAxisMap);
  if (!(xAxis && yAxis)) return null;

  const now = new Date();
  const dIdx = dayIndex(now, weekStart);
  if (dIdx < 0 || dIdx > 6) return null;

  const cx = xAxis.scale(dIdx);
  const cy = yAxis.scale(hoursOf(now));
  const colWidth = Math.max(
    Math.abs(xAxis.scale(1) - xAxis.scale(0)) * 0.78,
    6
  );

  return (
    <g>
      <line
        stroke="var(--color-primary-500)"
        strokeWidth={1.5}
        x1={cx - colWidth / 2}
        x2={cx + colWidth / 2}
        y1={cy}
        y2={cy}
      />
      <circle
        cx={cx - colWidth / 2}
        cy={cy}
        fill="var(--color-primary-500)"
        r={2.5}
      />
    </g>
  );
};

export const WeekChart = ({
  events,
  onTapEvent,
  weekStart: weekStartProp,
}: {
  events: BabyEvent[];
  onTapEvent?: (e: BabyEvent) => void;
  weekStart?: Date;
}) => {
  const weekStart = useMemo(
    () =>
      weekStartProp ? getWeekStart(weekStartProp) : getWeekStart(new Date()),
    [weekStartProp]
  );
  const blocks = useMemo(
    () => buildBlocks(events, weekStart),
    [events, weekStart]
  );

  const todayIdx = useMemo(() => dayIndex(new Date(), weekStart), [weekStart]);

  const renderEventLayer = useCallback(
    (chartProps: ChartScalesProps) => (
      <EventLayer blocks={blocks} chartProps={chartProps} onTap={onTapEvent} />
    ),
    [blocks, onTapEvent]
  );

  const renderNowMarker = useCallback(
    (chartProps: ChartScalesProps) => (
      <NowMarker chartProps={chartProps} weekStart={weekStart} />
    ),
    [weekStart]
  );

  const renderXTick = useCallback(
    ({
      x,
      y,
      payload,
    }: {
      x: number;
      y: number;
      payload: { value: number };
    }) => {
      const i = payload.value;
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const isToday = i === todayIdx;
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            dy={10}
            fill={
              isToday ? "var(--color-primary-600)" : "var(--color-neutral-400)"
            }
            fontSize={10}
            fontWeight={isToday ? 600 : 500}
            textAnchor="middle"
          >
            {DAY_LABELS[i]}
          </text>
          <text
            dy={22}
            fill={
              isToday ? "var(--color-primary-600)" : "var(--color-neutral-500)"
            }
            fontSize={11}
            fontWeight={isToday ? 700 : 500}
            textAnchor="middle"
          >
            {date.getDate()}
          </text>
        </g>
      );
    },
    [weekStart, todayIdx]
  );

  return (
    <ResponsiveContainer height="100%" width="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
        <CartesianGrid
          stroke="var(--color-neutral-100)"
          strokeDasharray="0"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey="dayIdx"
          domain={[-0.5, 6.5]}
          interval={0}
          tick={renderXTick}
          tickLine={false}
          ticks={[0, 1, 2, 3, 4, 5, 6]}
          type="number"
          xAxisId={0}
        />
        <YAxis
          axisLine={false}
          domain={[0, 24]}
          reversed
          tick={{ fontSize: 10, fill: "var(--color-neutral-400)" }}
          tickFormatter={formatHour}
          tickLine={false}
          ticks={Y_TICKS}
          type="number"
          width={28}
          yAxisId={0}
        />
        <Customized component={renderEventLayer} />
        <Customized component={renderNowMarker} />
      </ScatterChart>
    </ResponsiveContainer>
  );
};
