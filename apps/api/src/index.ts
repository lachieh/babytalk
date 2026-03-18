import { createServer } from "node:http";

import { createYoga } from "graphql-yoga";

import { createContext } from "./context.js";
import { handleHealthRoutes } from "./health.js";
import { schema } from "./schema/index.js";

const yoga = createYoga({
  context: createContext,
  cors: {
    credentials: true,
    origin: process.env.WEB_URL || "http://localhost:3000",
  },
  schema,
});

const server = createServer((req, res) => {
  if (handleHealthRoutes(req, res)) {
    return;
  }
  yoga(req, res);
});
const port = Number(process.env.PORT || 4000);

server.listen(port, () => {
  console.log(`API running on http://localhost:${port}/graphql`);
});
