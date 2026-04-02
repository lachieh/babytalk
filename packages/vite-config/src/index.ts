import standardConfig from "@babytalk/standard-config/vite";
import { defineConfig, mergeConfig } from "vite";
import type { Plugin, UserConfig, ViteDevServer } from "vite";

interface AppConfig {
  /** Server entry point */
  entry: string;
  /** Path to the standard-config schema file */
  schema?: string;
  /** Additional Vite config to merge */
  overrides?: UserConfig;
}

/**
 * Vite plugin that runs a Node server entry via ssrLoadModule during dev.
 * The server owns its own transport (HTTP, stdio, etc.) — Vite just loads
 * and watches the modules, restarting the server on HMR invalidation.
 */
function nodeServerPlugin(entry: string): Plugin {
  let server: ViteDevServer;

  const loadEntry = async () => {
    try {
      await server.ssrLoadModule(entry);
    } catch (error) {
      server.config.logger.error(
        `Failed to load server entry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  return {
    name: "babytalk:node-server",

    configureServer(viteServer) {
      server = viteServer;

      server.httpServer?.once("listening", () => {
        void loadEntry();
      });
    },

    handleHotUpdate({ modules }) {
      const hasSsrModules = modules.some((m) => m.environment?.name === "ssr");
      if (hasSsrModules) {
        server.config.logger.info("Restarting server...", { timestamp: true });
        void loadEntry();
      }
    },
  };
}

export function defineAppConfig({ entry, schema, overrides }: AppConfig) {
  const base = defineConfig({
    appType: "custom",
    build: {
      outDir: "dist",
      sourcemap: true,
      ssr: entry,
    },
    plugins: [
      standardConfig({
        schema: schema ?? "./src/config.ts",
      }),
      nodeServerPlugin(entry),
    ],
    server: {
      open: false,
      // Bind to a random unused port — Vite CLI requires an HTTP server,
      // but we don't use it. The app owns its own transport.
      port: 0,
    },
  });

  return overrides ? mergeConfig(base, overrides) : base;
}
