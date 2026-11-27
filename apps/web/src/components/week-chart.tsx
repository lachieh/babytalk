"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  buildWeekMarks,
  describeDay,
  formatSpan,
  getWeekStart,
  summarizeWeek,
  wallClockHours,
  weekDayIndex,
  weekDayStart,
} from "@/app/history/week/week-data";
import type { WeekDaySummary, WeekMark } from "@/app/history/week/week-data";
import type { BabyEvent } from "@/lib/baby-context";
import { EVENT_TYPE_LABELS } from "@/lib/event-meta";
import type { EventType } from "@/lib/event-styles";
import { formatEventParts } from "@/lib/format-event";

function markType(type: string): EventType {
  return type in EVENT_TYPE_LABELS ? (type as EventType) : "note";
}

const INK: Record<EventType, string> = {
  diaper: "var(--color-diaper-500)",
  feed: "var(--color-feed-500)",
  note: "var(--color-neutral-500)",
  pump: "var(--color-pump-500)",
  sleep:
    "color-mix(in oklab, var(--color-sleep-500) 80%, var(--color-surface))",
};
const NOW_INK =
  "color-mix(in oklab, var(--color-primary-500) 75%, var(--color-neutral-950))";
const TODAY_PEBBLE = { backgroundColor: NOW_INK };
const LABEL_INK = "var(--color-neutral-500)";
const NIGHT_FILL = "var(--color-surface-sunken)";
const GRID_INK = "var(--color-neutral-200)";
const RING_INK = "var(--color-neutral-800)";

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];
const NIGHT_END_HOUR = 7;
const NIGHT_START_HOUR = 20;
const HOUR_TICKS = [
  { hour: 0, label: "12am" },
  { hour: 6, label: "6am" },
  { hour: 12, label: "12pm" },
  { hour: 18, label: "6pm" },
];

const GUTTER = 40;
const PLOT_PAD = 10;
const PLOT_INSET_X = 8;
const COLUMNS_LEFT = GUTTER + PLOT_INSET_X;
const HIT_RADIUS = 22;
const COLUMN_GAP = 2;
const BLOCK_SHARE = 0.8;
const BLOCK_RADIUS = 2;
const BLOCK_MIN_HEIGHT = 3;
const MINUTE = 60_000;

interface Geometry {
  blockWidth: number;
  bottom: number;
  colWidth: number;
  height: number;
  markSize: number;
  top: number;
  width: number;
}

interface Box {
  cx: number;
  h: number;
  w: number;
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const n = (value: number) => Math.round(value * 10) / 10;

function makeGeometry(width: number, height: number): Geometry {
  const colWidth = Math.max(0, width - COLUMNS_LEFT - PLOT_INSET_X) / 7;
  return {
    blockWidth: Math.max(0, colWidth - COLUMN_GAP * 2) * BLOCK_SHARE,
    bottom: height - PLOT_PAD,
    colWidth,
    height,
    markSize: clamp(colWidth * 0.16, 6.5, 8.5),
    top: PLOT_PAD,
    width,
  };
}

const yOf = (g: Geometry, hour: number) =>
  g.top + (hour / 24) * (g.bottom - g.top);
const colX = (g: Geometry, dayIdx: number) =>
  COLUMNS_LEFT + g.colWidth * dayIdx;

const isBlock = (type: EventType) =>
  type === "sleep" || type === "feed" || type === "pump";

function blockLeft(g: Geometry, mark: WeekMark): number {
  const left = colX(g, mark.dayIdx) + COLUMN_GAP;
  return markType(mark.event.type) === "sleep"
    ? left
    : left + g.colWidth - COLUMN_GAP * 2 - g.blockWidth;
}

function markBox(g: Geometry, mark: WeekMark): Box {
  const block = isBlock(markType(mark.event.type));
  const w = block ? g.blockWidth : g.markSize;
  const x = block
    ? blockLeft(g, mark)
    : colX(g, mark.dayIdx) + g.colWidth / 2 - w / 2;
  const cx = x + w / 2;
  const y1 = yOf(g, mark.startHour);
  const y2 = yOf(g, mark.endHour);
  const h = Math.max(y2 - y1, block ? BLOCK_MIN_HEIGHT : g.markSize);
  const pinnedTop = mark.continuesBefore || mark.openEnd;
  const grownY = pinnedTop ? y1 : (y1 + y2) / 2 - h / 2;
  const y = mark.continuesAfter ? y2 - h : clamp(grownY, g.top, g.bottom - h);
  return { cx, h, w, x, y };
}

function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  topRadius: number,
  bottomRadius: number
): string {
  const rt = Math.min(topRadius, w / 2, h / 2);
  const rb = Math.min(bottomRadius, w / 2, h / 2);
  return [
    `M${n(x)},${n(y + rt)}`,
    `A${n(rt)},${n(rt)} 0 0 1 ${n(x + rt)},${n(y)}`,
    `H${n(x + w - rt)}`,
    `A${n(rt)},${n(rt)} 0 0 1 ${n(x + w)},${n(y + rt)}`,
    `V${n(y + h - rb)}`,
    `A${n(rb)},${n(rb)} 0 0 1 ${n(x + w - rb)},${n(y + h)}`,
    `H${n(x + rb)}`,
    `A${n(rb)},${n(rb)} 0 0 1 ${n(x)},${n(y + h - rb)}`,
    "Z",
  ].join(" ");
}

function diamondPath(cx: number, cy: number, r: number): string {
  return `M${n(cx)},${n(cy - r)} L${n(cx + r)},${n(cy)} L${n(cx)},${n(cy + r)} L${n(cx - r)},${n(cy)} Z`;
}

function distanceToBox(box: Box, px: number, py: number): number {
  const dx = Math.max(box.x - px, 0, px - (box.x + box.w));
  const dy = Math.max(box.y - py, 0, py - (box.y + box.h));
  return Math.hypot(dx, dy);
}

function nearestMark(
  g: Geometry,
  marks: WeekMark[],
  px: number,
  py: number
): WeekMark | null {
  let best: WeekMark | null = null;
  let bestDistance = HIT_RADIUS;
  for (const mark of marks) {
    const distance = distanceToBox(markBox(g, mark), px, py);
    if (distance < bestDistance) {
      best = mark;
      bestDistance = distance;
    }
  }
  return best;
}

const timeOf = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const shortWeekday = (date: Date) =>
  date.toLocaleDateString([], { weekday: "short" });
const mediumDay = (date: Date) =>
  date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
const longDay = (date: Date) =>
  date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
  });

interface ReadoutText {
  detail: string;
  title: string;
  type: EventType | null;
}

function whatLine(label: string, detail: string | null): string {
  const useful =
    detail &&
    detail !== "started" &&
    detail.toLowerCase() !== label.toLowerCase();
  return useful ? `${label} · ${detail}` : label;
}

function eventReadout(
  event: BabyEvent,
  running: boolean,
  now: number
): ReadoutText {
  const type = markType(event.type);
  const parts = formatEventParts(event);
  const label =
    event.type in EVENT_TYPE_LABELS ? EVENT_TYPE_LABELS[type] : parts.label;
  const start = new Date(event.startedAt);
  const startText = `${shortWeekday(start)} ${timeOf(start)}`;

  if (running) {
    return {
      detail: `Since ${startText}, ${formatSpan(now - start.getTime())} so far`,
      title: `${label} · in progress`,
      type,
    };
  }

  const end = event.endedAt ? new Date(event.endedAt) : null;
  if (!end || end.getTime() <= start.getTime() || type === "diaper") {
    return { detail: startText, title: whatLine(label, parts.detail), type };
  }

  const sameDay = weekDayIndex(end, start) === 0;
  const endText = sameDay ? timeOf(end) : `${shortWeekday(end)} ${timeOf(end)}`;
  return {
    detail: `${startText} – ${endText}`,
    title: whatLine(
      label,
      parts.detail ?? formatSpan(end.getTime() - start.getTime())
    ),
    type,
  };
}

interface Size {
  height: number;
  width: number;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { height, width }
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function useNow(fixed: Date | undefined): number {
  const [ticking, setTicking] = useState(() => Date.now());

  useEffect(() => {
    if (fixed) return;
    const timer = setInterval(() => setTicking(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, [fixed]);

  return fixed ? fixed.getTime() : ticking;
}

const MarkShape = ({
  box,
  fadeId,
  mark,
}: {
  box: Box;
  fadeId: string | null;
  mark: WeekMark;
}) => {
  const type = markType(mark.event.type);
  const ink = INK[type];
  const paint = fadeId ? `url(#${fadeId})` : ink;
  const opacity = mark.running ? 0.6 : undefined;
  const cy = box.y + box.h / 2;

  if (type === "diaper") {
    return (
      <path
        d={diamondPath(box.cx, cy, box.w / 2 - 0.5)}
        fill={ink}
        stroke={ink}
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    );
  }

  if (type === "note") {
    return (
      <line
        stroke={ink}
        strokeLinecap="round"
        strokeWidth={2.5}
        x1={n(box.cx - box.w / 2 + 1.5)}
        x2={n(box.cx + box.w / 2 - 1.5)}
        y1={n(cy)}
        y2={n(cy)}
      />
    );
  }

  const full = BLOCK_RADIUS;
  const top = mark.continuesBefore ? 0 : full;
  const bottom = mark.continuesAfter || mark.openEnd ? 0 : full;

  if (type === "pump") {
    const inset = 0.9;
    return (
      <path
        d={barPath(
          box.x + inset,
          box.y + inset,
          box.w - inset * 2,
          box.h - inset * 2,
          top,
          bottom
        )}
        fill="none"
        opacity={opacity}
        stroke={paint}
        strokeWidth={1.8}
      />
    );
  }

  return (
    <path
      d={barPath(box.x, box.y, box.w, box.h, top, bottom)}
      fill={paint}
      opacity={opacity}
    />
  );
};

const OpenEndFade = ({
  box,
  id,
  ink,
}: {
  box: Box;
  id: string;
  ink: string;
}) => {
  const solidUntil = clamp(1 - 16 / box.h, 0, 0.7);
  const stopStyle = useMemo(() => ({ stopColor: ink }), [ink]);
  return (
    <linearGradient
      gradientUnits="userSpaceOnUse"
      id={id}
      x1={0}
      x2={0}
      y1={n(box.y)}
      y2={n(box.y + box.h)}
    >
      <stop offset={0} stopOpacity={1} style={stopStyle} />
      <stop offset={solidUntil} stopOpacity={1} style={stopStyle} />
      <stop offset={1} stopOpacity={0.12} style={stopStyle} />
    </linearGradient>
  );
};

const SelectionRing = ({ box, mark }: { box: Box; mark: WeekMark }) => (
  <rect
    fill="none"
    height={n(box.h + 6)}
    rx={
      isBlock(markType(mark.event.type))
        ? BLOCK_RADIUS + 3
        : n(Math.min((box.w + 6) / 2, (box.h + 6) / 2))
    }
    stroke={RING_INK}
    strokeWidth={1.5}
    width={n(box.w + 6)}
    x={n(box.x - 3)}
    y={n(box.y - 3)}
  />
);

interface Drawn {
  box: Box;
  fadeId: string | null;
  mark: WeekMark;
}

const PAINT_ORDER: Record<EventType, number> = {
  diaper: 2,
  feed: 1,
  note: 2,
  pump: 1,
  sleep: 0,
};
const byPaintOrder = (a: Drawn, b: Drawn) =>
  PAINT_ORDER[markType(a.mark.event.type)] -
  PAINT_ORDER[markType(b.mark.event.type)];

const nowLabelInGutter = (dayIdx: number) => dayIdx >= 6;

const NowMarker = ({
  g,
  dayIdx,
  hour,
}: {
  g: Geometry;
  dayIdx: number;
  hour: number;
}) => {
  const y = n(yOf(g, hour));
  const left = colX(g, dayIdx) + 3;
  const right = colX(g, dayIdx + 1) - 3;
  const inGutter = nowLabelInGutter(dayIdx);
  return (
    <g>
      <line
        stroke={NOW_INK}
        strokeLinecap="round"
        strokeWidth={2}
        x1={n(left)}
        x2={n(right)}
        y1={y}
        y2={y}
      />
      <text
        dominantBaseline="central"
        fill={NOW_INK}
        fontSize={12}
        fontWeight={600}
        textAnchor={inGutter ? "end" : "start"}
        x={inGutter ? GUTTER - 8 : n(right + 7)}
        y={y}
      >
        now
      </text>
    </g>
  );
};

const PlotBackdrop = ({
  g,
  gutterNowHour,
  selectedDay,
  showGrid,
}: {
  g: Geometry;
  gutterNowHour: number | null;
  selectedDay: number | null;
  showGrid: boolean;
}) => {
  const nowY = gutterNowHour === null ? null : yOf(g, gutterNowHour);
  const plotWidth = g.width - GUTTER;
  const morningY = yOf(g, NIGHT_END_HOUR);
  const eveningY = yOf(g, NIGHT_START_HOUR);
  return (
    <g>
      <path
        d={barPath(GUTTER, g.top, plotWidth, morningY - g.top, 14, 0)}
        fill={NIGHT_FILL}
      />
      <path
        d={barPath(GUTTER, eveningY, plotWidth, g.bottom - eveningY, 0, 14)}
        fill={NIGHT_FILL}
      />
      {selectedDay !== null && (
        <rect
          fill="var(--color-neutral-500)"
          fillOpacity={0.12}
          height={n(g.bottom - g.top)}
          rx={12}
          width={n(g.colWidth - 2)}
          x={n(colX(g, selectedDay) + 1)}
          y={g.top}
        />
      )}
      {HOUR_TICKS.map((tick) => {
        const y = yOf(g, tick.hour);
        const hidden = nowY !== null && Math.abs(nowY - y) < 15;
        return (
          <g key={tick.hour}>
            {showGrid && tick.hour > 0 && (
              <line
                stroke={GRID_INK}
                strokeWidth={1}
                x1={GUTTER}
                x2={g.width}
                y1={Math.round(y) + 0.5}
                y2={Math.round(y) + 0.5}
              />
            )}
            {!hidden && (
              <text
                dominantBaseline="central"
                fill={LABEL_INK}
                fontSize={12}
                textAnchor="end"
                x={GUTTER - 8}
                y={n(y)}
              >
                {tick.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

const Plot = ({
  g,
  drawn,
  now,
  onPick,
  selectedDay,
  selectedEventId,
  todayIdx,
}: {
  g: Geometry;
  drawn: Drawn[];
  now: number;
  onPick: (mark: WeekMark | null, dayIdx: number | null) => void;
  selectedDay: number | null;
  selectedEventId: string | null;
  todayIdx: number;
}) => {
  const isEmpty = drawn.length === 0;
  const showNow = !isEmpty && todayIdx >= 0 && todayIdx <= 6;
  const nowHour = showNow ? wallClockHours(new Date(now)) : null;

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (px < GUTTER) return;
      const mark = nearestMark(
        g,
        drawn.map((item) => item.mark),
        px,
        py
      );
      const dayIdx = clamp(Math.floor((px - COLUMNS_LEFT) / g.colWidth), 0, 6);
      onPick(mark, mark ? null : dayIdx);
    },
    [drawn, g, onPick]
  );

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 block cursor-pointer touch-manipulation select-none"
      height={g.height}
      onClick={handleClick}
      width={g.width}
    >
      <defs>
        {drawn.map(
          (item) =>
            item.fadeId && (
              <OpenEndFade
                box={item.box}
                id={item.fadeId}
                ink={INK[markType(item.mark.event.type)]}
                key={item.mark.id}
              />
            )
        )}
      </defs>
      <PlotBackdrop
        g={g}
        gutterNowHour={nowLabelInGutter(todayIdx) ? nowHour : null}
        selectedDay={selectedDay}
        showGrid={!isEmpty}
      />
      {drawn.toSorted(byPaintOrder).map((item) => (
        <MarkShape
          box={item.box}
          fadeId={item.fadeId}
          key={item.mark.id}
          mark={item.mark}
        />
      ))}
      {nowHour !== null && <NowMarker dayIdx={todayIdx} g={g} hour={nowHour} />}
      {drawn.map(
        (item) =>
          item.mark.event.id === selectedEventId && (
            <SelectionRing box={item.box} key={item.mark.id} mark={item.mark} />
          )
      )}
    </svg>
  );
};

const LEGEND_BOX: Record<EventType, Box> = {
  diaper: { cx: 8, h: 8, w: 8, x: 4, y: 4 },
  feed: { cx: 8, h: 14, w: 10, x: 3, y: 1 },
  note: { cx: 8, h: 8, w: 8, x: 4, y: 4 },
  pump: { cx: 8, h: 14, w: 10, x: 3, y: 1 },
  sleep: { cx: 8, h: 14, w: 10, x: 3, y: 1 },
};

const legendMark = (type: EventType): WeekMark => ({
  continuesAfter: false,
  continuesBefore: false,
  dayIdx: 0,
  endHour: 0,
  event: { endedAt: null, id: type, metadata: "", startedAt: "", type },
  id: type,
  kind: "span",
  openEnd: false,
  running: false,
  startHour: 0,
});

const Glyph = ({ type }: { type: EventType }) => (
  <svg
    aria-hidden="true"
    className="shrink-0"
    height={16}
    viewBox="2 0 12 16"
    width={12}
  >
    <MarkShape box={LEGEND_BOX[type]} fadeId={null} mark={legendMark(type)} />
  </svg>
);

const LEGEND_TYPES: EventType[] = ["sleep", "feed", "diaper", "pump"];

const Legend = ({ hasNotes }: { hasNotes: boolean }) => (
  <ul
    aria-label="Key"
    className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2 pb-1 text-neutral-600 text-xs"
  >
    {LEGEND_TYPES.map((type) => (
      <li className="flex items-center gap-1" key={type}>
        <Glyph type={type} />
        {EVENT_TYPE_LABELS[type]}
      </li>
    ))}
    {hasNotes && (
      <li className="flex items-center gap-1">
        <Glyph type="note" />
        Note
      </li>
    )}
    <li className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[4px] border border-neutral-300 bg-surface-sunken" />
      Night
    </li>
  </ul>
);

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

const DayButton = ({
  dayIdx,
  isSelected,
  isToday,
  onSelect,
  summary,
}: {
  dayIdx: number;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (dayIdx: number) => void;
  summary: WeekDaySummary;
}) => {
  const handleClick = useCallback(() => onSelect(dayIdx), [dayIdx, onSelect]);
  const todayText = isToday ? ", today" : "";
  return (
    <button
      aria-label={`${longDay(summary.date)}${todayText}. ${describeDay(summary)}.`}
      aria-pressed={isSelected}
      className={`flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors ${focusRing} ${
        isSelected ? "bg-neutral-200" : "hover:bg-neutral-100"
      }`}
      onClick={handleClick}
      type="button"
    >
      <span
        className={`text-xs leading-none ${isToday ? "font-semibold text-neutral-800" : "text-neutral-500"}`}
      >
        {shortWeekday(summary.date)}
      </span>
      <span
        className={`flex h-6 min-w-6 items-center justify-center px-1 text-sm leading-none tabular-nums ${
          isToday
            ? "rounded-[47%_53%_52%_48%/52%_46%_54%_48%] font-semibold text-surface"
            : "font-medium text-neutral-700"
        }`}
        style={isToday ? TODAY_PEBBLE : undefined}
      >
        {summary.date.getDate()}
      </span>
    </button>
  );
};

const Chevron = ({ direction }: { direction: "next" | "prev" }) => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      d={direction === "prev" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const stepClass = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent ${focusRing}`;

const ReadoutBody = ({ text }: { text: ReadoutText }) => (
  <>
    {text.type && <Glyph type={text.type} />}
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 font-medium text-neutral-800 text-sm leading-snug">
        {text.title}
      </span>
      {text.detail && (
        <span className="line-clamp-2 text-neutral-600 text-xs leading-snug">
          {text.detail}
        </span>
      )}
    </span>
  </>
);

const Readout = ({
  onEdit,
  onStep,
  canNext,
  canPrev,
  text,
}: {
  onEdit: (() => void) | null;
  onStep: (direction: -1 | 1) => void;
  canNext: boolean;
  canPrev: boolean;
  text: ReadoutText;
}) => {
  const handlePrev = useCallback(() => onStep(-1), [onStep]);
  const handleNext = useCallback(() => onStep(1), [onStep]);
  const bodyClass =
    "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left";

  return (
    <div className="flex h-[4.5rem] shrink-0 items-center gap-1">
      <button
        aria-label="Previous event"
        className={stepClass}
        disabled={!canPrev}
        onClick={handlePrev}
        type="button"
      >
        <Chevron direction="prev" />
      </button>
      <div aria-live="polite" className="flex min-w-0 flex-1">
        {onEdit ? (
          <button
            className={`${bodyClass} transition-colors hover:bg-neutral-100 active:bg-neutral-200 ${focusRing}`}
            aria-label={`Edit ${text.title}, ${text.detail}`}
            onClick={onEdit}
            type="button"
          >
            <ReadoutBody text={text} />
            <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-800 text-xs">
              Edit
            </span>
          </button>
        ) : (
          <div className={bodyClass}>
            <ReadoutBody text={text} />
          </div>
        )}
      </div>
      <button
        aria-label="Next event"
        className={stepClass}
        disabled={!canNext}
        onClick={handleNext}
        type="button"
      >
        <Chevron direction="next" />
      </button>
    </div>
  );
};

const SummaryTable = ({
  caption,
  summaries,
}: {
  caption: string;
  summaries: WeekDaySummary[];
}) => (
  <table className="sr-only">
    <caption>{caption}</caption>
    <thead>
      <tr>
        <th scope="col">Day</th>
        <th scope="col">Sleep</th>
        <th scope="col">Feeds</th>
        <th scope="col">Diapers</th>
        <th scope="col">Pumps</th>
      </tr>
    </thead>
    <tbody>
      {summaries.map((summary) => (
        <tr key={summary.date.getTime()}>
          <th scope="row">{longDay(summary.date)}</th>
          <td>{summary.sleepMs > 0 ? formatSpan(summary.sleepMs) : "None"}</td>
          <td>{summary.feeds}</td>
          <td>{summary.diapers}</td>
          <td>{summary.pumps}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

type Selection =
  | { dayIdx: number; kind: "day"; week: number }
  | { eventId: string; kind: "event"; week: number };

const HINT: ReadoutText = {
  detail: "Step through with the arrows, or tap the picture.",
  title: "Tap a day or a mark for its detail",
  type: null,
};

function uniqueEvents(marks: WeekMark[]): BabyEvent[] {
  const seen = new Map<string, BabyEvent>();
  for (const mark of marks) seen.set(mark.event.id, mark.event);
  return [...seen.values()].toSorted(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime() ||
      a.id.localeCompare(b.id)
  );
}

function useWeekSelection(
  ordered: BabyEvent[],
  weekStart: Date,
  restingDay: number
) {
  const weekStartMs = weekStart.getTime();
  const [stored, setStored] = useState<Selection | null>(null);
  const selection = stored?.week === weekStartMs ? stored : null;
  const selectedEvent =
    selection?.kind === "event"
      ? (ordered.find((event) => event.id === selection.eventId) ?? null)
      : null;
  const selectedDay = selection?.kind === "day" ? selection.dayIdx : null;

  const selectDay = useCallback(
    (dayIdx: number) =>
      setStored((prev) =>
        prev?.kind === "day" &&
        prev.week === weekStartMs &&
        prev.dayIdx === dayIdx
          ? null
          : { dayIdx, kind: "day", week: weekStartMs }
      ),
    [weekStartMs]
  );

  const handlePick = useCallback(
    (mark: WeekMark | null, dayIdx: number | null) => {
      if (mark) {
        setStored({ eventId: mark.event.id, kind: "event", week: weekStartMs });
      } else if (dayIdx !== null) {
        selectDay(dayIdx);
      }
    },
    [selectDay, weekStartMs]
  );

  const anchorMs = weekDayStart(weekStart, selectedDay ?? restingDay).getTime();
  const selectedIndex = selectedEvent ? ordered.indexOf(selectedEvent) : -1;
  const firstAfter = ordered.findIndex(
    (event) => new Date(event.startedAt).getTime() >= anchorMs
  );
  const lastBefore = firstAfter === -1 ? ordered.length - 1 : firstAfter - 1;
  const nextIndex = selectedEvent ? selectedIndex + 1 : firstAfter;
  const prevIndex = selectedEvent ? selectedIndex - 1 : lastBefore;

  const handleStep = useCallback(
    (direction: -1 | 1) => {
      const target = ordered[direction === 1 ? nextIndex : prevIndex];
      if (target) {
        setStored({ eventId: target.id, kind: "event", week: weekStartMs });
      }
    },
    [ordered, nextIndex, prevIndex, weekStartMs]
  );

  return {
    canNext: nextIndex >= 0 && nextIndex < ordered.length,
    canPrev: prevIndex >= 0,
    handlePick,
    handleStep,
    selectDay,
    selectedDay,
    selectedEvent,
  };
}

function dayReadout(summary: WeekDaySummary, isToday: boolean): ReadoutText {
  return {
    detail: describeDay(summary),
    title: `${isToday ? "Today · " : ""}${mediumDay(summary.date)}`,
    type: null,
  };
}

export const WeekChart = ({
  events,
  onTapEvent,
  weekStart: weekStartProp,
  now: nowProp,
}: {
  events: BabyEvent[];
  onTapEvent?: (e: BabyEvent) => void;
  weekStart?: Date;
  now?: Date;
}) => {
  const now = useNow(nowProp);
  const weekStartMs = getWeekStart(weekStartProp ?? new Date(now)).getTime();
  const weekStart = useMemo(() => new Date(weekStartMs), [weekStartMs]);
  const marks = useMemo(
    () => buildWeekMarks(events, weekStart, now),
    [events, weekStart, now]
  );
  const summaries = useMemo(
    () => summarizeWeek(events, weekStart, now),
    [events, weekStart, now]
  );
  const ordered = useMemo(() => uniqueEvents(marks), [marks]);
  const todayIdx = weekDayIndex(new Date(now), weekStart);
  const isCurrentWeek = todayIdx >= 0 && todayIdx <= 6;

  const [plotRef, size] = useElementSize<HTMLDivElement>();
  const g = useMemo(
    () => makeGeometry(size.width, size.height),
    [size.width, size.height]
  );
  const fadePrefix = useId().replaceAll(/\W/g, "");
  const drawn = useMemo<Drawn[]>(
    () =>
      marks.map((mark, index) => ({
        box: markBox(g, mark),
        fadeId: mark.openEnd ? `${fadePrefix}-open-${index}` : null,
        mark,
      })),
    [marks, g, fadePrefix]
  );

  const {
    canNext,
    canPrev,
    handlePick,
    handleStep,
    selectDay,
    selectedDay,
    selectedEvent,
  } = useWeekSelection(ordered, weekStart, isCurrentWeek ? todayIdx : 0);

  const handleEdit = useCallback(() => {
    if (selectedEvent) onTapEvent?.(selectedEvent);
  }, [onTapEvent, selectedEvent]);

  const readoutText = useMemo<ReadoutText>(() => {
    if (selectedEvent) {
      const running = marks.some(
        (mark) => mark.event.id === selectedEvent.id && mark.running
      );
      return eventReadout(selectedEvent, running, now);
    }
    const dayIdx = selectedDay ?? (isCurrentWeek ? todayIdx : null);
    return dayIdx === null
      ? HINT
      : dayReadout(summaries[dayIdx], dayIdx === todayIdx);
  }, [
    selectedEvent,
    selectedDay,
    isCurrentWeek,
    todayIdx,
    summaries,
    marks,
    now,
  ]);

  const isEmpty = marks.length === 0;
  const weekLabel = `${mediumDay(weekStart)} to ${mediumDay(weekDayStart(weekStart, 6))}`;

  return (
    <section
      aria-label={`Week pattern, ${weekLabel}: sleep, feeds, diapers and pumps by time of day`}
      className="mx-auto flex h-full w-full max-w-[36rem] flex-col overflow-y-auto px-2"
    >
      <div
        className="flex shrink-0"
        style={{ paddingLeft: COLUMNS_LEFT, paddingRight: PLOT_INSET_X }}
      >
        {DAY_INDEXES.map((dayIdx) => (
          <DayButton
            dayIdx={dayIdx}
            isSelected={selectedDay === dayIdx}
            isToday={dayIdx === todayIdx}
            key={dayIdx}
            onSelect={selectDay}
            summary={summaries[dayIdx]}
          />
        ))}
      </div>

      <div
        className="relative max-h-[36rem] min-h-[12rem] flex-1"
        ref={plotRef}
      >
        {size.width > 0 && size.height > 0 && (
          <Plot
            drawn={drawn}
            g={g}
            now={now}
            onPick={handlePick}
            selectedDay={selectedDay}
            selectedEventId={selectedEvent?.id ?? null}
            todayIdx={todayIdx}
          />
        )}
        {isEmpty && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center px-3"
            style={{ left: GUTTER }}
          >
            <div className="max-w-[17rem] rounded-3xl bg-surface px-5 py-4 text-center">
              <p className="font-medium text-neutral-800 text-sm">
                Nothing logged this week
              </p>
              <p className="mt-1 text-neutral-600 text-xs leading-relaxed">
                {isCurrentWeek
                  ? "Sleep, feeds and diapers settle into this picture as you log them."
                  : "Choose another week to see how its days went."}
              </p>
            </div>
          </div>
        )}
      </div>

      {!isEmpty && (
        <>
          <Legend
            hasNotes={marks.some(
              (mark) => markType(mark.event.type) === "note"
            )}
          />
          <Readout
            canNext={canNext}
            canPrev={canPrev}
            onEdit={selectedEvent && onTapEvent ? handleEdit : null}
            onStep={handleStep}
            text={readoutText}
          />
        </>
      )}

      <SummaryTable
        caption={`Daily totals, ${weekLabel}`}
        summaries={summaries}
      />
    </section>
  );
};
