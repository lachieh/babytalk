import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as v from "valibot";
import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { defineConfig, loadConfig, ConfigError } from "../src/index";

describe("loadConfig integration", () => {
  let root: string;
  const originalEnv = process.env;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-load-"));
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(root, { force: true, recursive: true });
  });

  it("loads config from file with Zod schema", async () => {
    const schema = z.object({
      host: z.string(),
      port: z.number(),
    });

    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({ host: "localhost", port: 3000 })
    );

    const config = await loadConfig(
      defineConfig({ prefix: "app", root, schema })
    );

    expect(config).toStrictEqual({ host: "localhost", port: 3000 });
    expect(Object.isFrozen(config)).toBeTruthy();
  });

  it("loads config from file with Valibot schema", async () => {
    const schema = v.object({
      host: v.string(),
      port: v.number(),
    });

    writeFileSync(
      join(root, "app.config.json"),
      JSON.stringify({ host: "localhost", port: 3000 })
    );

    const config = await loadConfig(
      defineConfig({ prefix: "app", root, schema })
    );

    expect(config).toStrictEqual({ host: "localhost", port: 3000 });
  });

  it("env vars override file values", async () => {
    const schema = z.object({
      host: z.string(),
      port: z.number(),
    });

    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({ host: "localhost", port: 3000 })
    );

    process.env.APP_PORT = "9000";

    const config = await loadConfig(
      defineConfig({ prefix: "app", root, schema })
    );

    expect(config.port).toBe(9000);
    expect(config.host).toBe("localhost");
  });

  it("merges local file over base file", async () => {
    const schema = z.object({
      debug: z.boolean().optional(),
      host: z.string(),
      port: z.number(),
    });

    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({ host: "localhost", port: 3000 })
    );
    writeFileSync(
      join(root, "app.config.local.yaml"),
      stringifyYaml({ debug: true, port: 4000 })
    );

    const config = await loadConfig(
      defineConfig({ prefix: "app", root, schema })
    );

    expect(config.port).toBe(4000);
    expect(config.host).toBe("localhost");
    expect(config.debug).toBeTruthy();
  });

  it("throws ConfigError for missing required fields", async () => {
    const schema = z.object({
      host: z.string(),
      port: z.number(),
    });

    writeFileSync(join(root, "app.config.yaml"), stringifyYaml({ port: 3000 }));

    await expect(
      loadConfig(defineConfig({ prefix: "app", root, schema }))
    ).rejects.toThrow(ConfigError);
  });

  it("works with env-only config (no files)", async () => {
    const schema = z.object({
      host: z.string(),
      port: z.number(),
    });

    process.env.APP_PORT = "3000";
    process.env.APP_HOST = "0.0.0.0";

    const config = await loadConfig(
      defineConfig({ prefix: "app", root, schema })
    );

    expect(config).toStrictEqual({ host: "0.0.0.0", port: 3000 });
  });
});
