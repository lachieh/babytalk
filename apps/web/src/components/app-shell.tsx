"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ViewTransition,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/icons";
import type { IconName } from "@/components/icons";
import { ProfileSheet } from "@/components/profile-sheet";
import { UndoToast } from "@/components/undo-toast";
import { useBabyContext } from "@/lib/baby-context";
import { navTransitionTypes, pageEnter, pageExit } from "@/lib/page-transition";

export type AppTab = "home" | "history" | "growth" | "pump";

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

const BottomNav = ({ active }: { active: AppTab }) => {
  const activeIndex = TABS.findIndex((tab) => tab.key === active);
  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-neutral-200 border-t bg-surface-raised safe-bottom"
    >
      <ul className={`flex ${COLUMN}`}>
        {TABS.map((tab, index) => {
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
                transitionTypes={navTransitionTypes(activeIndex, index)}
              >
                {isActive && (
                  <ViewTransition name="main-tab-indicator" share="indicator">
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-neutral-800"
                    />
                  </ViewTransition>
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
};

const TitleSkeleton = () => (
  <>
    <span
      aria-hidden="true"
      className="inline-block h-6 w-32 animate-breathe rounded-full bg-neutral-200 align-middle"
    />
    <span className="sr-only">Loading</span>
  </>
);

const todayLabel = () =>
  new Date().toLocaleDateString([], {
    day: "numeric",
    month: "short",
    weekday: "long",
  });

// The date is read once per render; nothing to subscribe to.
const unsubscribe = () => null;
const noSubscription = () => unsubscribe;

/** The date on this phone. Empty in the server's HTML: the server's
 * timezone and locale are not the person's. */
const useToday = () =>
  useSyncExternalStore(noSubscription, todayLabel, () => "");

const AppShellFrame = ({
  children,
  onOpenSettings,
  title,
}: {
  children: React.ReactNode;
  onOpenSettings?: () => void;
  title: React.ReactNode;
}) => {
  const pathname = usePathname() ?? "";
  const active = activeTabFor(pathname);
  const today = useToday();

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
          className="absolute top-[max(env(safe-area-inset-top),1.5rem)] right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
          disabled={!onOpenSettings}
          onClick={onOpenSettings}
          type="button"
        >
          <Icon className="h-5 w-5" name="settings" strokeWidth={1.5} />
        </button>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col ${COLUMN}`}>
        <ViewTransition
          default="none"
          enter={pageEnter}
          exit={pageExit}
          key={active}
        >
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </ViewTransition>
      </div>

      <BottomNav active={active} />
    </div>
  );
};

export const AppShellSkeleton = ({
  children,
}: {
  children: React.ReactNode;
}) => <AppShellFrame title={<TitleSkeleton />}>{children}</AppShellFrame>;

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { baby, loading } = useBabyContext();
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  let title: React.ReactNode = "Bubsie";
  if (baby) title = baby.name;
  else if (loading) title = <TitleSkeleton />;

  return (
    <>
      <AppShellFrame onOpenSettings={openProfile} title={title}>
        {children}
      </AppShellFrame>
      <UndoToast />
      <ProfileSheet onClose={closeProfile} open={profileOpen} />
    </>
  );
};
