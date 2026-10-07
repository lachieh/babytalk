"use client";

import { fetchPublicConfig } from "@bubsie/standard-config/client";
import { createContext, useContext, useEffect, useState } from "react";

import type { PublicConfig } from "@/config.gen";

/**
 * Runtime config cache — shared across all client code.
 * Populated on first fetch from /.well-known/config. The server refuses to
 * start without these values, so there are no build-time fallbacks.
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

const requireRuntimeConfig = (): PublicConfig => {
  if (!runtimeConfig) {
    throw new Error(
      "Runtime config not loaded. Await loadRuntimeConfig() before reading it."
    );
  }
  return runtimeConfig;
};

/** Get the API URL from the runtime config. */
export const getApiUrl = (): string => requireRuntimeConfig().apiUrl;

/** Get the Tambo URL from the runtime config. */
export const getTamboUrl = (): string => requireRuntimeConfig().tamboUrl;

/** Get the Tambo API key from the runtime config. */
export const getTamboApiKey = (): string =>
  requireRuntimeConfig().tamboApiKey ?? "";

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
