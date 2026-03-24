import { createServer as createHttpServer } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { AuthUser } from "./auth";
import { verifyToken } from "./auth";
import { config } from "./env";
import { createServer } from "./server";

// Per-session state: map sessionId -> { server, transport, user }
const sessions = new Map<
  string,
  {
    server: ReturnType<typeof createServer>;
    transport: StreamableHTTPServerTransport;
    user: AuthUser;
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

  // Authenticate via Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401);
    res.end("Missing Authorization header");
    return;
  }
  const token = authHeader.slice(7);
  const user = await verifyToken(token);
  if (!user) {
    res.writeHead(401);
    res.end("Invalid token");
    return;
  }

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

  const mcpServer = createServer(() => user);

  const cleanup = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };
  Object.defineProperty(transport, "onclose", { value: cleanup });

  await mcpServer.connect(transport);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, {
      server: mcpServer,
      transport,
      user,
    });
  }

  await transport.handleRequest(req, res);
});

httpServer.listen(config.port, () => {
  console.log(
    `BabyTalk MCP server listening on http://localhost:${String(config.port)}/mcp`
  );
});
