import {
  getApiUrl,
  getRuntimeConfig,
  loadRuntimeConfig,
} from "@/lib/runtime-config";

const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("babytalk_token");

const getRefreshToken = () =>
  typeof window === "undefined"
    ? null
    : localStorage.getItem("babytalk_refresh_token");

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      refreshToken
      token
    }
  }
`;

let refreshPromise: Promise<boolean> | null = null;

function isAuthError(message: string, status: number): boolean {
  if (status === 401) return true;
  if (message === "Not authenticated") return true;
  if (message.includes("jwt")) return true;
  return false;
}

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
        localStorage.setItem("babytalk_token", next.token);
        localStorage.setItem("babytalk_refresh_token", next.refreshToken);
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

  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    if (payload.exp && payload.exp * 1000 > Date.now() + 30_000) return true;
  } catch {
    // Let the refresh token recover malformed or legacy access tokens.
  }

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

  const json = await res.json();
  if (json.errors) {
    const [firstError] = json.errors;
    const { message } = firstError;

    if (
      !hasRetried &&
      typeof window !== "undefined" &&
      isAuthError(message, res.status) &&
      (await refreshSession(apiUrl))
    ) {
      return gqlRequest<T>(query, variables, true);
    }

    if (typeof window !== "undefined" && isAuthError(message, res.status)) {
      localStorage.removeItem("babytalk_token");
      localStorage.removeItem("babytalk_refresh_token");
      const returnTo = window.location.pathname + window.location.search;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
      throw new Error("Session expired — redirecting to login");
    }

    throw new Error(message);
  }
  return json.data as T;
};
