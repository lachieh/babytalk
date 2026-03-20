import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { generate } from "../src/generator/core";

describe("generate", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-gen-"));
    mkdirSync(join(root, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("generates .gen.ts, .env.d.ts, and .schema.json from a Zod schema", async () => {
    writeFileSync(
      join(root, "src", "config.ts"),
      `
import { z } from "zod";
import { defineConfig } from "@babytalk/standard-config";

export default defineConfig({
  prefix: "app",
  schema: z.object({
    port: z.number(),
    host: z.string(),
    database: z.object({
      url: z.string(),
      pool: z.number().optional(),
    }),
  }),
  public: ["host"],
  publicPrefix: "NEXT_PUBLIC_",
});
`
    );

    const result = await generate({
      outputJson: "./src/config.schema.json",
      outputTs: "./src/config.gen.ts",
      root,
      schema: "./src/config.ts",
    });

    expect(result.tsPath).toBe(join(root, "src", "config.gen.ts"));
    expect(result.jsonPath).toBe(join(root, "src", "config.schema.json"));

    // Verify JSON Schema
    const { jsonPath } = result;
    if (jsonPath === undefined) {
      throw new Error("Expected jsonPath to be defined");
    }
    const jsonContent = readFileSync(jsonPath, "utf8");
    const jsonSchema = JSON.parse(jsonContent);
    expect(jsonSchema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties.port.type).toBe("number");
    expect(jsonSchema.properties.host.type).toBe("string");
    expect(jsonSchema.properties.database.properties.url.type).toBe("string");

    // Verify TypeScript types (.gen.ts)
    const tsContent = readFileSync(result.tsPath, "utf8");
    expect(tsContent).toContain("auto-generated");
    expect(tsContent).toContain("Do not edit");
    expect(tsContent).toContain("export interface Config");
    expect(tsContent).toContain("port: number");
    expect(tsContent).toContain("host: string");
    expect(tsContent).toContain("export type PublicConfig");

    // Verify env declarations (.env.d.ts)
    const envDtsContent = readFileSync(
      join(root, "src", "config.env.d.ts"),
      "utf8"
    );
    expect(envDtsContent).toContain("APP_PORT");
    expect(envDtsContent).toContain("APP_DATABASE_URL");
    expect(envDtsContent).toContain("NEXT_PUBLIC_APP_HOST");
    expect(envDtsContent).toContain("ProcessEnv");
    expect(envDtsContent).toContain("ImportMetaEnv");
    expect(envDtsContent).toContain("ImportMeta");
  });

  it("generates correct env var names with nested keys and custom separator", async () => {
    writeFileSync(
      join(root, "src", "config.ts"),
      `
import { z } from "zod";
import { defineConfig } from "@babytalk/standard-config";

export default defineConfig({
  prefix: "myapp",
  separator: "__",
  schema: z.object({
    server: z.object({
      port: z.number(),
      host: z.string(),
    }),
  }),
});
`
    );

    await generate({ root });
    const envDtsContent = readFileSync(
      join(root, "src", "config.env.d.ts"),
      "utf8"
    );

    expect(envDtsContent).toContain("MYAPP__SERVER__PORT");
    expect(envDtsContent).toContain("MYAPP__SERVER__HOST");
  });

  it("throws for schema file without default export", async () => {
    writeFileSync(join(root, "src", "config.ts"), `export const foo = "bar";`);

    await expect(generate({ root })).rejects.toThrow(
      "must default-export a defineConfig() call"
    );
  });
});
