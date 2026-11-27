import type { ViewTransitionClass } from "react";

const FORWARD = "nav-forward";
const BACK = "nav-back";

export const navTransitionTypes = (
  from: number,
  to: number
): string[] | undefined => {
  if (from === to || from < 0) return undefined;
  return [to > from ? FORWARD : BACK];
};

export const pageEnter: ViewTransitionClass = {
  [BACK]: "page-in-from-start",
  [FORWARD]: "page-in-from-end",
  default: "page-fade-in",
};

export const pageExit: ViewTransitionClass = {
  [BACK]: "page-out-to-end",
  [FORWARD]: "page-out-to-start",
  default: "page-fade-out",
};
