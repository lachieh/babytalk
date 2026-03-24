import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { AuthUser } from "./auth";
import { verifyToken } from "./auth";
import { config } from "./env";
import { createServer } from "./server";

let currentUser: AuthUser | null = null;

// In stdio mode, authenticate via BABYTALK_MCP_TOKEN env var
if (config.token) {
  currentUser = await verifyToken(config.token);
  if (!currentUser) {
    console.error("Invalid BABYTALK_MCP_TOKEN");
    process.exit(1);
  }
}

const getUser = (): AuthUser => {
  if (!currentUser)
    throw new Error("Not authenticated. Set BABYTALK_MCP_TOKEN env var.");
  return currentUser;
};

const server = createServer(getUser);
const transport = new StdioServerTransport();

await server.connect(transport);
