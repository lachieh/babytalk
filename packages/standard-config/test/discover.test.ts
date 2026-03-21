import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigError } from "../src/errors";
import { discoverConfigFiles } from "../src/loader/discover";

describe(discoverConfigFiles, () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sc-test-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("returns empty array when no config files exist", () => {
    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([]);
  });

  it("discovers a yaml file at root level", () => {
    writeFileSync(join(root, "app.config.yaml"), "port: 3000");
    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([join(root, "app.config.yaml")]);
  });

  it("discovers a json file at root level", () => {
    writeFileSync(join(root, "app.config.json"), '{"port": 3000}');
    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([join(root, "app.config.json")]);
  });

  it("discovers .local variant with higher precedence", () => {
    writeFileSync(join(root, "app.config.yaml"), "port: 3000");
    writeFileSync(join(root, "app.config.local.yaml"), "port: 4000");

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([
      join(root, "app.config.local.yaml"),
      join(root, "app.config.yaml"),
    ]);
  });

  it("discovers files in .config/ directory", () => {
    mkdirSync(join(root, ".config"), { recursive: true });
    writeFileSync(join(root, ".config", "app.yaml"), "port: 3000");

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([join(root, ".config", "app.yaml")]);
  });

  it("discovers files in .config/<prefix>/ directory", () => {
    mkdirSync(join(root, ".config", "app"), { recursive: true });
    writeFileSync(join(root, ".config", "app", "config.yaml"), "port: 3000");

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([join(root, ".config", "app", "config.yaml")]);
  });

  it("returns files in correct precedence order (highest first)", () => {
    // Create files at multiple levels
    mkdirSync(join(root, ".config", "app"), { recursive: true });
    writeFileSync(join(root, "app.config.local.yaml"), "local: true");
    writeFileSync(join(root, "app.config.yaml"), "base: true");
    writeFileSync(join(root, ".config", "app", "config.yaml"), "nested: true");

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([
      join(root, "app.config.local.yaml"),
      join(root, "app.config.yaml"),
      join(root, ".config", "app", "config.yaml"),
    ]);
  });

  it("throws ConfigError when both yaml and json exist at same path", () => {
    writeFileSync(join(root, "app.config.yaml"), "port: 3000");
    writeFileSync(join(root, "app.config.json"), '{"port": 3000}');

    expect(() => discoverConfigFiles({ prefix: "app", root })).toThrow(
      ConfigError
    );
  });

  it("allows yaml at one path and json at another", () => {
    mkdirSync(join(root, ".config"), { recursive: true });
    writeFileSync(join(root, "app.config.yaml"), "port: 3000");
    writeFileSync(join(root, ".config", "app.json"), '{"host": "0.0.0.0"}');

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toHaveLength(2);
  });

  it("discovers .local variants in .config/ directory", () => {
    mkdirSync(join(root, ".config"), { recursive: true });
    writeFileSync(join(root, ".config", "app.local.yaml"), "local: true");
    writeFileSync(join(root, ".config", "app.yaml"), "base: true");

    const files = discoverConfigFiles({ prefix: "app", root });
    expect(files).toStrictEqual([
      join(root, ".config", "app.local.yaml"),
      join(root, ".config", "app.yaml"),
    ]);
  });
});
