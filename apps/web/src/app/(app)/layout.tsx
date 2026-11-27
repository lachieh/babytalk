"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { AppShell, AppShellSkeleton } from "@/components/app-shell";
import {
  AveragesSkeleton,
  DaysSkeleton,
  GrowthSkeleton,
  HistorySkeleton,
  HomeSkeleton,
  PumpSkeleton,
  WeekSkeleton,
} from "@/components/skeletons";
import { BabyContextProvider, readCachedBaby } from "@/lib/baby-context";
import { gqlRequest, restoreSession } from "@/lib/gql-request";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";

import { HistoryTabs, historyTabFor } from "./history/tabs";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } myBabies { id } }
`;

const HistoryViewSkeleton = ({ view }: { view: string | null }) => {
  switch (view) {
    case "/history/averages": {
      return <AveragesSkeleton />;
    }
    case "/history/week": {
      return <WeekSkeleton />;
    }
    case "/history/days": {
      return (
        <div className="min-h-0 flex-1 overflow-hidden" role="status">
          <span className="sr-only">Loading days</span>
          <div className="mx-4 mb-3 h-[46px] animate-breathe rounded-xl bg-neutral-100" />
          <DaysSkeleton />
        </div>
      );
    }
    default: {
      return <HistorySkeleton />;
    }
  }
};

const PageSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith("/history")) {
    return (
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <HistoryTabs />
        <HistoryViewSkeleton view={historyTabFor(pathname)} />
      </div>
    );
  }
  if (pathname.startsWith("/dashboard/growth")) return <GrowthSkeleton />;
  if (pathname.startsWith("/dashboard/pump")) return <PumpSkeleton />;
  return <HomeSkeleton />;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (readCachedBaby()) setReady(true);
  }, []);

  useEffect(() => {
    const checkHousehold = async () => {
      if (!(await restoreSession())) {
        router.replace("/auth/login");
        return;
      }

      await loadRuntimeConfig();
      try {
        const data = await gqlRequest<{
          myBabies: { id: string }[];
          myHousehold: { id: string } | null;
        }>(CHECK_HOUSEHOLD);

        if (!data.myHousehold || data.myBabies.length === 0) {
          router.replace("/dashboard/setup");
          return;
        }
      } catch {
        // If the check fails, still show the app: it works offline.
      }
      setReady(true);
    };

    checkHousehold();
  }, [router]);

  if (!ready) {
    return (
      <AppShellSkeleton>
        <PageSkeleton pathname={pathname} />
      </AppShellSkeleton>
    );
  }

  return (
    <RuntimeConfigProvider>
      <BabyContextProvider>
        <AppShell>{children}</AppShell>
      </BabyContextProvider>
    </RuntimeConfigProvider>
  );
}
