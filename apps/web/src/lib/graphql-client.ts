import { cacheExchange, createClient, fetchExchange } from "@urql/next";

export const makeClient = () =>
  createClient({
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      if (typeof window === "undefined") {
        return {};
      }
      const token = localStorage.getItem("babytalk_token");
      return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    },
    url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql",
  });
