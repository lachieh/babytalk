import { randomBytes } from "node:crypto";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthUser } from "../auth";
import { db, eq, households, users } from "../helpers";

const generateInviteCode = (): string => randomBytes(4).toString("hex");

export const registerHouseholdTools = (
  server: McpServer,
  getUser: () => AuthUser
) => {
  server.tool(
    "get_household",
    "Get your current household info including the invite code for sharing with your partner.",
    {},
    async () => {
      const user = getUser();
      const [row] = await db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);

      if (!row?.householdId) {
        return {
          content: [
            {
              text: "No household. Use create_household to create one.",
              type: "text" as const,
            },
          ],
        };
      }

      const [household] = await db
        .select()
        .from(households)
        .where(eq(households.id, row.householdId))
        .limit(1);

      return {
        content: [
          {
            text: JSON.stringify({
              createdAt: household.createdAt.toISOString(),
              id: household.id,
              inviteCode: household.inviteCode,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.tool(
    "create_household",
    "Create a new household. You must create a household before adding babies or logging events.",
    {},
    async () => {
      const user = getUser();

      const [existing] = await db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);
      if (existing?.householdId) throw new Error("Already in a household");

      const [household] = await db
        .insert(households)
        .values({ inviteCode: generateInviteCode() })
        .returning();

      await db
        .update(users)
        .set({ householdId: household.id })
        .where(eq(users.id, user.sub));

      return {
        content: [
          {
            text: JSON.stringify({
              id: household.id,
              inviteCode: household.inviteCode,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.tool(
    "join_household",
    "Join an existing household using an invite code from your partner.",
    {
      inviteCode: z
        .string()
        .describe("8-character invite code from your partner"),
    },
    async (args) => {
      const user = getUser();

      const [existing] = await db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);
      if (existing?.householdId) throw new Error("Already in a household");

      const [household] = await db
        .select()
        .from(households)
        .where(eq(households.inviteCode, args.inviteCode))
        .limit(1);
      if (!household) throw new Error("Invalid invite code");

      await db
        .update(users)
        .set({ householdId: household.id })
        .where(eq(users.id, user.sub));

      return {
        content: [
          {
            text: JSON.stringify({
              id: household.id,
              inviteCode: household.inviteCode,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
