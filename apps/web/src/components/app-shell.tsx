"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { ProfileSheet } from "@/components/profile-sheet";
import { UndoToast } from "@/components/undo-toast";
import { VoiceButton } from "@/components/voice-button";
import { VoiceOverlay } from "@/components/voice-overlay";
import { useBabyContext } from "@/lib/baby-context";
import { useTamboReady } from "@/lib/tambo/provider";
import { VoiceSessionProvider } from "@/lib/voice-session";

export type AppTab = "home" | "pump" | "history" | "growth";

const HOME_HREF = "/dashboard";
const PUMP_HREF = "/dashboard/pump";
const GROWTH_HREF = "/dashboard/growth";
const HISTORY_HREF = "/history/days";

function activeTabFor(pathname: string): AppTab {
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/dashboard/pump")) return "pump";
  if (pathname.startsWith("/dashboard/growth")) return "growth";
  return "home";
}

const BottomNav = ({
  active,
  tamboEnabled,
}: {
  active: AppTab;
  tamboEnabled: boolean;
}) => {
  const router = useRouter();
  const goHome = useCallback(() => router.push(HOME_HREF), [router]);
  const goPump = useCallback(() => router.push(PUMP_HREF), [router]);
  const goHistory = useCallback(() => router.push(HISTORY_HREF), [router]);
  const goGrowth = useCallback(() => router.push(GROWTH_HREF), [router]);

  const activeClass = "text-neutral-800";
  const inactiveClass = "text-neutral-400";

  return (
    <nav className="relative flex border-neutral-200 border-t bg-surface-raised safe-bottom">
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 font-medium text-[10px] uppercase tracking-wider transition-colors ${active === "home" ? activeClass : inactiveClass}`}
        onClick={goHome}
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
            d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Home
      </button>
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 font-medium text-[10px] uppercase tracking-wider transition-colors ${active === "history" ? activeClass : inactiveClass}`}
        onClick={goHistory}
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
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        History
      </button>

      {tamboEnabled && (
        <div className="flex flex-1 items-center justify-center">
          <div className="-mt-5">
            <VoiceButton />
          </div>
        </div>
      )}

      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 font-medium text-[10px] uppercase tracking-wider transition-colors ${active === "growth" ? activeClass : inactiveClass}`}
        onClick={goGrowth}
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
            d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Growth
      </button>
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 font-medium text-[10px] uppercase tracking-wider transition-colors ${active === "pump" ? activeClass : inactiveClass}`}
        onClick={goPump}
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
            d="M20.42 4.58a5.4 5.4 0 00-7.65 0L12 5.36l-.77-.78a5.4 5.4 0 00-7.65 7.65l1.06 1.06L12 20.64l7.36-7.36 1.06-1.06a5.4 5.4 0 000-7.64z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Pump
      </button>
    </nav>
  );
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { baby } = useBabyContext();
  const pathname = usePathname() ?? "";
  const tamboEnabled = useTamboReady();
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const active = activeTabFor(pathname);

  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <VoiceSessionProvider>
      <div className="flex h-screen flex-col bg-surface pt-[env(safe-area-inset-top)]">
        <header className="relative px-4 pt-6 pb-4 text-center">
          <h1 className="font-serif text-2xl text-neutral-800">
            {baby?.name ?? "Little One"}
          </h1>
          <p className="mt-1 font-medium text-[11px] text-neutral-400 uppercase tracking-[0.2em]">
            {today}
          </p>
          <button
            aria-label="Settings"
            className="absolute top-6 right-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            onClick={openProfile}
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

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {tamboEnabled && <VoiceOverlay />}

        <BottomNav active={active} tamboEnabled={tamboEnabled} />

        <UndoToast />

        <ProfileSheet onClose={closeProfile} open={profileOpen} />
      </div>
    </VoiceSessionProvider>
  );
};
