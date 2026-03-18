import { registerZPages } from "@babytalk/zpages/hono";
import { serve } from "@hono/node-server";
import { createYoga } from "graphql-yoga";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context.js";
import { schema } from "./schema/index.js";
import { zpages } from "./zpages.js";

const app = new Hono();

app.use(
  "/graphql",
  cors({
    credentials: true,
    origin: process.env.WEB_URL || "http://localhost:3000",
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

const port = Number(process.env.PORT || 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}/graphql`);
});
