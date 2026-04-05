import {
  getApiUrl,
  getRuntimeConfig,
  loadRuntimeConfig,
} from "@/lib/runtime-config";

const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("babytalk_token");

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
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
};
