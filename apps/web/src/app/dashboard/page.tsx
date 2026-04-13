"use client";

import { useTambo } from "@tambo-ai/react";
import { useCallback, useMemo, useState } from "react";

import { GrowthView } from "@/components/growth-view";
import { HistoryView } from "@/components/history-view";
import { PersistentTimeline } from "@/components/persistent-timeline";
import { ProfileSheet } from "@/components/profile-sheet";
import { SuggestionZone } from "@/components/suggestion-zone";
import { UndoToast } from "@/components/undo-toast";
import type { BabyEvent } from "@/lib/baby-context";
import { useBabyContext } from "@/lib/baby-context";
import { EventIcon, getEventStyle } from "@/lib/event-styles";
import { getTamboApiKey } from "@/lib/runtime-config";
import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { useVolumeUnit, formatVolume } from "@/lib/use-volume-unit";

/* ── Last Assistant Response ──────────────────────────────── */

const LastResponse = () => {
  const { messages, isStreaming } = useTambo();

  // Find the last assistant message (skip system messages)
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  if (!lastAssistant && !isStreaming) return null;

  return (
    <div className="px-4 py-2">
      {isStreaming && !lastAssistant && (
        <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3">
          <div className="flex gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400" />
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:200ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-breathe rounded-full bg-neutral-400 [animation-delay:400ms]" />
          </div>
        </div>
      )}
      {lastAssistant && (
        <div className="animate-fade-up rounded-xl bg-neutral-50 px-4 py-3">
          {lastAssistant.content.map((block) => {
            if (block.type === "text") {
              return (
                <p
                  className="text-sm leading-relaxed text-neutral-600"
                  key={`last-${block.text.slice(0, 32)}`}
                >
                  {block.text}
                </p>
              );
            }
            if (
              block.type === "component" &&
              "renderedComponent" in block &&
              block.renderedComponent
            ) {
              const componentBlock = block as {
                id: string;
                renderedComponent: React.ReactNode;
              };
              return (
                <div className="my-2" key={componentBlock.id}>
                  {componentBlock.renderedComponent}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

/* ── Summary Card (replaces urgency status widget) ───────── */

const formatAgo = (minutes: number): string => {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
};

function lastSleepDetail(
  event: BabyEvent,
  now: number
): { detail: string | null; ago: string } {
  let detail: string | null = null;
  if (event.endedAt) {
    const dur = Math.round(
      (new Date(event.endedAt).getTime() -
        new Date(event.startedAt).getTime()) /
        60_000
    );
    if (dur > 0) {
      detail = dur < 60 ? `${dur}m` : `${Math.floor(dur / 60)}h ${dur % 60}m`;
    }
  }
  return {
    detail,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

function lastFeedDetail(
  event: BabyEvent,
  now: number,
  unit: "ml" | "oz"
): { detail: string | null; ago: string } {
  const parts: string[] = [];
  try {
    const meta = JSON.parse(event.metadata);
    if (meta.amountMl) parts.push(formatVolume(meta.amountMl, unit));
    if (meta.method) {
      const m = meta.method as string;
      parts.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
  } catch {
    /* ignore */
  }
  return {
    detail: parts.length > 0 ? parts.join(" \u00B7 ") : null,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

function lastDiaperDetail(
  event: BabyEvent,
  now: number
): { detail: string | null; ago: string } {
  const parts: string[] = [];
  try {
    const meta = JSON.parse(event.metadata);
    if (meta.wet) parts.push("Wet");
    if (meta.soiled) parts.push("Soiled");
  } catch {
    /* ignore */
  }
  return {
    detail: parts.length > 0 ? parts.join(" + ") : null,
    ago: formatAgo((now - new Date(event.startedAt).getTime()) / 60_000),
  };
}

function totalFedMlToday(todayEvents: BabyEvent[]): number {
  let total = 0;
  for (const e of todayEvents) {
    if (e.type !== "feed") continue;
    try {
      const meta = JSON.parse(e.metadata);
      total += meta.amountMl || 0;
    } catch {
      /* ignore */
    }
  }
  return total;
}

function totalSleepMinutesToday(todayEvents: BabyEvent[]): number {
  let total = 0;
  for (const e of todayEvents) {
    if (e.type !== "sleep" || !e.endedAt) continue;
    total +=
      (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) /
      60_000;
  }
  return total;
}

const SummaryCard = () => {
  const { events } = useBabyContext();
  const { unit } = useVolumeUnit();

  const now = Date.now();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter((e) => new Date(e.startedAt) >= todayStart);

  const sleepHours = Math.floor(totalSleepMinutesToday(todayEvents) / 60);
  const lastSleep = events.find((e) => e.type === "sleep");
  const sleepDetail = lastSleep ? lastSleepDetail(lastSleep, now) : null;

  const fedDisplay = formatVolume(totalFedMlToday(todayEvents), unit);
  const lastFeed = events.find((e) => e.type === "feed");
  const feedDetail = lastFeed ? lastFeedDetail(lastFeed, now, unit) : null;

  const diaperCount = todayEvents.filter((e) => e.type === "diaper").length;
  const lastDiaper = events.find((e) => e.type === "diaper");
  const diaperDetail = lastDiaper ? lastDiaperDetail(lastDiaper, now) : null;

  /* Each blob gets a unique organic border-radius (h1 h2 h3 h4 / v1 v2 v3 v4) */
  const blobShapes = [
    "60% 40% 45% 55% / 55% 60% 40% 45%",
    "50% 50% 45% 55% / 45% 55% 50% 50%",
    "45% 55% 60% 40% / 50% 45% 55% 50%",
  ];

  const columns: {
    type: string;
    label: string;
    value: string;
    detail: string | null;
    ago: string | null;
  }[] = [
    {
      type: "sleep",
      label: "Sleep",
      value: `${sleepHours}h`,
      detail: sleepDetail?.detail ?? null,
      ago: sleepDetail?.ago ?? null,
    },
    {
      type: "feed",
      label: "Fed",
      value: fedDisplay,
      detail: feedDetail?.detail ?? null,
      ago: feedDetail?.ago ?? null,
    },
    {
      type: "diaper",
      label: "Diapers",
      value: String(diaperCount),
      detail: diaperDetail?.detail ?? null,
      ago: diaperDetail?.ago ?? null,
    },
  ];

  return (
    <div className="flex gap-2 px-4">
      {columns.map((col, i) => {
        const style = getEventStyle(col.type);
        return (
          <div
            key={col.type}
            className={`flex flex-1 flex-col items-center border-0 px-3 py-5 text-center ${style.bg}`}
            style={{ borderRadius: blobShapes[i % blobShapes.length] }}
          >
            <EventIcon type={col.type} />
            <p className="mt-1 font-serif text-2xl font-normal text-neutral-800">
              {col.value}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
              {col.label}
            </p>
            {col.detail && (
              <p className="mt-1 text-[10px] text-neutral-400">{col.detail}</p>
            )}
            {col.ago && (
              <p className="mt-0.5 text-[10px] text-neutral-400">{col.ago}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Bottom Navigation ───────────────────────────────────── */

const BottomNav = ({
  tab,
  onSwitch,
}: {
  tab: string;
  onSwitch: (tab: "home" | "history" | "growth" | "settings") => void;
}) => {
  const handleHome = useCallback(() => onSwitch("home"), [onSwitch]);
  const handleHistory = useCallback(() => onSwitch("history"), [onSwitch]);
  const handleGrowth = useCallback(() => onSwitch("growth"), [onSwitch]);
  const handleSettings = useCallback(() => onSwitch("settings"), [onSwitch]);

  const activeClass = "text-neutral-800";
  const inactiveClass = "text-neutral-400";

  return (
    <nav className="flex border-t border-neutral-200 bg-surface-raised safe-bottom">
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${tab === "home" ? activeClass : inactiveClass}`}
        onClick={handleHome}
        type="button"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
          />
        </svg>
        Home
      </button>
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${tab === "history" ? activeClass : inactiveClass}`}
        onClick={handleHistory}
        type="button"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
        History
      </button>
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${tab === "growth" ? activeClass : inactiveClass}`}
        onClick={handleGrowth}
        type="button"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
          />
        </svg>
        Growth
      </button>
      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${tab === "settings" ? activeClass : inactiveClass}`}
        onClick={handleSettings}
        type="button"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Settings
      </button>
    </nav>
  );
};

/* ── Main Dashboard ──────────────────────────────────────── */

export default function DashboardPage() {
  useAutoDarkMode();
  const { baby } = useBabyContext();
  const [tab, setTab] = useState<"home" | "history" | "growth" | "settings">(
    "home"
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const tamboEnabled = Boolean(getTamboApiKey());
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const handleTabSwitch = useCallback(
    (newTab: "home" | "history" | "growth" | "settings") => {
      if (newTab === "settings") {
        openProfile();
      } else {
        setTab(newTab);
      }
    },
    [openProfile]
  );

  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header — baby name + date (editorial style) */}
      <header className="px-4 pt-6 pb-4 text-center">
        <h1 className="font-serif text-2xl text-neutral-800">
          {baby?.name ?? "Little One"}
        </h1>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
          {today}
        </p>
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {tab === "home" && (
          <>
            {/* Summary card */}
            <SummaryCard />

            {/* Log Activity */}
            <div className="mt-8 px-4">
              <h2 className="text-center font-serif text-lg italic text-neutral-600">
                Log Activity
              </h2>
            </div>

            <div className="mt-4">
              <SuggestionZone />
            </div>

            {tamboEnabled && <LastResponse />}

            {/* Recent Logs */}
            <div className="mt-6 px-4">
              <h2 className="text-center font-serif text-lg italic text-neutral-600">
                Recent Logs
              </h2>
            </div>

            <div className="mt-3">
              <PersistentTimeline />
            </div>
          </>
        )}
        {tab === "history" && <HistoryView />}
        {tab === "growth" && <GrowthView />}
      </div>

      {/* Bottom navigation */}
      <BottomNav tab={tab} onSwitch={handleTabSwitch} />

      {/* Undo toast — floating */}
      <UndoToast />

      {/* Profile sheet — bottom slide-up (opened via Settings tab) */}
      <ProfileSheet open={profileOpen} onClose={closeProfile} />
    </div>
  );
}
