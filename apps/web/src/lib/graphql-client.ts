import { cacheExchange, createClient, fetchExchange } from "@urql/next";

export function makeClient() {
  return createClient({
    url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql",
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      if (typeof window === "undefined") return {};
      const token = localStorage.getItem("babytalk_token");
      return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
    },
  });
}
