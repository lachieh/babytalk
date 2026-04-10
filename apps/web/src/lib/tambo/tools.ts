import type { TamboTool } from "@tambo-ai/react";
import { z } from "zod";

import { gqlRequest } from "./graphql";

const LOG_EVENT = `
  mutation LogEvent(
    $babyId: String!
    $type: EventType!
    $startedAt: String
    $endedAt: String
    $feedMeta: FeedMetadataInput
    $sleepMeta: SleepMetadataInput
    $diaperMeta: DiaperMetadataInput
    $noteMeta: NoteMetadataInput
  ) {
    logEvent(
      babyId: $babyId
      type: $type
      startedAt: $startedAt
      endedAt: $endedAt
      feedMeta: $feedMeta
      sleepMeta: $sleepMeta
      diaperMeta: $diaperMeta
      noteMeta: $noteMeta
    ) {
      id
      type
      startedAt
      endedAt
      metadata
      loggedById
    }
  }
`;

const GET_RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $type: String, $limit: Int) {
    recentEvents(babyId: $babyId, type: $type, limit: $limit) {
      id
      type
      startedAt
      endedAt
      metadata
      loggedById
    }
  }
`;

const GET_LAST_EVENT = `
  query LastEvent($babyId: String!, $type: String) {
    lastEvent(babyId: $babyId, type: $type) {
      id
      type
      startedAt
      endedAt
      metadata
      loggedById
    }
  }
`;

const UPDATE_EVENT = `
  mutation UpdateEvent(
    $id: String!
    $startedAt: String
    $endedAt: String
    $feedMeta: FeedMetadataInput
    $sleepMeta: SleepMetadataInput
    $diaperMeta: DiaperMetadataInput
    $noteMeta: NoteMetadataInput
  ) {
    updateEvent(
      id: $id
      startedAt: $startedAt
      endedAt: $endedAt
      feedMeta: $feedMeta
      sleepMeta: $sleepMeta
      diaperMeta: $diaperMeta
      noteMeta: $noteMeta
    ) {
      id
      type
      startedAt
      endedAt
      metadata
    }
  }
`;

const DELETE_EVENT = `
  mutation DeleteEvent($id: String!) {
    deleteEvent(id: $id)
  }
`;

const GET_MY_BABIES = `
  query MyBabies {
    myBabies {
      id
      name
      birthDate
    }
  }
`;

export const tamboTools: TamboTool[] = [
  {
    description:
      "Log a baby event (feed, sleep, diaper, or note). Use the matching metadata input for the event type. If the user doesn't specify a baby and there's only one, use that baby's ID.",
    inputSchema: z.object({
      babyId: z.string().describe("UUID of the baby"),
      diaperMeta: z
        .object({
          color: z
            .enum(["yellow", "green", "brown", "black", "red"])
            .optional(),
          notes: z.string().optional(),
          soiled: z.boolean(),
          wet: z.boolean(),
        })
        .optional()
        .describe("Required for diaper events"),
      endedAt: z
        .string()
        .optional()
        .describe("ISO timestamp for when the event ended"),
      feedMeta: z
        .object({
          amountMl: z.number().optional().describe("Amount in milliliters"),
          foodDesc: z.string().optional(),
          method: z.enum(["breast", "bottle", "solid"]),
          side: z.enum(["left", "right", "both"]).optional(),
        })
        .optional()
        .describe("Required for feed events"),
      noteMeta: z
        .object({ text: z.string() })
        .optional()
        .describe("Required for note events"),
      sleepMeta: z
        .object({
          location: z
            .enum(["crib", "bassinet", "held", "carrier", "other"])
            .optional(),
          quality: z.enum(["good", "restless", "poor"]).optional(),
        })
        .optional()
        .describe("Required for sleep events"),
      startedAt: z
        .string()
        .optional()
        .describe("ISO timestamp, defaults to now"),
      type: z.enum(["feed", "sleep", "diaper", "note", "pump"]),
    }),
    name: "logEvent",
    outputSchema: z.object({
      endedAt: z.string().nullable(),
      id: z.string(),
      metadata: z.string(),
      startedAt: z.string(),
      type: z.string(),
    }),
    tool: async (params) => {
      const data = await gqlRequest<{ logEvent: unknown }>(LOG_EVENT, params);
      return data.logEvent;
    },
  },
  {
    description:
      "Get recent events for a baby. Optionally filter by type. Returns newest first.",
    inputSchema: z.object({
      babyId: z.string().describe("UUID of the baby"),
      limit: z.number().optional().describe("Max events to return, default 20"),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .optional()
        .describe("Filter by event type"),
    }),
    name: "getRecentEvents",
    outputSchema: z.array(
      z.object({
        endedAt: z.string().nullable(),
        id: z.string(),
        metadata: z.string(),
        startedAt: z.string(),
        type: z.string(),
      })
    ),
    tool: async (params) => {
      const data = await gqlRequest<{ recentEvents: unknown }>(
        GET_RECENT_EVENTS,
        params
      );
      return data.recentEvents;
    },
  },
  {
    description:
      "Get the most recent event for a baby, optionally filtered by type. Useful for 'when was the last feed?' questions.",
    inputSchema: z.object({
      babyId: z.string().describe("UUID of the baby"),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .optional()
        .describe("Filter by event type"),
    }),
    name: "getLastEvent",
    outputSchema: z
      .object({
        endedAt: z.string().nullable(),
        id: z.string(),
        metadata: z.string(),
        startedAt: z.string(),
        type: z.string(),
      })
      .nullable(),
    tool: async (params) => {
      const data = await gqlRequest<{ lastEvent: unknown }>(
        GET_LAST_EVENT,
        params
      );
      return data.lastEvent;
    },
  },
  {
    description:
      "Update an existing event. Only provide fields that need changing.",
    inputSchema: z.object({
      diaperMeta: z
        .object({
          color: z
            .enum(["yellow", "green", "brown", "black", "red"])
            .optional(),
          notes: z.string().optional(),
          soiled: z.boolean(),
          wet: z.boolean(),
        })
        .optional(),
      endedAt: z.string().optional(),
      feedMeta: z
        .object({
          amountMl: z.number().optional(),
          foodDesc: z.string().optional(),
          method: z.enum(["breast", "bottle", "solid"]),
          side: z.enum(["left", "right", "both"]).optional(),
        })
        .optional(),
      id: z.string().describe("UUID of the event to update"),
      noteMeta: z.object({ text: z.string() }).optional(),
      sleepMeta: z
        .object({
          location: z
            .enum(["crib", "bassinet", "held", "carrier", "other"])
            .optional(),
          quality: z.enum(["good", "restless", "poor"]).optional(),
        })
        .optional(),
      startedAt: z.string().optional(),
    }),
    name: "updateEvent",
    outputSchema: z.object({
      endedAt: z.string().nullable(),
      id: z.string(),
      metadata: z.string(),
      startedAt: z.string(),
      type: z.string(),
    }),
    tool: async (params) => {
      const data = await gqlRequest<{ updateEvent: unknown }>(
        UPDATE_EVENT,
        params
      );
      return data.updateEvent;
    },
  },
  {
    description: "Delete an event by ID.",
    inputSchema: z.object({
      id: z.string().describe("UUID of the event to delete"),
    }),
    name: "deleteEvent",
    outputSchema: z.object({ success: z.boolean() }),
    tool: async (params) => {
      await gqlRequest(DELETE_EVENT, params);
      return { success: true };
    },
  },
  {
    description:
      "Get all babies in the household. Use this to find baby IDs when the user refers to a baby by name.",
    inputSchema: z.object({}),
    name: "getMyBabies",
    outputSchema: z.array(
      z.object({
        birthDate: z.string(),
        id: z.string(),
        name: z.string(),
      })
    ),
    tool: async () => {
      const data = await gqlRequest<{
        myBabies: { birthDate: string; id: string; name: string }[];
      }>(GET_MY_BABIES);
      return data.myBabies;
    },
  },
];
