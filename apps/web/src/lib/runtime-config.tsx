"use client";

import { fetchPublicConfig } from "@babytalk/standard-config/client";
import { createContext, useContext, useEffect, useState } from "react";

import type { PublicConfig } from "@/config.gen";

/**
 * Runtime config cache — shared across all client code.
 * Populated on first fetch from /.well-known/config.
 * Falls back to process.env (build-time) values until loaded.
 */
let runtimeConfig: PublicConfig | null = null;
let configPromise: Promise<PublicConfig> | null = null;

export const loadRuntimeConfig = (): Promise<PublicConfig> => {
  if (runtimeConfig) return Promise.resolve(runtimeConfig);
  if (!configPromise) {
    configPromise = (async () => {
      const config = await fetchPublicConfig<PublicConfig>();
      runtimeConfig = config;
      return config;
    })();
  }
  return configPromise;
};

/** Synchronous read — returns cached config or null if not yet loaded. */
export const getRuntimeConfig = (): PublicConfig | null => runtimeConfig;

/** Get the API URL, preferring runtime config over build-time env vars. */
export const getApiUrl = (): string =>
  runtimeConfig?.api_url ||
  process.env.NEXT_PUBLIC_BABYTALK_WEB_API_URL ||
  "http://localhost:4000/graphql";

/** Get the Tambo URL, preferring runtime config over build-time env vars. */
export const getTamboUrl = (): string =>
  runtimeConfig?.tambo_url ||
  process.env.NEXT_PUBLIC_BABYTALK_WEB_TAMBO_URL ||
  "http://localhost:8261";

/** Get the Tambo API key, preferring runtime config over build-time env vars. */
export const getTamboApiKey = (): string =>
  runtimeConfig?.tambo_api_key ||
  process.env.NEXT_PUBLIC_BABYTALK_WEB_TAMBO_API_KEY ||
  "";

/* ── React context for components that need to re-render on config load ── */

const RuntimeConfigContext = createContext<PublicConfig | null>(null);

export const RuntimeConfigProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [config, setConfig] = useState<PublicConfig | null>(runtimeConfig);

  useEffect(() => {
    const load = async () => {
      const loaded = await loadRuntimeConfig();
      setConfig(loaded);
    };
    load();
  }, []);

  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
};

export const useRuntimeConfig = (): PublicConfig | null =>
  useContext(RuntimeConfigContext);
