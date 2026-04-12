import {
  getApiUrl,
  getRuntimeConfig,
  loadRuntimeConfig,
} from "@/lib/runtime-config";

const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("babytalk_token");

function isAuthError(message: string, status: number): boolean {
  if (status === 401) return true;
  if (message === "Not authenticated") return true;
  if (message.includes("jwt")) return true;
  return false;
}

export const gqlRequest = async <T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> => {
  // Ensure runtime config is loaded before the first request (client-side only)
  if (typeof window !== "undefined" && !getRuntimeConfig()) {
    await loadRuntimeConfig();
  }
  const token = getToken();
  const apiUrl = getApiUrl();
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

    // If the API says we're not authenticated, clear the stale token and redirect
    if (typeof window !== "undefined" && isAuthError(message, res.status)) {
      localStorage.removeItem("babytalk_token");
      const returnTo = window.location.pathname + window.location.search;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
      throw new Error("Session expired — redirecting to login");
    }

    throw new Error(message);
  }
  return json.data as T;
};
