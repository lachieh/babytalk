import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPrompts } from "./prompts/log-event";
import { registerResources } from "./resources/baby-summary";
import { registerBabyTools } from "./tools/babies";
import { registerEventTools } from "./tools/events";
import { registerHouseholdTools } from "./tools/household";

export const createServer = (getToken: () => string): McpServer => {
  const server = new McpServer({
    name: "babytalk",
    version: "0.1.0",
  });

  registerHouseholdTools(server, getToken);
  registerBabyTools(server, getToken);
  registerEventTools(server, getToken);
  registerResources(server, getToken);
  registerPrompts(server);

  return server;
};
