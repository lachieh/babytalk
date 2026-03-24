import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { gqlRequest } from "../graphql";

const MY_BABIES = `
  query { myBabies { id name birthDate birthWeightG } }
`;

const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!, $birthWeightG: Int) {
    addBaby(name: $name, birthDate: $birthDate, birthWeightG: $birthWeightG) {
      id name birthDate birthWeightG
    }
  }
`;

export const registerBabyTools = (
  server: McpServer,
  getToken: () => string
) => {
  server.tool(
    "list_babies",
    "List all babies in your household.",
    {},
    async () => {
      const data = await gqlRequest<{
        myBabies: unknown[];
      }>(getToken(), MY_BABIES);
      return {
        content: [
          { text: JSON.stringify(data.myBabies), type: "text" as const },
        ],
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
      const data = await gqlRequest<{ addBaby: unknown }>(
        getToken(),
        ADD_BABY,
        args
      );
      return {
        content: [
          { text: JSON.stringify(data.addBaby), type: "text" as const },
        ],
      };
    }
  );
};
