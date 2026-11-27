import { EventIcon } from "@/lib/event-styles";
import type { EventType } from "@/lib/event-styles";
import {
  MIN_LOGGED_DAYS,
  compareValues,
  describeSeries,
  formatCount,
  formatMinutes,
} from "@/lib/typical-day-report";
import type {
  Granularity,
  MetricKey,
  MetricTrend,
  TypicalDayReport,
} from "@/lib/typical-day-report";
import { formatVolume } from "@/lib/use-volume-unit";
import type { VolumeUnit } from "@/lib/use-volume-unit";

import { Sparkline } from "./sparkline";
import type { SparklineTone } from "./sparkline";

interface RowSpec {
  key: MetricKey;
  label: string;
  plain: (value: number, unit: VolumeUnit) => string;
  stated: (value: number, unit: VolumeUnit) => string;
}

interface GroupSpec {
  rows: RowSpec[];
  title: string;
  tone: SparklineTone;
  type: EventType;
}

const volume = (value: number, unit: VolumeUnit): string =>
  formatVolume(Math.round(value), unit);

const GROUPS: GroupSpec[] = [
  {
    rows: [
      {
        key: "feedsPerDay",
        label: "Feeds",
        plain: formatCount,
        stated: (value) => `${formatCount(value)} a day`,
      },
      {
        key: "feedVolumePerDay",
        label: "Measured volume",
        plain: volume,
        stated: (value, unit) => `${volume(value, unit)} a day`,
      },
      {
        key: "feedLength",
        label: "Feed length",
        plain: formatMinutes,
        stated: (value) => `${formatMinutes(value)} each`,
      },
    ],
    title: "Feeding",
    tone: { area: "text-feed-200", line: "stroke-feed-500" },
    type: "feed",
  },
  {
    rows: [
      {
        key: "sleepPerDay",
        label: "Total sleep",
        plain: formatMinutes,
        stated: (value) => `${formatMinutes(value)} a day`,
      },
      {
        key: "longestSleep",
        label: "Longest stretch",
        plain: formatMinutes,
        stated: formatMinutes,
      },
    ],
    title: "Sleep",
    tone: { area: "text-sleep-200", line: "stroke-sleep-500" },
    type: "sleep",
  },
  {
    rows: [
      {
        key: "diapersPerDay",
        label: "Changes",
        plain: formatCount,
        stated: (value) => `${formatCount(value)} a day`,
      },
    ],
    title: "Diapers",
    tone: { area: "text-diaper-200", line: "stroke-diaper-500" },
    type: "diaper",
  },
  {
    rows: [
      {
        key: "pumpsPerDay",
        label: "Sessions",
        plain: formatCount,
        stated: (value) => `${formatCount(value)} a day`,
      },
      {
        key: "pumpVolumePerDay",
        label: "Milk pumped",
        plain: volume,
        stated: (value, unit) => `${volume(value, unit)} a day`,
      },
    ],
    title: "Pumping",
    tone: { area: "text-pump-200", line: "stroke-pump-500" },
    type: "pump",
  },
];

const PERIOD_WORDS: Record<
  Granularity,
  { before: string; each: string; last: string; one: string; many: string }
> = {
  month: {
    before: "the month before",
    each: "30 days at a time",
    last: "the last 30 days",
    many: "30-day periods",
    one: "30-day period",
  },
  week: {
    before: "the week before",
    each: "week by week",
    last: "the last 7 days",
    many: "weeks",
    one: "week",
  },
};

const DIRECTION_WORDS = { down: "falling", steady: "steady", up: "rising" };

const isVisible = (trend: MetricTrend): boolean =>
  trend.hasData || trend.currentDays > 0;

const days = (count: number): string =>
  count === 1 ? "1 day" : `${count} days`;

function comparison(
  row: RowSpec,
  trend: MetricTrend,
  report: TypicalDayReport,
  unit: VolumeUnit
): string {
  const words = PERIOD_WORDS[report.granularity];
  const ownCount = trend.currentDays !== report.currentLoggedDays;
  if (trend.current === null) {
    return ownCount
      ? `${days(trend.currentDays)} logged, ${MIN_LOGGED_DAYS} needed`
      : "";
  }
  const basis = ownCount ? `From ${days(trend.currentDays)} logged` : "";
  if (trend.previous === null) return basis;

  const now = row.plain(trend.current, unit);
  const before = row.plain(trend.previous, unit);
  const direction =
    now === before ? "steady" : compareValues(trend.current, trend.previous);
  const change =
    direction === "steady"
      ? `About the same as ${words.before}`
      : `${direction === "up" ? "Up" : "Down"} from ${before} ${words.before}`;
  return basis ? `${change}. ${basis}.` : change;
}

function basisSentence(report: TypicalDayReport): string {
  const words = PERIOD_WORDS[report.granularity];
  const logged = report.currentLoggedDays;
  const since = report.windows[0]?.start.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
  const hasCurrent = GROUPS.some((group) =>
    group.rows.some((row) => report.metrics[row.key].current !== null)
  );
  if (!hasCurrent) {
    return `Only ${days(logged)} logged in ${words.last}, and a typical day needs ${MIN_LOGGED_DAYS}. The lines show how things looked before, ${words.each} since ${since}.`;
  }
  const basis =
    logged < report.windowDays
      ? `Averaged over the ${days(logged)} logged in ${words.last}; days with nothing logged are left out.`
      : `Averaged over ${words.last}.`;
  const lines =
    report.windows.length > 1
      ? `Each line shows the change ${words.each} since ${since}.`
      : `Trend lines appear once there is a second ${words.one} to compare.`;
  return `${basis} ${lines}`;
}

function trendSentence(
  row: RowSpec,
  group: GroupSpec,
  trend: MetricTrend,
  report: TypicalDayReport,
  unit: VolumeUnit
): string {
  const words = PERIOD_WORDS[report.granularity];
  const subject = `${group.title}, ${row.label.toLowerCase()}`;
  const series = describeSeries(trend.points);
  if (!series) return `${subject}: one ${words.one} so far, no trend yet.`;
  return `${subject} over ${series.periods} ${words.many}: ${DIRECTION_WORDS[series.direction]}, from ${row.plain(series.first, unit)} to ${row.plain(series.last, unit)}.`;
}

const MetricRow = ({
  group,
  report,
  row,
  unit,
}: {
  group: GroupSpec;
  report: TypicalDayReport;
  row: RowSpec;
  unit: VolumeUnit;
}) => {
  const trend = report.metrics[row.key];
  const note = comparison(row, trend, report, unit);
  const hasLine = describeSeries(trend.points) !== null;
  const lastKnown = trend.points.findLast((point) => point !== null);

  return (
    <li className="flex items-center gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-neutral-600 text-sm">{row.label}</p>
        {trend.current === null ? (
          <p className="mt-0.5 text-base text-neutral-700 tabular-nums">
            {lastKnown === undefined
              ? "Not enough days yet"
              : `${row.stated(lastKnown, unit)} when last logged`}
          </p>
        ) : (
          <p className="mt-0.5 font-medium text-neutral-800 text-xl leading-7 tabular-nums">
            {row.stated(trend.current, unit)}
          </p>
        )}
        {note ? (
          <p className="mt-0.5 text-neutral-500 text-xs leading-5">{note}</p>
        ) : null}
      </div>
      {hasLine ? (
        <Sparkline
          className="h-11 w-24 min-[360px]:w-[7.5rem]"
          label={trendSentence(row, group, trend, report, unit)}
          tone={group.tone}
          values={trend.points}
        />
      ) : null}
    </li>
  );
};

const MetricGroup = ({
  group,
  report,
  unit,
}: {
  group: GroupSpec;
  report: TypicalDayReport;
  unit: VolumeUnit;
}) => {
  const rows = group.rows.filter((row) => isVisible(report.metrics[row.key]));
  if (rows.length === 0) return null;
  const headingId = `typical-${group.type}`;

  return (
    <section aria-labelledby={headingId}>
      <h3
        className="flex items-center gap-2 font-medium text-base text-neutral-700"
        id={headingId}
      >
        <span aria-hidden="true">
          <EventIcon type={group.type} />
        </span>
        {group.title}
      </h3>
      <ul className="mt-1 divide-y divide-neutral-200">
        {rows.map((row) => (
          <MetricRow
            group={group}
            key={row.key}
            report={report}
            row={row}
            unit={unit}
          />
        ))}
      </ul>
    </section>
  );
};

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-balance font-serif text-neutral-800 text-xl leading-7">
    {children}
  </h2>
);

const LoggedDots = ({ count }: { count: number }) => (
  <div aria-hidden="true" className="mt-5 flex gap-2">
    {Array.from({ length: MIN_LOGGED_DAYS }, (_, index) => (
      <span
        className={`h-3 w-3 rounded-full ${
          index < count ? "bg-primary-400" : "bg-neutral-200"
        }`}
        key={index}
      />
    ))}
  </div>
);

export const TypicalDay = ({
  babyName,
  report,
  unit,
}: {
  babyName: string;
  report: TypicalDayReport;
  unit: VolumeUnit;
}) => {
  if (report.status === "empty") {
    return (
      <div className="mx-auto w-full max-w-xl pt-2 pb-8">
        <Heading>Nothing logged yet</Heading>
        <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600 text-sm leading-6">
          After a few days of feeds, sleep and diapers, this is where you will
          see what a typical day looks like for {babyName}.
        </p>
      </div>
    );
  }

  if (report.status === "thin") {
    const logged = Math.min(report.currentLoggedDays, MIN_LOGGED_DAYS);
    return (
      <div className="mx-auto w-full max-w-xl pt-2 pb-8">
        <Heading>Not enough days yet to show a typical week</Heading>
        <LoggedDots count={logged} />
        <p className="mt-3 max-w-[60ch] text-pretty text-neutral-600 text-sm leading-6">
          {logged} of {MIN_LOGGED_DAYS} full days logged in the last 7. Today
          counts once it is over, so the first averages for {babyName} appear
          the morning after the third day.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl pt-2 pb-8">
      <Heading>{babyName}&rsquo;s typical day</Heading>
      <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600 text-sm leading-6">
        {basisSentence(report)}
      </p>
      <div className="mt-7 space-y-8">
        {GROUPS.map((group) => (
          <MetricGroup
            group={group}
            key={group.type}
            report={report}
            unit={unit}
          />
        ))}
      </div>
    </div>
  );
};
