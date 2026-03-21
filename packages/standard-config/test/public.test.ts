import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { defineConfig, getPublicConfig } from "../src/index";

describe(getPublicConfig, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-public-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("returns only public keys", async () => {
    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({
        api_url: "https://api.example.com",
        port: 3000,
        secret: "should-not-be-exposed",
      })
    );

    const config = defineConfig({
      prefix: "app",
      public: ["api_url", "port"],
      root,
      schema: z.object({
        api_url: z.string(),
        port: z.number(),
        secret: z.string(),
      }),
    });

    const publicConfig = await getPublicConfig(config);
    expect(publicConfig).toStrictEqual({
      api_url: "https://api.example.com",
      port: 3000,
    });
    expect((publicConfig as Record<string, unknown>).secret).toBeUndefined();
  });

  it("returns empty object when no public keys defined", async () => {
    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({ secret: "value" })
    );

    const config = defineConfig({
      prefix: "app",
      root,
      schema: z.object({ secret: z.string() }),
    });

    const publicConfig = await getPublicConfig(config);
    expect(publicConfig).toStrictEqual({});
  });

  it("handles nested public keys", async () => {
    writeFileSync(
      join(root, "app.config.yaml"),
      stringifyYaml({
        api: { secret: "hidden", url: "https://api.example.com" },
        debug: true,
      })
    );

    const config = defineConfig({
      prefix: "app",
      public: ["api.url"],
      root,
      schema: z.object({
        api: z.object({ secret: z.string(), url: z.string() }),
        debug: z.boolean(),
      }),
    });

    const publicConfig = await getPublicConfig(config);
    expect(publicConfig).toStrictEqual({
      api: { url: "https://api.example.com" },
    });
  });
});
