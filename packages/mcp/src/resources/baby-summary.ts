import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AuthUser } from "../auth";
import { and, babies, db, desc, eq, events, users } from "../helpers";

export const registerResources = (
  server: McpServer,
  getUser: () => AuthUser
) => {
  server.resource(
    "baby-summary",
    "baby://summary",
    {
      description:
        "Summary of all babies in the household with ages and today's event counts.",
      mimeType: "text/plain",
    },
    async () => {
      const user = getUser();
      const [row] = await db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);

      if (!row?.householdId) {
        return {
          contents: [
            {
              mimeType: "text/plain",
              text: "No household set up yet.",
              uri: "baby://summary",
            },
          ],
        };
      }

      const babyRows = await db
        .select()
        .from(babies)
        .where(eq(babies.householdId, row.householdId));

      if (babyRows.length === 0) {
        return {
          contents: [
            {
              mimeType: "text/plain",
              text: "No babies registered yet.",
              uri: "baby://summary",
            },
          ],
        };
      }

      const lines: string[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const baby of babyRows) {
        const birth = new Date(baby.birthDate);
        const days = Math.floor((Date.now() - birth.getTime()) / 86_400_000);
        const weeks = Math.floor(days / 7);
        const age =
          weeks > 0
            ? `${String(weeks)} weeks, ${String(days % 7)} days`
            : `${String(days)} days`;

        lines.push(`${baby.name} (ID: ${baby.id})`);
        lines.push(`  Age: ${age} (born ${baby.birthDate})`);

        // Today's event counts
        const todayEvents = await db
          .select()
          .from(events)
          .where(and(eq(events.babyId, baby.id)))
          .orderBy(desc(events.startedAt));

        const todayCounts: Record<string, number> = {};
        for (const event of todayEvents) {
          if (event.startedAt >= today) {
            todayCounts[event.type] = (todayCounts[event.type] ?? 0) + 1;
          }
        }

        const countStr = Object.entries(todayCounts)
          .map(([type, count]) => `${type}: ${String(count)}`)
          .join(", ");
        lines.push(`  Today: ${countStr || "no events yet"}`);
        lines.push("");
      }

      return {
        contents: [
          {
            mimeType: "text/plain",
            text: lines.join("\n"),
            uri: "baby://summary",
          },
        ],
      };
    }
  );
};
