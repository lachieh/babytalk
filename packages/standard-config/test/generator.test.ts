import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../src/generator/core.js";

describe("generate", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-gen-"));
    mkdirSync(join(root, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("generates .gen.ts and .schema.json from a Zod schema", async () => {
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
`,
    );

    const result = await generate({
      root,
      schema: "./src/config.ts",
      outputTs: "./src/config.gen.ts",
      outputJson: "./src/config.schema.json",
    });

    expect(result.tsPath).toBe(join(root, "src", "config.gen.ts"));
    expect(result.jsonPath).toBe(join(root, "src", "config.schema.json"));

    // Verify JSON Schema
    const jsonContent = readFileSync(result.jsonPath!, "utf-8");
    const jsonSchema = JSON.parse(jsonContent);
    expect(jsonSchema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties.port.type).toBe("number");
    expect(jsonSchema.properties.host.type).toBe("string");
    expect(jsonSchema.properties.database.properties.url.type).toBe("string");

    // Verify TypeScript types
    const tsContent = readFileSync(result.tsPath, "utf-8");
    expect(tsContent).toContain("auto-generated");
    expect(tsContent).toContain("Do not edit");
    expect(tsContent).toContain("export interface Config");
    expect(tsContent).toContain("port: number");
    expect(tsContent).toContain("host: string");
    expect(tsContent).toContain("export type PublicConfig");
    expect(tsContent).toContain("ENV_VARS");
    expect(tsContent).toContain("APP_PORT");
    expect(tsContent).toContain("APP_DATABASE_URL");
    expect(tsContent).toContain("NEXT_PUBLIC_APP_HOST");
  });

  it("generates correct env var map with nested keys", async () => {
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
`,
    );

    const result = await generate({ root });
    const tsContent = readFileSync(result.tsPath, "utf-8");

    expect(tsContent).toContain("MYAPP__SERVER__PORT");
    expect(tsContent).toContain("MYAPP__SERVER__HOST");
  });

  it("throws for schema file without default export", async () => {
    writeFileSync(
      join(root, "src", "config.ts"),
      `export const foo = "bar";`,
    );

    await expect(generate({ root })).rejects.toThrow(
      "must default-export a defineConfig() call",
    );
  });
});
