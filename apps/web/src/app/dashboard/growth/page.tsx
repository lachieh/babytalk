"use client";

import { AppShell } from "@/components/app-shell";
import { GrowthView } from "@/components/growth-view";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

export default function GrowthPage() {
  useAutoDarkMode();

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <GrowthView />
      </div>
    </AppShell>
  );
}
