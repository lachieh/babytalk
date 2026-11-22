import {
  getApiUrl,
  getRuntimeConfig,
  loadRuntimeConfig,
} from "./runtime-config";

const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("bubsie_token");

const getRefreshToken = () =>
  typeof window === "undefined"
    ? null
    : localStorage.getItem("bubsie_refresh_token");

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      refreshToken
      token
    }
  }
`;

let refreshPromise: Promise<boolean> | null = null;

/** The server understood the request and refused it, so sending it again
 * will not help. Decided by the error's code (see apps/api/src/schema/
 * errors.ts), never by its message. Network failures, server errors and
 * session problems are plain `Error`s: worth sending again. */
export class RequestRefusedError extends Error {
  override name = "RequestRefusedError";
}

const REFUSAL_CODES = new Set([
  "REFUSED",
  "BAD_USER_INPUT",
  "GRAPHQL_PARSE_FAILED",
  "GRAPHQL_VALIDATION_FAILED",
]);

interface GraphQLErrorShape {
  message?: unknown;
  extensions?: { code?: unknown };
}

const readJson = async (
  res: Response
): Promise<{ data?: unknown; errors?: GraphQLErrorShape[] } | null> => {
  try {
    const body: unknown = await res.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
};

const tokenPayload = (token: string): { exp?: number; sub?: string } | null => {
  try {
    const part = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(part)) as { exp?: number; sub?: string };
  } catch {
    return null;
  }
};

/** The signed-in user, read from the access token without a request. */
export const currentUserId = (): string | null => {
  const token = getToken();
  const sub = token ? tokenPayload(token)?.sub : undefined;
  return typeof sub === "string" ? sub : null;
};

export const currentAuthorization = (): string | null => {
  const token = getToken();
  return token ? `Bearer ${token}` : null;
};

const isAuthFailure = (status: number, errors: GraphQLErrorShape[]) =>
  status === 401 ||
  errors.some(
    (e) =>
      e.extensions?.code === "UNAUTHENTICATED" ||
      e.message === "Not authenticated"
  );

const refreshSession = (apiUrl: string): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(apiUrl, {
          body: JSON.stringify({
            query: REFRESH_TOKEN_MUTATION,
            variables: { refreshToken },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const json = await res.json();
        const next = json.data?.refreshToken;
        if (!res.ok || !next?.token || !next?.refreshToken) return false;
        localStorage.setItem("bubsie_token", next.token);
        localStorage.setItem("bubsie_refresh_token", next.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

export const restoreSession = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!getRuntimeConfig()) await loadRuntimeConfig();
  const token = getToken();
  const refreshToken = getRefreshToken();
  if (!token && !refreshToken) return false;
  if (!token) return refreshSession(getApiUrl());

  // A malformed or legacy access token falls through to the refresh token.
  const payload = tokenPayload(token);
  if (payload?.exp && payload.exp * 1000 > Date.now() + 30_000) return true;

  return refreshSession(getApiUrl());
};
export const gqlRequest = async <T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  hasRetried = false
): Promise<T> => {
  // Ensure runtime config is loaded before the first request (client-side only)
  if (typeof window !== "undefined" && !getRuntimeConfig()) {
    await loadRuntimeConfig();
  }
  const apiUrl = getApiUrl();
  const token = getToken();
  const res = await fetch(apiUrl, {
    body: JSON.stringify({ query, variables }),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    method: "POST",
  });

  const json = await readJson(res);
  const errors = Array.isArray(json?.errors) ? json.errors : [];

  if (typeof window !== "undefined" && isAuthFailure(res.status, errors)) {
    if (!hasRetried && (await refreshSession(apiUrl))) {
      return gqlRequest<T>(query, variables, true);
    }
    localStorage.removeItem("bubsie_token");
    localStorage.removeItem("bubsie_refresh_token");
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
    throw new Error("Session expired — redirecting to login");
  }

  const [first] = errors;
  const message =
    typeof first?.message === "string" ? first.message : `HTTP ${res.status}`;
  if (errors.some((e) => REFUSAL_CODES.has(String(e.extensions?.code)))) {
    throw new RequestRefusedError(message);
  }
  if (!res.ok || !json || errors.length > 0) throw new Error(message);
  return json.data as T;
};
