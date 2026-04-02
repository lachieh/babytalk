import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { gqlRequest } from "../graphql";

const LOG_EVENT = `
  mutation LogEvent($babyId: String!, $type: EventType!, $startedAt: String, $endedAt: String, $feedMeta: FeedMetadataInput, $sleepMeta: SleepMetadataInput, $diaperMeta: DiaperMetadataInput, $noteMeta: NoteMetadataInput) {
    logEvent(babyId: $babyId, type: $type, startedAt: $startedAt, endedAt: $endedAt, feedMeta: $feedMeta, sleepMeta: $sleepMeta, diaperMeta: $diaperMeta, noteMeta: $noteMeta) {
      id type startedAt endedAt metadata loggedById
    }
  }
`;

const GET_RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $type: String, $limit: Int) {
    recentEvents(babyId: $babyId, type: $type, limit: $limit) {
      id type startedAt endedAt metadata loggedById
    }
  }
`;

const GET_LAST_EVENT = `
  query LastEvent($babyId: String!, $type: String) {
    lastEvent(babyId: $babyId, type: $type) {
      id type startedAt endedAt metadata loggedById
    }
  }
`;

const UPDATE_EVENT = `
  mutation UpdateEvent($id: String!, $startedAt: String, $endedAt: String, $feedMeta: FeedMetadataInput, $sleepMeta: SleepMetadataInput, $diaperMeta: DiaperMetadataInput, $noteMeta: NoteMetadataInput) {
    updateEvent(id: $id, startedAt: $startedAt, endedAt: $endedAt, feedMeta: $feedMeta, sleepMeta: $sleepMeta, diaperMeta: $diaperMeta, noteMeta: $noteMeta) {
      id type startedAt endedAt metadata
    }
  }
`;

const DELETE_EVENT = `
  mutation DeleteEvent($id: String!) { deleteEvent(id: $id) }
`;

const buildMeta = (
  type: string,
  args: Record<string, unknown>
): Record<string, unknown> => {
  switch (type) {
    case "feed": {
      return {
        ...(args.method ? { method: args.method } : {}),
        ...(args.side ? { side: args.side } : {}),
        ...(args.amountMl ? { amountMl: args.amountMl } : {}),
        ...(args.foodDesc ? { foodDesc: args.foodDesc } : {}),
      };
    }
    case "sleep": {
      return {
        ...(args.location ? { location: args.location } : {}),
        ...(args.quality ? { quality: args.quality } : {}),
      };
    }
    case "diaper": {
      return {
        ...(args.wet === undefined ? {} : { wet: args.wet }),
        ...(args.soiled === undefined ? {} : { soiled: args.soiled }),
        ...(args.color ? { color: args.color } : {}),
        ...(args.notes ? { notes: args.notes } : {}),
      };
    }
    case "note": {
      return args.text ? { text: args.text } : {};
    }
    default: {
      return {};
    }
  }
};

export const registerEventTools = (
  server: McpServer,
  getToken: () => string
) => {
  server.tool(
    "log_event",
    "Log a baby event (feed, sleep, diaper, or note). Provide type-specific metadata fields alongside the event.",
    {
      amountMl: z.number().optional().describe("Amount in milliliters"),
      babyId: z.string().describe("UUID of the baby"),
      color: z.enum(["yellow", "green", "brown", "black", "red"]).optional(),
      endedAt: z.string().optional().describe("ISO timestamp when event ended"),
      foodDesc: z.string().optional(),
      location: z
        .enum(["crib", "bassinet", "held", "carrier", "other"])
        .optional(),
      method: z
        .enum(["breast", "bottle", "solid"])
        .optional()
        .describe("Feed method (required for feed events)"),
      notes: z.string().optional(),
      quality: z.enum(["good", "restless", "poor"]).optional(),
      side: z.enum(["left", "right", "both"]).optional(),
      soiled: z.boolean().optional(),
      startedAt: z
        .string()
        .optional()
        .describe("ISO timestamp, defaults to now"),
      text: z
        .string()
        .optional()
        .describe("Note text (required for note events)"),
      type: z.enum(["feed", "sleep", "diaper", "note"]),
      wet: z.boolean().optional(),
    },
    async (args) => {
      const metaKey = `${args.type}Meta`;
      const meta = buildMeta(args.type, args);
      const variables: Record<string, unknown> = {
        babyId: args.babyId,
        endedAt: args.endedAt,
        startedAt: args.startedAt,
        type: args.type,
        [metaKey]: Object.keys(meta).length > 0 ? meta : undefined,
      };

      const data = await gqlRequest<{ logEvent: unknown }>(
        getToken(),
        LOG_EVENT,
        variables
      );
      return {
        content: [
          { text: JSON.stringify(data.logEvent), type: "text" as const },
        ],
      };
    }
  );

  server.tool(
    "get_recent_events",
    "Get recent events for a baby. Returns newest first.",
    {
      babyId: z.string().describe("UUID of the baby"),
      limit: z.number().optional().describe("Max events to return, default 20"),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .optional()
        .describe("Filter by event type"),
    },
    async (args) => {
      const data = await gqlRequest<{ recentEvents: unknown }>(
        getToken(),
        GET_RECENT_EVENTS,
        args
      );
      return {
        content: [
          {
            text: JSON.stringify(data.recentEvents),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.tool(
    "get_last_event",
    "Get the most recent event for a baby. Useful for 'when was the last feed?' questions.",
    {
      babyId: z.string().describe("UUID of the baby"),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .optional()
        .describe("Filter by event type"),
    },
    async (args) => {
      const data = await gqlRequest<{ lastEvent: unknown }>(
        getToken(),
        GET_LAST_EVENT,
        args
      );
      return {
        content: [
          {
            text: JSON.stringify(data.lastEvent),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.tool(
    "update_event",
    "Update an existing event. Only provide fields that need changing.",
    {
      amountMl: z.number().optional(),
      color: z.enum(["yellow", "green", "brown", "black", "red"]).optional(),
      endedAt: z.string().optional(),
      foodDesc: z.string().optional(),
      id: z.string().describe("UUID of the event to update"),
      location: z
        .enum(["crib", "bassinet", "held", "carrier", "other"])
        .optional(),
      method: z.enum(["breast", "bottle", "solid"]).optional(),
      notes: z.string().optional(),
      quality: z.enum(["good", "restless", "poor"]).optional(),
      side: z.enum(["left", "right", "both"]).optional(),
      soiled: z.boolean().optional(),
      startedAt: z.string().optional(),
      text: z.string().optional(),
      type: z
        .enum(["feed", "sleep", "diaper", "note"])
        .optional()
        .describe("Event type (needed to know which metadata to update)"),
      wet: z.boolean().optional(),
    },
    async (args) => {
      const variables: Record<string, unknown> = {
        endedAt: args.endedAt,
        id: args.id,
        startedAt: args.startedAt,
      };

      if (args.type) {
        const metaKey = `${args.type}Meta`;
        const meta = buildMeta(args.type, args);
        if (Object.keys(meta).length > 0) {
          variables[metaKey] = meta;
        }
      }

      const data = await gqlRequest<{ updateEvent: unknown }>(
        getToken(),
        UPDATE_EVENT,
        variables
      );
      return {
        content: [
          { text: JSON.stringify(data.updateEvent), type: "text" as const },
        ],
      };
    }
  );

  server.tool(
    "delete_event",
    "Delete an event by ID.",
    {
      id: z.string().describe("UUID of the event to delete"),
    },
    async (args) => {
      await gqlRequest(getToken(), DELETE_EVENT, { id: args.id });
      return {
        content: [
          { text: JSON.stringify({ success: true }), type: "text" as const },
        ],
      };
    }
  );
};
