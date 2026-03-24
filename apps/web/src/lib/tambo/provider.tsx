"use client";

import { TamboProvider } from "@tambo-ai/react";

import { tamboComponents } from "./components";
import { gqlRequest } from "./graphql";
import { tamboTools } from "./tools";

const SYSTEM_PROMPT = `You are BabyTalk, a calm and concise baby tracking assistant. You help parents log feeds, sleep, diapers, and notes for their baby.

Rules:
- Confirm actions in 5 words or less when possible
- Never give unsolicited medical advice
- Assume "she"/"he"/"they" refers to the baby unless ambiguous
- Assume times are today unless specified
- "Just" means now (e.g., "she just ate" = startedAt: now)
- "Left"/"right"/"both" in a feed context = breast side
- "Wet"/"dirty"/"poopy" in isolation = diaper event
- When logging events, always use the logEvent tool and then render an EventConfirmation component
- When the user asks about recent activity, use getRecentEvents and render a Timeline
- When the user starts a timed activity (feed/nap), log the event with startedAt=now and render a Timer
- When the app opens or user seems idle, render QuickActions with contextual suggestions
- For amounts: convert oz to ml (1oz = ~30ml) before logging`;

const GET_MY_BABIES = `
  query { myBabies { id name birthDate } }
`;

const GET_RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $limit: Int) {
    recentEvents(babyId: $babyId, limit: $limit) {
      id type startedAt
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
  currentTime: () => ({
    key: "currentTime",
    value: `${new Date().toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  }),
  recentActivity: async () => {
    try {
      const babiesData = await gqlRequest<{
        myBabies: { id: string; name: string }[];
      }>(GET_MY_BABIES);
      if (babiesData.myBabies.length === 0)
        return { key: "recentActivity", value: "No babies yet." };

      const [baby] = babiesData.myBabies;
      const eventsData = await gqlRequest<{
        recentEvents: { id: string; startedAt: string; type: string }[];
      }>(GET_RECENT_EVENTS, { babyId: baby.id, limit: 5 });

      const summary = eventsData.recentEvents
        .map((e) => {
          const ago = Math.round(
            (Date.now() - new Date(e.startedAt).getTime()) / 60_000
          );
          return `${e.type} ${ago}min ago`;
        })
        .join(", ");

      return {
        key: "recentActivity",
        value: summary || "No events logged yet today.",
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
  const apiKey = process.env.NEXT_PUBLIC_BABYTALK_WEB_TAMBO_API_KEY || "";
  const tamboUrl =
    process.env.NEXT_PUBLIC_BABYTALK_WEB_TAMBO_URL || "http://localhost:8261";

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
