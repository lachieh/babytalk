const getApiUrl = () =>
  process.env.NEXT_PUBLIC_BABYTALK_WEB_API_URL ||
  "http://localhost:4000/graphql";

const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("babytalk_token");

export const gqlRequest = async <T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> => {
  const token = getToken();
  const res = await fetch(getApiUrl(), {
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
