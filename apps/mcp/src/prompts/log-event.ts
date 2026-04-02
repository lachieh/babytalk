import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const registerPrompts = (server: McpServer) => {
  server.prompt(
    "log-event",
    "Template for logging a baby event. Use this when a voice assistant needs to log a feed, sleep, diaper, or note.",
    {
      details: z
        .string()
        .describe("Natural language description, e.g. 'bottle feed 4oz'"),
      type: z.enum(["feed", "sleep", "diaper", "note"]).describe("Event type"),
    },
    (args) => ({
      messages: [
        {
          content: {
            text: `Log a ${args.type} event: ${args.details}.\n\nFirst call list_babies to get the baby ID, then call log_event with the appropriate fields. Convert oz to ml (1 oz = 30 ml). Use the current time if no time is specified.`,
            type: "text" as const,
          },
          role: "user" as const,
        },
      ],
    })
  );
};
