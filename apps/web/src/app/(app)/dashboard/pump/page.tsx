"use client";

import { AppShell } from "@/components/app-shell";
import { PumpView } from "@/components/pump-view";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";

export default function PumpPage() {
  useAutoDarkMode();

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <PumpView />
      </div>
    </AppShell>
  );
}
