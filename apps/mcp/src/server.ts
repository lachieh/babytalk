import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerCodeModeTools } from "./code-mode/code-tools";
import { NodeVmExecutor } from "./code-mode/executor";
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

  // Individual tools (for simple MCP clients)
  registerHouseholdTools(server, getToken);
  registerBabyTools(server, getToken);
  registerEventTools(server, getToken);
  registerResources(server, getToken);
  registerPrompts(server);

  // Code mode tools (search_api + execute_code for token efficiency)
  const executor = new NodeVmExecutor({ timeout: 10_000 });
  registerCodeModeTools(server, getToken, executor);

  return server;
};
