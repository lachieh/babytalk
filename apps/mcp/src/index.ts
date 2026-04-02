import { config } from "./env";

if (config.mode === "stdio") {
  const { StdioServerTransport } =
    await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createServer } = await import("./server");

  const { token } = config;
  const server = createServer(() => token);
  const transport = new StdioServerTransport();

  await server.connect(transport);
} else {
  const { createServer: createHttpServer } = await import("node:http");
  const { StreamableHTTPServerTransport } =
    await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { createServer } = await import("./server");

  const { port } = config;

  const sessions = new Map<
    string,
    {
      server: ReturnType<typeof createServer>;
      token: string;
      transport: InstanceType<typeof StreamableHTTPServerTransport>;
    }
  >();

  const httpServer = createHttpServer(async (req, res) => {
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

    const url = new URL(req.url ?? "/", `http://localhost:${String(port)}`);
    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.writeHead(401);
      res.end("Missing Authorization header");
      return;
    }
    const token = authHeader.slice(7);

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        await session.transport.handleRequest(req, res);
        return;
      }
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const mcpServer = createServer(() => token);

    await mcpServer.connect(transport);

    const originalOnclose = transport.onclose;
    // eslint-disable-next-line unicorn/prefer-add-event-listener -- MCP SDK transport uses setter, not EventTarget
    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
      originalOnclose?.();
    };

    await transport.handleRequest(req, res);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, {
        server: mcpServer,
        token,
        transport,
      });
    }
  });

  httpServer.listen(port, () => {
    console.log(
      `BabyTalk MCP server listening on http://localhost:${String(port)}/mcp`
    );
  });
}
