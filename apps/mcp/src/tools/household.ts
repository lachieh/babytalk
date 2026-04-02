import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { gqlRequest } from "../graphql";

const MY_HOUSEHOLD = `
  query { myHousehold { id inviteCode createdAt } }
`;

const CREATE_HOUSEHOLD = `
  mutation { createHousehold { id inviteCode } }
`;

const JOIN_HOUSEHOLD = `
  mutation JoinHousehold($inviteCode: String!) {
    joinHousehold(inviteCode: $inviteCode) { id inviteCode }
  }
`;

export const registerHouseholdTools = (
  server: McpServer,
  getToken: () => string
) => {
  server.tool(
    "get_household",
    "Get your current household info including the invite code for sharing with your partner.",
    {},
    async () => {
      const data = await gqlRequest<{
        myHousehold: unknown | null;
      }>(getToken(), MY_HOUSEHOLD);

      if (!data.myHousehold) {
        return {
          content: [
            {
              text: "No household. Use create_household to create one.",
              type: "text" as const,
            },
          ],
        };
      }

      return {
        content: [
          {
            text: JSON.stringify(data.myHousehold),
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
      const data = await gqlRequest<{ createHousehold: unknown }>(
        getToken(),
        CREATE_HOUSEHOLD
      );
      return {
        content: [
          {
            text: JSON.stringify(data.createHousehold),
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
      const data = await gqlRequest<{ joinHousehold: unknown }>(
        getToken(),
        JOIN_HOUSEHOLD,
        args
      );
      return {
        content: [
          {
            text: JSON.stringify(data.joinHousehold),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
