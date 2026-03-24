import { createServer as createHttpServer } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { config } from "./env";
import { createServer } from "./server";

// Per-session state: map sessionId -> { server, transport, token }
const sessions = new Map<
  string,
  {
    server: ReturnType<typeof createServer>;
    token: string;
    transport: StreamableHTTPServerTransport;
  }
>();

const httpServer = createHttpServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only handle /mcp path
  const url = new URL(
    req.url ?? "/",
    `http://localhost:${String(config.port)}`
  );
  if (url.pathname !== "/mcp") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  // Extract Bearer token (passed through to GraphQL API for auth)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401);
    res.end("Missing Authorization header");
    return;
  }
  const token = authHeader.slice(7);

  // Check for existing session
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      await session.transport.handleRequest(req, res);
      return;
    }
  }

  // New session: create server + transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  const mcpServer = createServer(() => token);

  await mcpServer.connect(transport);

  // Override onclose after connect (SDK sets its own handler in connect)
  const originalOnclose = transport.onclose;
  // eslint-disable-next-line unicorn/prefer-add-event-listener -- MCP SDK transport uses setter, not EventTarget
  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
    originalOnclose?.();
  };

  await transport.handleRequest(req, res);

  // Store session after handleRequest (sessionId is set during first request)
  if (transport.sessionId) {
    sessions.set(transport.sessionId, {
      server: mcpServer,
      token,
      transport,
    });
  }
});

httpServer.listen(config.port, () => {
  console.log(
    `BabyTalk MCP server listening on http://localhost:${String(config.port)}/mcp`
  );
});
