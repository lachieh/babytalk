import { cacheExchange, createClient, fetchExchange } from "@urql/next";

export const makeClient = (apiUrl: string) =>
  createClient({
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      if (typeof window === "undefined") {
        return {};
      }
      const token = localStorage.getItem("bubsie_token");
      return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    },
    url: apiUrl,
  });
