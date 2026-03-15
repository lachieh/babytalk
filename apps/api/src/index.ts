import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema/index.js";
import { createContext } from "./context.js";

const yoga = createYoga({
  schema,
  context: createContext,
  cors: {
    origin: process.env.WEB_URL || "http://localhost:3000",
    credentials: true,
  },
});

const server = createServer(yoga);
const port = Number(process.env.PORT || 4000);

server.listen(port, () => {
  console.log(`API running on http://localhost:${port}/graphql`);
});
