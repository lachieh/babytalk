import { createGraphQLError } from "graphql-yoga";

/* Errors a resolver means the client to see. Anything else thrown is
 * unexpected: the server masks it as "Unexpected error." (code
 * INTERNAL_SERVER_ERROR), and clients treat it as worth retrying.
 *
 * The code is the contract, not the message: a client resends a request
 * after anything but a REFUSED (or a malformed request), and refreshes its
 * session after UNAUTHENTICATED. */

/** Understood and refused: sending the same request again will not help. */
export const refuse = (message: string) =>
  createGraphQLError(message, { extensions: { code: "REFUSED" } });

export const notAuthenticated = () =>
  createGraphQLError("Not authenticated", {
    extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
  });

/** A device asked to register a pairing code that already exists here. */
export const codeTaken = () =>
  createGraphQLError("Device code already in use", {
    extensions: { code: "CODE_TAKEN" },
  });
