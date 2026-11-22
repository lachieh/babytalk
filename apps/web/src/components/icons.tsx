import type { SVGProps } from "react";

import { ICON_PATHS, ICON_STROKE, pebblePath } from "./icon-paths";
import type { IconName } from "./icon-paths";

export type { IconName } from "./icon-paths";

export const Icon = ({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={ICON_STROKE}
    viewBox="0 0 24 24"
    {...props}
  >
    <path d={ICON_PATHS[name]} />
  </svg>
);

export const PebbleLoading = () => (
  <div
    aria-label="Loading"
    className="flex min-h-screen items-center justify-center bg-surface"
    role="status"
  >
    <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 64 64">
      <path
        className="fill-primary-100 motion-safe:animate-[breathe_5s_ease-in-out_infinite]"
        d={pebblePath(4, 4, 56)}
      />
      <path className="fill-primary-300" d={pebblePath(18, 18, 28)} />
    </svg>
  </div>
);
