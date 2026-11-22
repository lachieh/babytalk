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

/** What a refresh attempt established. Only "rejected" (the server refused
 * the refresh token) ends the session; "unavailable" (no network, server
 * error) keeps it, and the request is retried later. "signed-out" means the
 * person signed out while this was in flight: its result is void. */
type RefreshOutcome = "refreshed" | "rejected" | "unavailable" | "signed-out";

let refreshPromise: Promise<RefreshOutcome> | null = null;

/* Signing out (here, or in another tab) records when it happened. Anything
 * started before that, a refresh or a request's retry, is void afterwards. */
const SIGNED_OUT_AT_KEY = "bubsie_signed_out_at";

const signedOutSince = (startedAt: number) => {
  const at = Number(localStorage.getItem(SIGNED_OUT_AT_KEY) ?? 0);
  return at >= startedAt;
};

/** End the session on this device: every sign-out path goes through here. */
export const signOut = () => {
  localStorage.removeItem("bubsie_token");
  localStorage.removeItem("bubsie_refresh_token");
  localStorage.setItem(SIGNED_OUT_AT_KEY, String(Date.now()));
};

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

/** One refresh at a time across tabs: two tabs rotating the same refresh
 * token at once would see the loser's rotation rejected. */
const withRefreshLock = <T>(task: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks
    ? (navigator.locks.request(
        "bubsie-session-refresh",
        task
      ) as unknown as Promise<T>)
    : task();

const tryRefresh = async (
  apiUrl: string,
  used: string,
  startedAt: number
): Promise<RefreshOutcome> => {
  // Settled while waiting: signed out, or another tab already refreshed.
  const settled = (): RefreshOutcome | null => {
    if (signedOutSince(startedAt)) return "signed-out";
    return getRefreshToken() === used ? null : "refreshed";
  };
  const before = settled();
  if (before) return before;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      body: JSON.stringify({
        query: REFRESH_TOKEN_MUTATION,
        variables: { refreshToken: used },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    return "unavailable";
  }
  const json = await readJson(res);
  const after = settled();
  if (after) return after;

  const errors = Array.isArray(json?.errors) ? json.errors : [];
  const next = (json?.data as { refreshToken?: unknown } | undefined)
    ?.refreshToken as { refreshToken?: unknown; token?: unknown } | null;
  if (
    res.ok &&
    typeof next?.token === "string" &&
    typeof next.refreshToken === "string"
  ) {
    localStorage.setItem("bubsie_token", next.token);
    localStorage.setItem("bubsie_refresh_token", next.refreshToken);
    return "refreshed";
  }
  const refused =
    errors.some((e) => e.extensions?.code === "REFUSED") ||
    // An API that predates the refusal code answers a rejected token with
    // no session and no error.
    (res.ok && errors.length === 0 && next === null);
  return refused ? "rejected" : "unavailable";
};

const refreshSession = (
  apiUrl: string,
  startedAt: number
): Promise<RefreshOutcome> => {
  const used = getRefreshToken();
  if (!used) return Promise.resolve("rejected");
  refreshPromise ??= (async () => {
    try {
      return await withRefreshLock(() => tryRefresh(apiUrl, used, startedAt));
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

/** Whether there is a session to continue. During an outage the session is
 * kept (requests fail and are retried); it ends only when the server rejects
 * the refresh token. */
export const restoreSession = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!getRuntimeConfig()) await loadRuntimeConfig();
  const startedAt = Date.now();
  const token = getToken();
  if (!token && !getRefreshToken()) return false;

  // A malformed or legacy access token falls through to the refresh token.
  const payload = token ? tokenPayload(token) : null;
  if (payload?.exp && payload.exp * 1000 > Date.now() + 30_000) return true;

  const outcome = await refreshSession(getApiUrl(), startedAt);
  if (outcome === "rejected") signOut();
  return outcome === "refreshed" || outcome === "unavailable";
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
  const startedAt = Date.now();
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
    // A token just refreshed and still refused counts as rejected.
    const outcome = hasRetried
      ? "rejected"
      : await refreshSession(apiUrl, startedAt);
    if (outcome === "signed-out" || signedOutSince(startedAt)) {
      // The session this request belonged to has ended: no retry.
      throw new Error("Signed out");
    }
    if (outcome === "refreshed") return gqlRequest<T>(query, variables, true);
    if (outcome === "unavailable") {
      throw new Error("Session could not be refreshed; try again");
    }
    signOut();
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
