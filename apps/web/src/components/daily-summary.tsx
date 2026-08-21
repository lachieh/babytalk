"use client";

import type { BabyEvent } from "@/lib/baby-context";
import {
  eventsForDay,
  formatSleepDuration,
  totalDiapers,
  totalFedMl,
  totalSleepMinutes,
  totalSleepMinutesForDay,
} from "@/lib/daily-totals";
import { EventIcon } from "@/lib/event-styles";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

const cardBg: Record<string, string> = {
  sleep: "bg-sleep-100",
  feed: "bg-feed-100",
  diaper: "bg-diaper-100",
};

/* Each blob gets a unique organic border-radius (h1 h2 h3 h4 / v1 v2 v3 v4) */
const blobShapes = [
  "60% 40% 45% 55% / 55% 60% 40% 45%",
  "50% 50% 45% 55% / 45% 55% 50% 50%",
  "45% 55% 60% 40% / 50% 45% 55% 50%",
];

interface SummaryColumn {
  ago: string | null;
  detail: string | null;
  label: string;
  type: string;
  value: string;
}

export type LastEventDetail = {
  detail: string | null;
  ago: string;
} | null;

export interface DailySummaryProps {
  events: BabyEvent[];
  /** Calendar day represented by this summary. Duration totals are clipped to it. */
  date?: Date;
  /** Optional details rendered below each blob (last-event info on home page). */
  details?: {
    feed?: LastEventDetail;
    sleep?: LastEventDetail;
    diaper?: LastEventDetail;
  };
  className?: string;
  /** Compact mode tightens padding for use in dense lists (history days view). */
  compact?: boolean;
}

const getLastEventSummary = (
  detail?: LastEventDetail
): Pick<SummaryColumn, "ago" | "detail"> => ({
  ago: detail?.ago ?? null,
  detail: detail?.detail ?? null,
});

const Blob = ({
  column,
  shape,
  padY,
  valueSize,
}: {
  column: SummaryColumn;
  shape: string;
  padY: string;
  valueSize: string;
}) => (
  <div
    className={`flex flex-1 flex-col items-center border-0 px-3 ${padY} text-center ${cardBg[column.type]}`}
    style={{ borderRadius: shape }}
  >
    <EventIcon type={column.type} />
    <p className={`mt-1 font-serif ${valueSize} font-normal text-neutral-800`}>
      {column.value}
    </p>
    <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
      {column.label}
    </p>
    {column.ago && (
      <p className="mt-1 text-[10px] text-neutral-400">{column.ago}</p>
    )}
    {column.detail && (
      <p className="mt-0.5 text-[10px] text-neutral-400">{column.detail}</p>
    )}
  </div>
);

function buildColumns(
  events: BabyEvent[],
  unit: "ml" | "oz",
  details: DailySummaryProps["details"],
  date?: Date
): SummaryColumn[] {
  const pointEvents = date ? eventsForDay(events, date) : events;
  const sleepMinutes = date
    ? totalSleepMinutesForDay(events, date)
    : totalSleepMinutes(events);
  const feedSummary = getLastEventSummary(details?.feed);
  const sleepSummary = getLastEventSummary(details?.sleep);
  const diaperSummary = getLastEventSummary(details?.diaper);

  return [
    {
      ...feedSummary,
      label: "Fed",
      type: "feed",
      value: formatVolume(totalFedMl(pointEvents), unit),
    },
    {
      ...sleepSummary,
      label: "Sleep",
      type: "sleep",
      value: formatSleepDuration(sleepMinutes),
    },
    {
      ...diaperSummary,
      label: "Diapers",
      type: "diaper",
      value: String(totalDiapers(pointEvents)),
    },
  ];
}

export const DailySummary = ({
  events,
  date,
  details,
  className = "px-4",
  compact = false,
}: DailySummaryProps) => {
  const { unit } = useVolumeUnit();
  const columns = buildColumns(events, unit, details, date);
  const padY = compact ? "py-3" : "py-5";
  const valueSize = compact ? "text-xl" : "text-2xl";

  return (
    <div className={`flex gap-2 ${className}`}>
      {columns.map((column, i) => (
        <Blob
          column={column}
          key={column.type}
          padY={padY}
          shape={blobShapes[i % blobShapes.length]}
          valueSize={valueSize}
        />
      ))}
    </div>
  );
};
