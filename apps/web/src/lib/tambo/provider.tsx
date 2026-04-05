"use client";

import { TamboProvider } from "@tambo-ai/react";

import { getTamboApiKey, getTamboUrl } from "@/lib/runtime-config";

import { tamboComponents } from "./components";
import { gqlRequest } from "./graphql";
import { tamboTools } from "./tools";

const SYSTEM_PROMPT = `You are BabyTalk — a calm, warm, and concise baby tracking companion. You help tired parents log feeds, sleep, diapers, and notes. You feel like a co-parent who never sleeps, never forgets, and never judges.

## Personality
- Warm but brief. You're the friend who just gets it.
- Confirm actions in ≤5 words when possible, but make them feel personal:
  "Got it — left side, 15 min. That's 6 feeds today." not "Feed logged."
- Never give unsolicited medical advice.
- Express quiet empathy when context suggests exhaustion (late-night feeds, rapid diaper changes).

## Smart Defaults (NLP)
- "fed the baby" → breast, same side as last feed, startedAt=now
- "she ate for 15 minutes" → breast, infer side from last feed, endedAt=now, startedAt=15min ago
- "diaper change" → wet=true, soiled=false, now
- "poopy diaper" → wet=true, soiled=true, now
- "baby slept" or "going down for a nap" → start sleep timer, location=last used location
- "just" = now (e.g., "she just ate" → startedAt: now)
- "left"/"right"/"both" in feed context = breast side
- "wet"/"dirty"/"poopy" in isolation = diaper event
- First-time user (no history) → ask for method/side explicitly, then learn from patterns
- Convert oz to ml (1oz ≈ 30ml) before logging

## Assumptions
- "she"/"he"/"they" = the baby unless ambiguous
- Times = today unless specified
- If only one baby registered, use that baby's ID automatically

## Voice Confirmations
After logging, always respond with a warm, contextual confirmation that includes:
1. What was logged (brief)
2. One piece of helpful context (count today, time since last, running pattern)
Example: "Left side, done. Third feed today — she's eating well."
Example: "Wet diaper at 2:15am. Hang in there, you're doing great."

## Component Rules
- After logging → render EventConfirmation
- Activity questions → use getRecentEvents → render Timeline
- Timed activity (feed/nap start) → log with startedAt=now → render Timer
- App open / idle → render QuickActions with contextual suggestions
- QuickActions should reflect time-of-day patterns (more feeds in morning, sleep at night)

## Partner Handoff
When context shows a different user logging after a gap:
- Summarize events since their last session
- Include: event counts by type, key details, time since last event
- Keep it brief: "While you were away: 3 feeds (last left side 45min ago), 2 diapers, napped 1h20m in crib."`;

const GET_MY_BABIES = `
  query { myBabies { id name birthDate } }
`;

const GET_RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $limit: Int) {
    recentEvents(babyId: $babyId, limit: $limit) {
      id type startedAt endedAt metadata loggedById
    }
  }
`;

const buildContextHelpers = () => ({
  babyInfo: async () => {
    try {
      const data = await gqlRequest<{
        myBabies: { birthDate: string; id: string; name: string }[];
      }>(GET_MY_BABIES);
      const babies = data.myBabies;
      if (babies.length === 0)
        return { key: "babyInfo", value: "No babies registered yet." };

      const info = babies
        .map((b) => {
          const birth = new Date(b.birthDate);
          const days = Math.floor((Date.now() - birth.getTime()) / 86_400_000);
          const weeks = Math.floor(days / 7);
          const age =
            weeks > 0 ? `${weeks} weeks, ${days % 7} days` : `${days} days`;
          return `${b.name} (ID: ${b.id}, age: ${age}, born: ${b.birthDate})`;
        })
        .join("; ");
      return { key: "babyInfo", value: info };
    } catch {
      return { key: "babyInfo", value: "Could not load baby info." };
    }
  },
  currentTime: () => {
    const now = new Date();
    const hour = now.getHours();
    let timeOfDay = "night";
    if (hour < 6) timeOfDay = "late night";
    else if (hour < 12) timeOfDay = "morning";
    else if (hour < 17) timeOfDay = "afternoon";
    else if (hour < 20) timeOfDay = "evening";
    return {
      key: "currentTime",
      value: `${now.toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}, ${timeOfDay})`,
    };
  },
  recentActivity: async () => {
    try {
      const babiesData = await gqlRequest<{
        myBabies: { id: string; name: string }[];
      }>(GET_MY_BABIES);
      if (babiesData.myBabies.length === 0)
        return { key: "recentActivity", value: "No babies yet." };

      const [baby] = babiesData.myBabies;
      const eventsData = await gqlRequest<{
        recentEvents: {
          id: string;
          startedAt: string;
          endedAt: string | null;
          type: string;
          metadata: string;
          loggedById: string;
        }[];
      }>(GET_RECENT_EVENTS, { babyId: baby.id, limit: 10 });

      if (eventsData.recentEvents.length === 0) {
        return {
          key: "recentActivity",
          value:
            "No events logged yet today. This is a new user — ask for explicit details on first events.",
        };
      }

      const summary = eventsData.recentEvents
        .map((e) => {
          const ago = Math.round(
            (Date.now() - new Date(e.startedAt).getTime()) / 60_000
          );
          let meta = "";
          try {
            const parsed = JSON.parse(e.metadata);
            if (e.type === "feed") {
              meta = [parsed.method, parsed.side].filter(Boolean).join(" ");
            }
          } catch {
            /* parse error */
          }
          return `${e.type}${meta ? ` (${meta})` : ""} ${ago}min ago`;
        })
        .join(", ");

      // Count today's events by type
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCounts: Record<string, number> = {};
      for (const e of eventsData.recentEvents) {
        if (new Date(e.startedAt) >= todayStart) {
          todayCounts[e.type] = (todayCounts[e.type] || 0) + 1;
        }
      }
      const countsStr = Object.entries(todayCounts)
        .map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`)
        .join(", ");

      return {
        key: "recentActivity",
        value: `Recent: ${summary}. Today's totals: ${countsStr || "none yet"}.`,
      };
    } catch {
      return {
        key: "recentActivity",
        value: "Could not load recent activity.",
      };
    }
  },
});

export const BabyTamboProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const apiKey = getTamboApiKey();
  const tamboUrl = getTamboUrl();

  return (
    <TamboProvider
      apiKey={apiKey}
      components={tamboComponents}
      contextHelpers={buildContextHelpers()}
      initialMessages={[
        {
          content: [{ text: SYSTEM_PROMPT, type: "text" as const }],
          role: "system" as const,
        },
      ]}
      tamboUrl={tamboUrl}
      tools={tamboTools}
      userKey="default-user"
    >
      {children}
    </TamboProvider>
  );
};
