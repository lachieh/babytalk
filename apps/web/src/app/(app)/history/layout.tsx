"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EventEditSheet } from "@/components/event-edit-sheet";
import type { BabyEvent } from "@/lib/baby-context";
import { BabyContextProvider } from "@/lib/baby-context";
import { gqlRequest, restoreSession } from "@/lib/gql-request";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

import { HistorySheetContext } from "./_context";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } myBabies { id } }
`;

const SUB_TABS = [
  { href: "/history/list", label: "List" },
  { href: "/history/days", label: "Days" },
  { href: "/history/week", label: "Week" },
  { href: "/history/averages", label: "Averages" },
] as const;

const HistoryTabs = () => {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="History views"
      className="mx-4 mb-3 flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1"
    >
      {SUB_TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 text-sm transition-colors ${
              active
                ? "bg-primary-500 font-semibold text-white shadow-sm"
                : "font-medium text-neutral-400 hover:text-neutral-600"
            }`}
            href={href}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
};

const HistoryShell = ({ children }: { children: React.ReactNode }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openEdit = useCallback((event: BabyEvent) => {
    setEditingEvent(event);
    setIsNew(false);
    setSheetOpen(true);
  }, []);

  const openAdd = useCallback(() => {
    setEditingEvent(null);
    setIsNew(true);
    setSheetOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setSheetOpen(false);
    setEditingEvent(null);
    setIsNew(false);
  }, []);

  const ctxValue = useMemo(() => ({ openEdit, openAdd }), [openEdit, openAdd]);

  return (
    <AppShell>
      <HistorySheetContext.Provider value={ctxValue}>
        <div className="flex min-h-0 flex-1 flex-col py-2">
          <HistoryTabs />

          <Suspense>{children}</Suspense>
        </div>

        <EventEditSheet
          event={isNew ? null : editingEvent}
          onClose={handleClose}
          open={sheetOpen}
        />
      </HistorySheetContext.Provider>
    </AppShell>
  );
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAutoDarkMode();
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
        // If the check fails, still show history
      }
      setReady(true);
    };

    checkHousehold();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
        <div
          aria-hidden="true"
          className="h-[calc(max(env(safe-area-inset-top),1.5rem)+4.5rem)] shrink-0"
        />
        <div className="py-2">
          <HistoryTabs />
        </div>
      </div>
    );
  }

  return (
    <RuntimeConfigProvider>
      <BabyContextProvider>
        <HistoryShell>{children}</HistoryShell>
      </BabyContextProvider>
    </RuntimeConfigProvider>
  );
}
