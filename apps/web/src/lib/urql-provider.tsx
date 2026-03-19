"use client";

import { UrqlProvider as Provider, ssrExchange } from "@urql/next";
import { useMemo } from "react";
import { cacheExchange, createClient, fetchExchange } from "urql";

import { getApiUrl } from "./env";

export const UrqlProvider = ({ children }: { children: React.ReactNode }) => {
  const [urqlClient, urqlSsr] = useMemo(() => {
    const ssrInstance = ssrExchange({ isClient: true });
    const clientInstance = createClient({
      exchanges: [cacheExchange, ssrInstance, fetchExchange],
      fetchOptions: () => {
        if (typeof window === "undefined") {
          return {};
        }
        const token = localStorage.getItem("babytalk_token");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      },
      url: getApiUrl(),
    });
    return [clientInstance, ssrInstance];
  }, []);

  return (
    <Provider client={urqlClient} ssr={urqlSsr}>
      {children}
    </Provider>
  );
};
