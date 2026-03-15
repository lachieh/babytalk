"use client";

import { useMemo } from "react";
import { UrqlProvider as Provider } from "@urql/next";
import { ssrExchange } from "@urql/next";
import { cacheExchange, createClient, fetchExchange } from "urql";

export function UrqlProvider({ children }: { children: React.ReactNode }) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange({ isClient: true });
    const client = createClient({
      url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql",
      exchanges: [cacheExchange, ssr, fetchExchange],
      fetchOptions: () => {
        if (typeof window === "undefined") return {};
        const token = localStorage.getItem("babytalk_token");
        return token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {};
      },
    });
    return [client, ssr];
  }, []);

  return (
    <Provider client={client} ssr={ssr}>
      {children}
    </Provider>
  );
}
