"use client";

import type { BabyEvent } from "@/lib/baby-context";
import type { LastEventDetail } from "@/lib/daily-totals";
import {
  eventsForDay,
  formatSleepDuration,
  NO_VALUE,
  totalDiapers,
  totalFedMl,
  totalFeeds,
  totalSleepMinutes,
  totalSleepMinutesForDay,
} from "@/lib/daily-totals";
import { formatVolume, useVolumeUnit } from "@/lib/use-volume-unit";

type SummaryType = "feed" | "sleep" | "diaper";

export const cardBg: Record<SummaryType, string> = {
  diaper: "bg-diaper-100",
  feed: "bg-feed-100",
  sleep: "bg-sleep-100",
};

const activeDot: Record<SummaryType, string> = {
  diaper: "bg-diaper-500",
  feed: "bg-feed-500",
  sleep: "bg-sleep-500",
};

export const blobShapes = [
  "60% 40% 45% 55% / 55% 60% 40% 45%",
  "50% 50% 45% 55% / 45% 55% 50% 50%",
  "45% 55% 60% 40% / 50% 45% 55% 50%",
  "55% 45% 40% 60% / 48% 52% 58% 42%",
  "42% 58% 52% 48% / 58% 44% 56% 42%",
  "52% 48% 58% 42% / 42% 56% 44% 58%",
  "48% 52% 44% 56% / 60% 46% 54% 40%",
];

interface SummaryColumn {
  active: boolean;
  ago: string | null;
  detail: string | null;
  label: string;
  type: SummaryType;
  value: string;
}

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
): Pick<SummaryColumn, "active" | "ago" | "detail"> => ({
  active: detail?.active ?? false,
  ago: detail?.ago ?? null,
  detail: detail?.detail ?? null,
});

const Blob = ({
  column,
  shape,
  compact,
}: {
  column: SummaryColumn;
  shape: string;
  compact: boolean;
}) => (
  <div
    className={`flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-2 text-center ${
      compact ? "aspect-[4/3]" : "aspect-[7/8]"
    } ${cardBg[column.type]}`}
    style={{ borderRadius: shape }}
  >
    <p
      className={`font-serif font-normal leading-tight text-neutral-800 ${
        compact ? "text-xl" : "text-2xl"
      }`}
    >
      {column.value === NO_VALUE ? (
        <>
          <span aria-hidden="true">{NO_VALUE}</span>
          <span className="sr-only">None yet</span>
        </>
      ) : (
        column.value
      )}
    </p>
    <p className="font-medium text-neutral-600 text-xs uppercase tracking-wider">
      {column.label}
    </p>
    {column.ago && (
      <p className="mt-1.5 flex items-center justify-center gap-1 font-medium text-[13px] text-neutral-700 leading-tight">
        {column.active && (
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 animate-breathe rounded-full ${activeDot[column.type]}`}
          />
        )}
        {column.ago}
      </p>
    )}
    {column.detail && (
      <p className="mt-0.5 text-neutral-600 text-xs leading-tight">
        {column.detail}
      </p>
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
  const fedMl = totalFedMl(pointEvents);
  const feeds = totalFeeds(pointEvents);
  const diapers = totalDiapers(pointEvents);

  let fed = { label: "Fed", value: NO_VALUE };
  if (fedMl > 0) {
    fed = { label: "Fed", value: formatVolume(fedMl, unit) };
  } else if (feeds > 0) {
    fed = { label: feeds === 1 ? "Feed" : "Feeds", value: String(feeds) };
  }

  return [
    { ...getLastEventSummary(details?.feed), ...fed, type: "feed" },
    {
      ...getLastEventSummary(details?.sleep),
      label: "Sleep",
      type: "sleep",
      value: formatSleepDuration(sleepMinutes),
    },
    {
      ...getLastEventSummary(details?.diaper),
      label: diapers === 1 ? "Diaper" : "Diapers",
      type: "diaper",
      value: diapers > 0 ? String(diapers) : NO_VALUE,
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
  const shapeOffset = date ? date.getDate() : 0;

  return (
    <div className={className}>
      <div className="mx-auto flex max-w-md items-start gap-2">
        {columns.map((column, i) => (
          <Blob
            column={column}
            compact={compact}
            key={column.type}
            shape={blobShapes[(shapeOffset + i) % blobShapes.length]}
          />
        ))}
      </div>
    </div>
  );
};
