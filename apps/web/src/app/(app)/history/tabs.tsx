"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

import { navTransitionTypes } from "@/lib/page-transition";

const SUB_TABS = [
  { href: "/history/list", label: "List" },
  { href: "/history/days", label: "Days" },
  { href: "/history/week", label: "Week" },
  { href: "/history/averages", label: "Averages" },
] as const;

export const historyTabFor = (pathname: string): string | null =>
  SUB_TABS.find(({ href }) => pathname.startsWith(href))?.href ?? null;

export const HistoryTabs = () => {
  const pathname = usePathname() ?? "";
  const activeIndex = SUB_TABS.findIndex(({ href }) =>
    pathname.startsWith(href)
  );
  return (
    <nav
      aria-label="History views"
      className="mx-4 mb-3 flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1"
    >
      {SUB_TABS.map(({ href, label }, index) => {
        const active = index === activeIndex;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 text-sm transition-colors ${
              active
                ? "font-semibold text-white"
                : "font-medium text-neutral-400 hover:text-neutral-600"
            }`}
            href={href}
            key={href}
            transitionTypes={navTransitionTypes(activeIndex, index)}
          >
            {active && (
              <ViewTransition name="history-tab-pill" share="indicator">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-primary-500 shadow-sm"
                />
              </ViewTransition>
            )}
            {/* Its own layer, so the sliding pill passes under the label. */}
            <ViewTransition name={`history-tab-${label.toLowerCase()}`}>
              <span className="relative">{label}</span>
            </ViewTransition>
          </Link>
        );
      })}
    </nav>
  );
};
