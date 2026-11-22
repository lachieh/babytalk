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

/* Which session is current, as an opaque value replaced on every sign-in
 * and sign-out (in any tab). A request or refresh belongs to the session
 * current when it started; once that is no longer the current one, its
 * result is void: it stores no credentials and is not retried. Never a time,
 * so a clock that moves cannot confuse it. */
const SESSION_KEY = "bubsie_session";

const currentSession = () => localStorage.getItem(SESSION_KEY) ?? "";

const startNewSession = () => {
  localStorage.setItem(SESSION_KEY, crypto.randomUUID());
};

/** Store a new sign-in's credentials: every sign-in path goes through here. */
export const storeSession = (token: string, refreshToken: string) => {
  startNewSession();
  localStorage.setItem("bubsie_token", token);
  localStorage.setItem("bubsie_refresh_token", refreshToken);
};

/** End the session on this device: every sign-out path goes through here. */
export const signOut = () => {
  localStorage.removeItem("bubsie_token");
  localStorage.removeItem("bubsie_refresh_token");
  startNewSession();
};

/** A refresh shared by the callers of one session. */
let refreshing: { session: string; outcome: Promise<RefreshOutcome> } | null =
  null;

/* Bounds on a refresh. A tab that cannot get the refresh lock in time does
 * not refresh on its own: two tabs rotating the same refresh token at once
 * would see the loser's rotation rejected and sign out. It keeps the session
 * and its request fails as retryable, like any outage. */
const REFRESH_LOCK_WAIT_MS = 10_000;
const REFRESH_REQUEST_MS = 10_000;

/** An abort signal that fires after `ms` (AbortSignal.timeout needs Safari
 * 16 and is not driven by fake timers). */
const deadline = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { clear: () => clearTimeout(timer), signal: controller.signal };
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

/** One refresh at a time across tabs, waiting a bounded time for the lock. */
const withRefreshLock = async (
  task: () => Promise<RefreshOutcome>
): Promise<RefreshOutcome> => {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return task();
  const wait = deadline(REFRESH_LOCK_WAIT_MS);
  try {
    return (await locks.request(
      "bubsie-session-refresh",
      { signal: wait.signal },
      () => {
        wait.clear();
        return task();
      }
    )) as RefreshOutcome;
  } catch (error) {
    if (wait.signal.aborted) return "unavailable";
    throw error;
  } finally {
    wait.clear();
  }
};

const tryRefresh = async (
  apiUrl: string,
  used: string,
  session: string
): Promise<RefreshOutcome> => {
  // Settled while waiting: signed out, or another tab already refreshed.
  const settled = (): RefreshOutcome | null => {
    if (currentSession() !== session) return "signed-out";
    return getRefreshToken() === used ? null : "refreshed";
  };
  const before = settled();
  if (before) return before;

  // The request and its body together are bounded, so the lock is too.
  const limit = deadline(REFRESH_REQUEST_MS);
  let res: Response;
  let json: Awaited<ReturnType<typeof readJson>>;
  try {
    res = await fetch(apiUrl, {
      body: JSON.stringify({
        query: REFRESH_TOKEN_MUTATION,
        variables: { refreshToken: used },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: limit.signal,
    });
    json = await readJson(res);
  } catch {
    return "unavailable";
  } finally {
    limit.clear();
  }
  if (limit.signal.aborted) return "unavailable";
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

const refreshOnce = (apiUrl: string, session: string) => {
  const used = getRefreshToken();
  if (!used) return Promise.resolve<RefreshOutcome>("rejected");
  if (refreshing?.session !== session) {
    // Read by the cleanup below, once the refresh has settled.
    let outcome: Promise<RefreshOutcome> | null = null;
    const run = async () => {
      try {
        return await withRefreshLock(() => tryRefresh(apiUrl, used, session));
      } finally {
        if (refreshing?.outcome === outcome) refreshing = null;
      }
    };
    outcome = run();
    refreshing = { outcome, session };
  }
  return refreshing.outcome;
};

/** The one place a refresh turns into a result for its caller: however the
 * refresh ended, a session that is no longer current is "signed-out".
 * `attempt: false` is for a caller that already refreshed and was refused
 * again, which counts as rejected. */
const refreshFor = async (
  session: string,
  apiUrl: string,
  attempt: boolean
): Promise<RefreshOutcome> => {
  const outcome = attempt ? await refreshOnce(apiUrl, session) : "rejected";
  return currentSession() === session ? outcome : "signed-out";
};

/** Whether there is a session to continue. During an outage the session is
 * kept (requests fail and are retried); it ends only when the server rejects
 * the refresh token. */
export const restoreSession = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!getRuntimeConfig()) await loadRuntimeConfig();
  const session = currentSession();
  const token = getToken();
  if (!token && !getRefreshToken()) return false;

  // A malformed or legacy access token falls through to the refresh token.
  const payload = token ? tokenPayload(token) : null;
  if (payload?.exp && payload.exp * 1000 > Date.now() + 30_000) return true;

  const outcome = await refreshFor(session, getApiUrl(), true);
  if (outcome === "rejected") signOut();
  const hasCredentials = Boolean(getToken() || getRefreshToken());
  return (
    hasCredentials && (outcome === "refreshed" || outcome === "unavailable")
  );
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
  const session = currentSession();
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
    const outcome = await refreshFor(session, apiUrl, !hasRetried);
    if (outcome === "signed-out") {
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
