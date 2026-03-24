import type { TamboComponent } from "@tambo-ai/react";
import { z } from "zod";

import { EventConfirmation } from "@/components/tambo/event-confirmation";
import { QuickActions } from "@/components/tambo/quick-actions";
import { Timeline } from "@/components/tambo/timeline";
import { Timer } from "@/components/tambo/timer";

export const tamboComponents: TamboComponent[] = [
  {
    component: EventConfirmation,
    description:
      "Shows a confirmation of a logged event with edit and delete actions. Use after successfully logging a feed, sleep, diaper, or note event.",
    name: "EventConfirmation",
    propsSchema: z.object({
      endedAt: z
        .string()
        .optional()
        .describe("ISO timestamp when event ended, if applicable"),
      eventId: z.string().describe("The UUID of the logged event"),
      metadata: z
        .string()
        .describe("JSON string of the event metadata from the logEvent tool"),
      startedAt: z.string().describe("ISO timestamp when event started"),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .describe("The type of event that was logged"),
    }),
  },
  {
    component: QuickActions,
    description:
      "Renders contextual quick-action buttons for common baby tracking tasks. Show when the user opens the app or asks what they can do. Choose actions based on time of day and how long since last event of each type.",
    name: "QuickActions",
    propsSchema: z.object({
      actions: z
        .array(
          z.object({
            label: z.string().describe("Button label, e.g. 'Log Feed'"),
            prompt: z
              .string()
              .describe(
                "The message to send when tapped, e.g. 'she just ate from a bottle'"
              ),
          })
        )
        .describe("2-6 contextual action buttons"),
    }),
  },
  {
    component: Timeline,
    description:
      "Shows a chronological list of baby events. Use when the user asks 'what happened today', 'show me the log', or wants to see recent activity.",
    name: "Timeline",
    propsSchema: z.object({
      events: z
        .array(
          z.object({
            endedAt: z.string().nullable().optional(),
            id: z.string(),
            metadata: z.string(),
            startedAt: z.string(),
            type: z.string(),
          })
        )
        .describe("Array of events to display, newest first"),
    }),
  },
  {
    component: Timer,
    description:
      "Shows a running timer for an active feed or sleep session. Use when the user says 'start a feed', 'she's going down for a nap', or similar.",
    name: "Timer",
    propsSchema: z.object({
      eventId: z.string().optional().describe("Event UUID if already logged"),
      startTime: z
        .string()
        .describe("ISO timestamp when the timer started, usually now"),
      type: z.enum(["feed", "sleep"]).describe("The type of timed event"),
    }),
  },
];
