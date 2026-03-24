import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthUser } from "../auth";
import {
  and,
  buildMetadata,
  db,
  desc,
  eq,
  events,
  formatEvent,
  requireBabyAccess,
  requireHousehold,
} from "../helpers";

export const registerEventTools = (
  server: McpServer,
  getUser: () => AuthUser
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
      const user = getUser();
      const { householdId, userId } = await requireHousehold(user);
      await requireBabyAccess(args.babyId, householdId);

      const metaFields: Record<string, unknown> = {};
      if (args.type === "feed") {
        if (args.method) metaFields.method = args.method;
        if (args.side) metaFields.side = args.side;
        if (args.amountMl) metaFields.amountMl = args.amountMl;
        if (args.foodDesc) metaFields.foodDesc = args.foodDesc;
      } else if (args.type === "sleep") {
        if (args.location) metaFields.location = args.location;
        if (args.quality) metaFields.quality = args.quality;
      } else if (args.type === "diaper") {
        if (args.wet !== undefined) metaFields.wet = args.wet;
        if (args.soiled !== undefined) metaFields.soiled = args.soiled;
        if (args.color) metaFields.color = args.color;
        if (args.notes) metaFields.notes = args.notes;
      } else if (args.type === "note" && args.text) {
        metaFields.text = args.text;
      }

      const metadata = buildMetadata(args.type, metaFields);

      const [event] = await db
        .insert(events)
        .values({
          babyId: args.babyId,
          endedAt: args.endedAt ? new Date(args.endedAt) : null,
          loggedById: userId,
          metadata,
          startedAt: args.startedAt ? new Date(args.startedAt) : new Date(),
          type: args.type,
        })
        .returning();

      return {
        content: [
          { text: JSON.stringify(formatEvent(event)), type: "text" as const },
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
      const user = getUser();
      const { householdId } = await requireHousehold(user);
      await requireBabyAccess(args.babyId, householdId);

      const conditions = [eq(events.babyId, args.babyId)];
      if (args.type) conditions.push(eq(events.type, args.type));

      const rows = await db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startedAt))
        .limit(args.limit ?? 20);

      return {
        content: [
          {
            text: JSON.stringify(rows.map(formatEvent)),
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
      const user = getUser();
      const { householdId } = await requireHousehold(user);
      await requireBabyAccess(args.babyId, householdId);

      const conditions = [eq(events.babyId, args.babyId)];
      if (args.type) conditions.push(eq(events.type, args.type));

      const [event] = await db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startedAt))
        .limit(1);

      if (!event) {
        return { content: [{ text: "null", type: "text" as const }] };
      }

      return {
        content: [
          { text: JSON.stringify(formatEvent(event)), type: "text" as const },
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
      wet: z.boolean().optional(),
    },
    async (args) => {
      const user = getUser();
      const { householdId } = await requireHousehold(user);

      const [existing] = await db
        .select()
        .from(events)
        .where(eq(events.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Event not found");
      await requireBabyAccess(existing.babyId, householdId);

      const updates: Record<string, unknown> = {};
      if (args.startedAt) updates.startedAt = new Date(args.startedAt);
      if (args.endedAt) updates.endedAt = new Date(args.endedAt);

      const metaFields: Record<string, unknown> = {};
      const metaKeys = [
        "method",
        "side",
        "amountMl",
        "foodDesc",
        "location",
        "quality",
        "wet",
        "soiled",
        "color",
        "notes",
        "text",
      ] as const;
      for (const key of metaKeys) {
        if (args[key] !== undefined) metaFields[key] = args[key];
      }
      if (Object.keys(metaFields).length > 0) {
        updates.metadata = buildMetadata(existing.type, metaFields);
      }

      if (Object.keys(updates).length === 0) {
        return {
          content: [
            {
              text: JSON.stringify(formatEvent(existing)),
              type: "text" as const,
            },
          ],
        };
      }

      const [updated] = await db
        .update(events)
        .set(updates)
        .where(eq(events.id, args.id))
        .returning();

      return {
        content: [
          { text: JSON.stringify(formatEvent(updated)), type: "text" as const },
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
      const user = getUser();
      const { householdId } = await requireHousehold(user);

      const [existing] = await db
        .select()
        .from(events)
        .where(eq(events.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Event not found");
      await requireBabyAccess(existing.babyId, householdId);

      await db.delete(events).where(eq(events.id, args.id));

      return {
        content: [
          { text: JSON.stringify({ success: true }), type: "text" as const },
        ],
      };
    }
  );
};
