"use client";

import type { BabyEvent } from "@/lib/baby-context";
import {
  formatSleepDuration,
  totalDiapers,
  totalFedMl,
  totalSleepMinutes,
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
  type: string;
  label: string;
  value: string;
  detail: string | null;
  ago: string | null;
}

export type LastEventDetail = {
  detail: string | null;
  ago: string;
} | null;

export interface DailySummaryProps {
  events: BabyEvent[];
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
    {column.detail && (
      <p className="mt-1 text-[10px] text-neutral-400">{column.detail}</p>
    )}
    {column.ago && (
      <p className="mt-0.5 text-[10px] text-neutral-400">{column.ago}</p>
    )}
  </div>
);

const StatTile = ({ column }: { column: SummaryColumn }) => (
  <div
    className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 ${cardBg[column.type]}`}
  >
    <EventIcon type={column.type} />
    <p className="font-serif text-base font-normal text-neutral-800 tabular-nums">
      {column.value}
    </p>
  </div>
);

function buildColumns(
  events: BabyEvent[],
  unit: "ml" | "oz",
  details: DailySummaryProps["details"]
): SummaryColumn[] {
  return [
    {
      type: "feed",
      label: "Fed",
      value: formatVolume(totalFedMl(events), unit),
      detail: details?.feed?.detail ?? null,
      ago: details?.feed?.ago ?? null,
    },
    {
      type: "sleep",
      label: "Sleep",
      value: formatSleepDuration(totalSleepMinutes(events)),
      detail: details?.sleep?.detail ?? null,
      ago: details?.sleep?.ago ?? null,
    },
    {
      type: "diaper",
      label: "Diapers",
      value: String(totalDiapers(events)),
      detail: details?.diaper?.detail ?? null,
      ago: details?.diaper?.ago ?? null,
    },
  ];
}

export const DailySummary = ({
  events,
  details,
  className = "px-4",
  compact = false,
}: DailySummaryProps) => {
  const { unit } = useVolumeUnit();
  const columns = buildColumns(events, unit, details);

  if (compact) {
    return (
      <div className={`flex gap-1.5 ${className}`}>
        {columns.map((column) => (
          <StatTile column={column} key={column.type} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {columns.map((column, i) => (
        <Blob
          column={column}
          key={column.type}
          padY="py-5"
          shape={blobShapes[i % blobShapes.length]}
          valueSize="text-2xl"
        />
      ))}
    </div>
  );
};
