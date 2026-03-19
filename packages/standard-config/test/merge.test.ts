import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";

import { mergeConfigFiles } from "../src/loader/merge.js";

describe("mergeConfigFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-merge-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("returns empty object for no files", () => {
    expect(mergeConfigFiles([])).toEqual({});
  });

  it("reads a single yaml file", () => {
    const file = join(root, "config.yaml");
    writeFileSync(file, stringifyYaml({ host: "localhost", port: 3000 }));

    const result = mergeConfigFiles([file]);
    expect(result).toEqual({ host: "localhost", port: 3000 });
  });

  it("reads a single json file", () => {
    const file = join(root, "config.json");
    writeFileSync(file, JSON.stringify({ port: 3000 }));

    const result = mergeConfigFiles([file]);
    expect(result).toEqual({ port: 3000 });
  });

  it("deep merges with higher precedence file winning", () => {
    const high = join(root, "high.yaml");
    const low = join(root, "low.yaml");

    writeFileSync(high, stringifyYaml({ database: { port: 5433 } }));
    writeFileSync(
      low,
      stringifyYaml({ database: { host: "localhost", port: 5432 } })
    );

    // high is first (highest precedence)
    const result = mergeConfigFiles([high, low]);
    expect(result).toEqual({
      database: { host: "localhost", port: 5433 },
    });
  });

  it("replaces arrays instead of concatenating", () => {
    const high = join(root, "high.yaml");
    const low = join(root, "low.yaml");

    writeFileSync(high, stringifyYaml({ tags: ["override"] }));
    writeFileSync(low, stringifyYaml({ tags: ["a", "b", "c"] }));

    const result = mergeConfigFiles([high, low]);
    expect(result).toEqual({ tags: ["override"] });
  });

  it("deep merges across three files", () => {
    const a = join(root, "a.yaml");
    const b = join(root, "b.yaml");
    const c = join(root, "c.json");

    writeFileSync(a, stringifyYaml({ server: { port: 9000 } }));
    writeFileSync(
      b,
      stringifyYaml({ db: { name: "test" }, server: { host: "0.0.0.0" } })
    );
    writeFileSync(
      c,
      JSON.stringify({ db: { host: "db.local", name: "prod" } })
    );

    const result = mergeConfigFiles([a, b, c]);
    expect(result).toEqual({
      db: { host: "db.local", name: "test" },
      server: { host: "0.0.0.0", port: 9000 },
    });
  });

  it("skips undefined/null values from higher precedence (defu behavior)", () => {
    const high = join(root, "high.yaml");
    const low = join(root, "low.yaml");

    // YAML `null` or missing key — defu treats as "not set"
    writeFileSync(high, stringifyYaml({ a: 1, b: null }));
    writeFileSync(low, stringifyYaml({ b: 2, c: 3 }));

    const result = mergeConfigFiles([high, low]);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });
});
