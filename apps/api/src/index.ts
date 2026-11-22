import { registerZPages } from "@bubsie/zpages/hono";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context";
import { config } from "./env";
import { createApiYoga } from "./yoga";
import { zpages } from "./zpages";

const app = new Hono();

app.use(
  "/graphql",
  cors({
    credentials: true,
    origin: (origin) => {
      if (origin === config.webUrl) return origin;
      return null;
    },
  })
);

registerZPages(app, zpages);

const yoga = createApiYoga(createContext);

app.on(["GET", "POST"], "/graphql", async (c) => {
  const response = await yoga.fetch(c.req.raw, {});
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
  });
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`API listening on port ${config.port}`);
});
