"use client";

import { useCallback, useState } from "react";

import { StationSettingsSheet } from "@/components/station-settings-sheet";
import { StationTile } from "@/components/station-tile";
import { UndoToast } from "@/components/undo-toast";
import { VoiceButton } from "@/components/voice-button";
import { VoiceOverlay } from "@/components/voice-overlay";
import { useBabyContext } from "@/lib/baby-context";
import { useStationActions } from "@/lib/station-config";
import { useTamboReady } from "@/lib/tambo/provider";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { VoiceSessionProvider } from "@/lib/voice-session";

const StationHeader = ({
  babyName,
  onOpenSettings,
}: {
  babyName: string;
  onOpenSettings: () => void;
}) => (
  <header className="relative shrink-0 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 text-center">
    <p className="font-medium text-[11px] text-neutral-400 uppercase tracking-[0.2em]">
      Station
    </p>
    <h1 className="mt-1 font-serif text-2xl text-neutral-800">{babyName}</h1>
    <button
      aria-label="Station settings"
      className="absolute top-6 right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
      onClick={onOpenSettings}
      type="button"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </header>
);

const EmptyState = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
    <p className="font-serif text-lg text-neutral-600 italic">
      No actions are showing
    </p>
    <p className="mt-2 max-w-xs text-sm text-neutral-500">
      Pick the buttons you want on this station device.
    </p>
    <button
      className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary-600 active:scale-[0.97]"
      onClick={onOpenSettings}
      type="button"
    >
      Choose actions
    </button>
  </div>
);

export default function StationPage() {
  useAutoDarkMode();
  const { baby, loading } = useBabyContext();
  const tamboEnabled = useTamboReady();
  const { visible, toggle } = useStationActions();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);

  const tileCount = visible.length;
  const gridCols = tileCount <= 1 ? "grid-cols-1" : "grid-cols-2";

  let mainContent: React.ReactNode;
  if (loading) {
    mainContent = (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  } else if (tileCount === 0) {
    mainContent = <EmptyState onOpenSettings={handleOpenSettings} />;
  } else {
    mainContent = (
      <div className={`grid h-full gap-3 ${gridCols} auto-rows-fr`}>
        {visible.map((key) => (
          <StationTile key={key} type={key} />
        ))}
      </div>
    );
  }

  return (
    <VoiceSessionProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
        <StationHeader
          babyName={baby?.name ?? "Little One"}
          onOpenSettings={handleOpenSettings}
        />

        <main className="flex min-h-0 flex-1 flex-col px-4 pb-6">
          {mainContent}
        </main>

        {tamboEnabled && <VoiceOverlay />}
        {tamboEnabled && (
          <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-4 z-30">
            <div className="pointer-events-auto">
              <VoiceButton />
            </div>
          </div>
        )}

        <UndoToast />

        <StationSettingsSheet
          onClose={handleCloseSettings}
          onToggle={toggle}
          open={settingsOpen}
          visible={visible}
        />
      </div>
    </VoiceSessionProvider>
  );
}
