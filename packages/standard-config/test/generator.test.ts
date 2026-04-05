import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { generate } from "../src/generator/core";

const zodSchemaSource = `
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
`;

describe(generate, () => {
  let root: string;

  const pkgRoot = resolve(import.meta.dirname, "..");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-gen-"));
    mkdirSync(join(root, "src"), { recursive: true });
    // Symlink deps so jiti can resolve them from the temp dir
    mkdirSync(join(root, "node_modules", "@babytalk"), { recursive: true });
    symlinkSync(
      pkgRoot,
      join(root, "node_modules", "@babytalk", "standard-config")
    );
    symlinkSync(
      join(pkgRoot, "node_modules", "zod"),
      join(root, "node_modules", "zod")
    );
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("outputs correct file paths", async () => {
    writeFileSync(join(root, "src", "config.ts"), zodSchemaSource);

    const result = await generate({
      outputJson: "./src/config.schema.json",
      outputTs: "./src/config.gen.ts",
      root,
      schema: "./src/config.ts",
    });

    expect(result.tsPath).toBe(join(root, "src", "config.gen.ts"));
    expect(result.jsonPath).toBe(join(root, "src", "config.schema.json"));
  });

  it("generates a valid JSON Schema", async () => {
    writeFileSync(join(root, "src", "config.ts"), zodSchemaSource);

    const result = await generate({
      outputJson: "./src/config.schema.json",
      outputTs: "./src/config.gen.ts",
      root,
      schema: "./src/config.ts",
    });

    const { jsonPath } = result;
    if (!jsonPath) throw new Error("Expected jsonPath to be defined");

    const jsonContent = readFileSync(jsonPath, "utf8");
    const jsonSchema = JSON.parse(jsonContent);
    expect(jsonSchema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties.port.type).toBe("number");
    expect(jsonSchema.properties.host.type).toBe("string");
    expect(jsonSchema.properties.database.properties.url.type).toBe("string");
  });

  it("generates TypeScript types in .gen.ts", async () => {
    writeFileSync(join(root, "src", "config.ts"), zodSchemaSource);

    const result = await generate({
      outputJson: "./src/config.schema.json",
      outputTs: "./src/config.gen.ts",
      root,
      schema: "./src/config.ts",
    });

    const tsContent = readFileSync(result.tsPath, "utf8");
    expect(tsContent).toContain("auto-generated");
    expect(tsContent).toContain("Do not edit");
    expect(tsContent).toContain("export interface Config");
    expect(tsContent).toContain("port: number");
    expect(tsContent).toContain("host: string");
  });

  it("generates env declarations in .gen.d.ts", async () => {
    writeFileSync(join(root, "src", "config.ts"), zodSchemaSource);

    await generate({
      outputJson: "./src/config.schema.json",
      outputTs: "./src/config.gen.ts",
      root,
      schema: "./src/config.ts",
    });

    const envDtsContent = readFileSync(
      join(root, "src", "config.gen.d.ts"),
      "utf8"
    );
    expect(envDtsContent).toContain("APP__PORT");
    expect(envDtsContent).toContain("APP__DATABASE__URL");
    expect(envDtsContent).toContain("NEXT_PUBLIC_APP__HOST");
    expect(envDtsContent).toContain("ProcessEnv");
    expect(envDtsContent).toContain("ImportMetaEnv");
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
      join(root, "src", "config.gen.d.ts"),
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
