import { blobShapes, cardBg } from "./daily-summary";

const Bone = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`block animate-breathe rounded-full bg-neutral-200 ${className}`}
  />
);

const SkeletonRegion = ({
  children,
  className = "",
  label = "Loading",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) => (
  <div aria-label={label} className={className} role="status">
    {children}
  </div>
);

const ROW_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-24", "w-36"];

export const EventRowsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <ul aria-hidden="true" className="space-y-0.5">
    {ROW_WIDTHS.slice(0, rows).map((width, row) => (
      <li
        className="flex min-h-[44px] items-center gap-3 border-neutral-100 border-b px-4 py-3"
        // oxlint-disable-next-line no-array-index-key -- fixed placeholder rows
        key={row}
      >
        <Bone className="h-3 w-28 shrink-0 rounded-md" />
        <Bone className="h-5 w-5 shrink-0" />
        <Bone className={`h-3.5 rounded-md ${width}`} />
      </li>
    ))}
  </ul>
);

const BLOB_TONES = [cardBg.feed, cardBg.sleep, cardBg.diaper];

export const DailySummarySkeleton = ({
  className = "px-4",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) => (
  <div aria-hidden="true" className={className}>
    <div className="mx-auto flex max-w-md items-start gap-2">
      {BLOB_TONES.map((tone, i) => (
        <div
          className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-2 ${
            compact ? "aspect-[4/3]" : "aspect-[7/8]"
          } ${tone}`}
          key={tone}
          style={{ borderRadius: blobShapes[i] }}
        >
          <Bone
            className={`w-14 bg-neutral-50/70 ${compact ? "h-5" : "h-6"}`}
          />
          <Bone className="h-2.5 w-10 bg-neutral-50/70" />
        </div>
      ))}
    </div>
  </div>
);

export const HomeSkeleton = () => (
  <SkeletonRegion
    className="flex min-h-0 flex-1 flex-col overflow-hidden"
    label="Loading today"
  >
    <DailySummarySkeleton />
    <div aria-hidden="true" className="max-h-56 min-h-6 flex-1" />
    <div aria-hidden="true">
      <Bone className="mx-auto h-5 w-28 rounded-md" />
      <div className="mt-3 grid grid-cols-3 gap-2 px-4">
        {BLOB_TONES.map((tone) => (
          <div className="flex flex-col gap-1.5" key={tone}>
            <div className="min-h-[112px] rounded-2xl border-2 border-neutral-300 border-dashed" />
            <Bone className="mx-auto h-[44px] w-full rounded-xl bg-neutral-100" />
          </div>
        ))}
      </div>
      <Bone className="mx-auto mt-8 h-5 w-28 rounded-md" />
      <div className="mt-3">
        <EventRowsSkeleton rows={3} />
      </div>
    </div>
  </SkeletonRegion>
);

export const HistorySkeleton = () => (
  <SkeletonRegion
    className="min-h-0 flex-1 overflow-hidden"
    label="Loading history"
  >
    <Bone className="mx-4 mb-3 h-[46px] w-[calc(100%-2rem)] rounded-xl bg-neutral-100" />
    <Bone className="mx-4 mb-2 h-3 w-16 rounded-md" />
    <EventRowsSkeleton rows={6} />
  </SkeletonRegion>
);

export const GrowthSkeleton = () => (
  <SkeletonRegion
    className="mx-auto w-full max-w-2xl px-4 pt-1 pb-10"
    label="Loading growth"
  >
    <div aria-hidden="true">
      <div className="h-[52px] rounded-2xl bg-surface-sunken" />
      <Bone className="mt-5 h-7 w-32 rounded-md" />
      <Bone className="mt-2 h-3.5 w-48 rounded-md" />
      <div className="mt-5 aspect-[3/2] max-h-[360px] w-full animate-breathe rounded-2xl bg-neutral-100" />
      <Bone className="mt-6 h-[48px] w-full rounded-xl bg-neutral-100" />
    </div>
  </SkeletonRegion>
);

export const PumpSkeleton = () => (
  <SkeletonRegion
    className="flex min-h-0 flex-1 flex-col"
    label="Loading pumping"
  >
    <div aria-hidden="true" className="flex-1 pt-2 pb-4">
      <Bone className="mx-4 mb-3 h-3 w-24 rounded-md" />
      <EventRowsSkeleton rows={2} />
    </div>
    <div
      aria-hidden="true"
      className="border-neutral-200 border-t px-4 pt-4 pb-[4.75rem]"
    >
      <Bone className="mx-auto mb-3 h-5 w-32 rounded-md" />
      <Bone className="h-14 w-full rounded-2xl bg-neutral-100" />
    </div>
  </SkeletonRegion>
);

export const AveragesSkeleton = () => (
  <SkeletonRegion
    className="min-h-0 flex-1 overflow-hidden px-4"
    label="Loading averages"
  >
    <div aria-hidden="true" className="mx-auto w-full max-w-xl pt-2 pb-8">
      <Bone className="h-6 w-48 rounded-md" />
      <Bone className="mt-3 h-3.5 w-full rounded-md" />
      <Bone className="mt-2 h-3.5 w-2/3 rounded-md" />
      <div className="mt-7 space-y-8">
        {BLOB_TONES.map((tone) => (
          <div key={tone}>
            <Bone className="h-4 w-20 rounded-md" />
            <div className={`mt-3 h-24 rounded-2xl ${tone} animate-breathe`} />
          </div>
        ))}
      </div>
    </div>
  </SkeletonRegion>
);

export const DaysSkeleton = () => (
  <div aria-hidden="true" className="space-y-2 pb-4">
    {[0, 1, 2].map((day) => (
      <div className="mx-2 px-2 py-2" key={day}>
        <Bone className="mx-2 mb-2 h-3 w-20 rounded-md" />
        <DailySummarySkeleton className="px-0" compact />
      </div>
    ))}
  </div>
);

export const WeekSkeleton = () => (
  <SkeletonRegion
    className="flex min-h-0 flex-1 flex-col px-2 pb-2"
    label="Loading the week"
  >
    <div aria-hidden="true" className="mx-2 mb-2 flex items-center gap-2">
      <Bone className="h-11 w-11 bg-neutral-100" />
      <Bone className="mx-auto h-4 w-24 rounded-md" />
      <Bone className="h-11 w-11 bg-neutral-100" />
    </div>
    <div
      aria-hidden="true"
      className="mx-2 max-h-[36rem] min-h-[12rem] flex-1 animate-breathe rounded-2xl bg-neutral-100"
    />
  </SkeletonRegion>
);
