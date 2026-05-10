"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EventEditSheet } from "@/components/event-edit-sheet";
import type { BabyEvent } from "@/lib/baby-context";
import { BabyContextProvider } from "@/lib/baby-context";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";
import { gqlRequest } from "@/lib/tambo/graphql";
import { BabyTamboProvider } from "@/lib/tambo/provider";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

import { HistorySheetContext } from "./_context";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } myBabies { id } }
`;

type SubTab = "days" | "week" | "list";

function subTabFromPath(pathname: string): SubTab {
  if (pathname.startsWith("/history/week")) return "week";
  if (pathname.startsWith("/history/list")) return "list";
  return "days";
}

const SubTabButton = ({
  active,
  label,
  href,
}: {
  active: boolean;
  label: string;
  href: string;
}) => {
  const router = useRouter();
  const onClick = useCallback(() => router.push(href), [router, href]);

  return (
    <button
      className={`flex-1 rounded-lg py-1.5 font-medium text-xs transition-colors ${
        active
          ? "bg-primary-500 text-white"
          : "text-neutral-400 hover:text-neutral-600"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
};

const HistoryShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? "";
  const sub = subTabFromPath(pathname);

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
          <div className="mx-4 mb-3 flex shrink-0 gap-1 rounded-xl bg-neutral-100 p-1">
            <SubTabButton
              active={sub === "days"}
              href="/history/days"
              label="Days"
            />
            <SubTabButton
              active={sub === "week"}
              href="/history/week"
              label="Week"
            />
            <SubTabButton
              active={sub === "list"}
              href="/history/list"
              label="List"
            />
          </div>

          {children}
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
    const token = localStorage.getItem("babytalk_token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    const checkHousehold = async () => {
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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  }

  return (
    <RuntimeConfigProvider>
      <BabyTamboProvider>
        <BabyContextProvider>
          <HistoryShell>{children}</HistoryShell>
        </BabyContextProvider>
      </BabyTamboProvider>
    </RuntimeConfigProvider>
  );
}
