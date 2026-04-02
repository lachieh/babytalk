import { config } from "./env";

const getApiUrl = () => config.api_url;

export const gqlRequest = async <T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> => {
  const res = await fetch(getApiUrl(), {
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
};
