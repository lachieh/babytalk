import { cacheExchange, createClient, fetchExchange } from "@urql/next";

import { getApiUrl } from "./env";

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
    url: getApiUrl(),
  });
