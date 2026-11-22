import { ICON_PATHS, pebblePath } from "@/components/icon-paths";

const VARIANTS = {
  rest: { glyph: ICON_PATHS.sleep, transform: "translate(56 4) scale(0.8)" },
  growth: {
    glyph: ICON_PATHS.growth,
    transform: "translate(53 36.5) scale(1.25)",
  },
} as const;

export const EmptyIllustration = ({
  className = "",
  variant,
}: {
  className?: string;
  variant: keyof typeof VARIANTS;
}) => {
  const { glyph, transform } = VARIANTS[variant];
  return (
    <svg
      aria-hidden="true"
      className={`h-[72px] w-24 ${className}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 96 72"
    >
      <path className="fill-primary-200" d={pebblePath(20, 23, 40)} />
      <path className="stroke-neutral-300" d="M16 63.5h64" strokeWidth={1.75} />
      <path
        className="stroke-primary-ink"
        d={glyph}
        strokeWidth={1.75}
        transform={transform}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
