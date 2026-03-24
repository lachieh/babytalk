import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthUser } from "../auth";
import { babies, db, eq, requireHousehold } from "../helpers";

export const registerBabyTools = (
  server: McpServer,
  getUser: () => AuthUser
) => {
  server.tool(
    "list_babies",
    "List all babies in your household.",
    {},
    async () => {
      const user = getUser();
      const { householdId } = await requireHousehold(user);

      const rows = await db
        .select()
        .from(babies)
        .where(eq(babies.householdId, householdId));

      const result = rows.map((b) => ({
        birthDate: b.birthDate,
        birthWeightG: b.birthWeightG,
        id: b.id,
        name: b.name,
      }));

      return {
        content: [{ text: JSON.stringify(result), type: "text" as const }],
      };
    }
  );

  server.tool(
    "add_baby",
    "Add a baby to your household.",
    {
      birthDate: z.string().describe("Birth date (YYYY-MM-DD)"),
      birthWeightG: z.number().optional().describe("Birth weight in grams"),
      name: z.string().describe("Baby's name"),
    },
    async (args) => {
      const user = getUser();
      const { householdId } = await requireHousehold(user);

      const [baby] = await db
        .insert(babies)
        .values({
          birthDate: args.birthDate,
          birthWeightG: args.birthWeightG ?? null,
          householdId,
          name: args.name,
        })
        .returning();

      return {
        content: [
          {
            text: JSON.stringify({
              birthDate: baby.birthDate,
              birthWeightG: baby.birthWeightG,
              id: baby.id,
              name: baby.name,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
