import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./env";
import { createServer } from "./server";

if (!config.token) {
  console.error("BABYTALK_MCP_TOKEN env var is required for stdio mode.");
  process.exit(1);
}

const { token } = config;
const getToken = (): string => token;

const server = createServer(getToken);
const transport = new StdioServerTransport();

await server.connect(transport);
