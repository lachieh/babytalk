"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import { Icon } from "@/components/icons";
import type { IconName } from "@/components/icons";
import { ProfileSheet } from "@/components/profile-sheet";
import { UndoToast } from "@/components/undo-toast";
import { useBabyContext } from "@/lib/baby-context";

export type AppTab = "home" | "pump" | "history" | "growth";

const TABS: { href: string; icon: IconName; key: AppTab; label: string }[] = [
  {
    href: "/dashboard",
    icon: "home",
    key: "home",
    label: "Home",
  },
  {
    href: "/history/list",
    icon: "history",
    key: "history",
    label: "History",
  },
  {
    href: "/dashboard/growth",
    icon: "growth",
    key: "growth",
    label: "Growth",
  },
  {
    href: "/dashboard/pump",
    icon: "pump",
    key: "pump",
    label: "Pump",
  },
];

function activeTabFor(pathname: string): AppTab {
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/dashboard/pump")) return "pump";
  if (pathname.startsWith("/dashboard/growth")) return "growth";
  return "home";
}

const COLUMN = "mx-auto w-full max-w-xl";

const BottomNav = ({ active }: { active: AppTab }) => (
  <nav
    aria-label="Main"
    className="shrink-0 border-neutral-200 border-t bg-surface-raised safe-bottom"
  >
    <ul className={`flex ${COLUMN}`}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <li className="flex-1" key={tab.key}>
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs uppercase tracking-wider transition-colors ${
                isActive
                  ? "font-semibold text-neutral-800"
                  : "font-medium text-neutral-500 hover:text-neutral-700"
              }`}
              href={tab.href}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-neutral-800"
                />
              )}
              <Icon
                className="h-5 w-5"
                name={tab.icon}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {tab.label}
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { baby, loading } = useBabyContext();
  const pathname = usePathname() ?? "";
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const active = activeTabFor(pathname);

  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  let title: React.ReactNode = "Bubsie";
  if (baby) {
    title = baby.name;
  } else if (loading) {
    title = (
      <>
        <span
          aria-hidden="true"
          className="inline-block h-6 w-32 animate-breathe rounded-full bg-neutral-200 align-middle"
        />
        <span className="sr-only">Loading</span>
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
      <header
        className={`relative shrink-0 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 text-center ${COLUMN}`}
      >
        <h1 className="font-serif text-2xl text-neutral-800">{title}</h1>
        <p className="mt-1 font-medium text-neutral-500 text-xs uppercase tracking-[0.16em]">
          {today}
        </p>
        <button
          aria-label="Settings"
          className="absolute top-[max(env(safe-area-inset-top),1.5rem)] right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          onClick={openProfile}
          type="button"
        >
          <Icon className="h-5 w-5" name="settings" strokeWidth={1.5} />
        </button>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col ${COLUMN}`}>{children}</div>

      <BottomNav active={active} />

      <UndoToast />

      <ProfileSheet onClose={closeProfile} open={profileOpen} />
    </div>
  );
};
