import { registerZPages } from "@babytalk/zpages/hono";
import { serve } from "@hono/node-server";
import { createYoga } from "graphql-yoga";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context";
import { config } from "./env";
import { schema } from "./schema/index";
import { zpages } from "./zpages";

const app = new Hono();

app.use(
  "/graphql",
  cors({
    credentials: true,
    origin: config.web_url,
  })
);

registerZPages(app, zpages);

const yoga = createYoga({ context: createContext, schema });

app.on(["GET", "POST"], "/graphql", async (c) => {
  const response = await yoga.fetch(c.req.raw, {});
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
  });
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`API running on http://localhost:${config.port}/graphql`);
});
