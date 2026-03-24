import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AuthUser } from "./auth";
import { registerPrompts } from "./prompts/log-event";
import { registerResources } from "./resources/baby-summary";
import { registerBabyTools } from "./tools/babies";
import { registerEventTools } from "./tools/events";
import { registerHouseholdTools } from "./tools/household";

export const createServer = (getUser: () => AuthUser): McpServer => {
  const server = new McpServer({
    name: "babytalk",
    version: "0.1.0",
  });

  registerHouseholdTools(server, getUser);
  registerBabyTools(server, getUser);
  registerEventTools(server, getUser);
  registerResources(server, getUser);
  registerPrompts(server);

  return server;
};
