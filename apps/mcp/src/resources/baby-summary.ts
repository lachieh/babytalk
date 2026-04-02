import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { gqlRequest } from "../graphql";

const SUMMARY_QUERY = `
  query {
    myBabies { id name birthDate }
    myHousehold { id }
  }
`;

const RECENT_EVENTS = `
  query RecentEvents($babyId: String!, $limit: Int) {
    recentEvents(babyId: $babyId, limit: $limit) {
      id type startedAt
    }
  }
`;

export const registerResources = (
  server: McpServer,
  getToken: () => string
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
      const token = getToken();
      const data = await gqlRequest<{
        myBabies: { birthDate: string; id: string; name: string }[];
        myHousehold: { id: string } | null;
      }>(token, SUMMARY_QUERY);

      if (!data.myHousehold) {
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

      if (data.myBabies.length === 0) {
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

      for (const baby of data.myBabies) {
        const birth = new Date(baby.birthDate);
        const days = Math.floor((Date.now() - birth.getTime()) / 86_400_000);
        const weeks = Math.floor(days / 7);
        const age =
          weeks > 0
            ? `${String(weeks)} weeks, ${String(days % 7)} days`
            : `${String(days)} days`;

        lines.push(`${baby.name} (ID: ${baby.id})`);
        lines.push(`  Age: ${age} (born ${baby.birthDate})`);

        const eventsData = await gqlRequest<{
          recentEvents: { id: string; startedAt: string; type: string }[];
        }>(token, RECENT_EVENTS, { babyId: baby.id, limit: 50 });

        const todayCounts: Record<string, number> = {};
        for (const event of eventsData.recentEvents) {
          if (new Date(event.startedAt) >= today) {
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
