import { createYoga } from "graphql-yoga";
import type { YogaInitialContext } from "graphql-yoga";

import type { Context } from "./context";
import { schema } from "./schema/index";

/** The GraphQL server. Errors a resolver means the client to see are
 * `GraphQLError`s (see schema/errors.ts) and pass through; anything else is
 * unexpected and reaches the client only as "Unexpected error.", so database
 * and library messages stay on the server. */
export const createApiYoga = (
  context: (initial: YogaInitialContext) => Promise<Context>
) => createYoga({ context, schema });
