---
title: "feat: Add schema-validated config loading package"
type: feat
status: completed
date: 2026-03-18
origin: docs/brainstorms/2026-03-18-standard-config-requirements.md
---

# feat: Add schema-validated config loading package

## Overview

Create `@babytalk/standard-config` — a schema-validated config loading package that discovers YAML/JSON config files with a defined precedence order, deep-merges them, overlays environment variables, and validates the result against any standard-schema@1.1 compatible schema. It also generates JSON Schema and TypeScript types via a shared generation core, exposed through an unplugin (Vite, webpack, etc.) and a CLI.

## Problem Statement

The babytalk monorepo uses raw `process.env` access across all apps with no validation, no defaults, and no type safety. Seven env vars in the API and one in the web app are accessed inline with ad-hoc defaults or bare `throw` checks. There is no shared convention, no schema, and no way to know at startup whether config is valid. (see origin: `docs/brainstorms/2026-03-18-standard-config-requirements.md`)

## Proposed Solution

A new package at `packages/standard-config/` following established monorepo conventions (ESM, NodeNext, `exports` with `types`/`import`/`default` conditions). The package has four subsystems:

1. **Runtime loader** — File discovery, deep merge, env var overlay, schema validation
2. **Code generator** — Shared core that produces `.gen.ts` and `.schema.json` from a schema source file
3. **Bundler plugin** — unplugin wrapping the generator with file watching
4. **CLI** — Standalone entry point wrapping the generator for CI

## Technical Approach

### Architecture

```
packages/standard-config/
├── src/
│   ├── index.ts              # Main entry: defineConfig, loadConfig
│   ├── loader/
│   │   ├── discover.ts       # File discovery (R2, R3)
│   │   ├── merge.ts          # Deep merge via defu (R4)
│   │   ├── env.ts            # Env var scanning + overlay (R5, R6, R7)
│   │   └── validate.ts       # standard-schema validation (R1)
│   ├── generator/
│   │   ├── core.ts           # Shared generation logic (R8, R9)
│   │   ├── json-schema.ts    # StandardJSONSchemaV1 extraction
│   │   └── typescript.ts     # .gen.ts file emitter
│   ├── unplugin.ts           # unplugin factory (R10)
│   └── cli.ts                # CLI entry point (R11)
├── package.json
└── tsconfig.json
```

**Subpath exports:**

| Export path   | Points to                          | Purpose                               |
| ------------- | ---------------------------------- | ------------------------------------- |
| `"."`         | `src/index.ts`                     | Runtime `defineConfig` + `loadConfig` |
| `"./vite"`    | `src/unplugin.ts` (vite export)    | Vite plugin                           |
| `"./webpack"` | `src/unplugin.ts` (webpack export) | webpack plugin                        |
| `"./rollup"`  | `src/unplugin.ts` (rollup export)  | Rollup plugin                         |
| `"./esbuild"` | `src/unplugin.ts` (esbuild export) | esbuild plugin                        |

The CLI is exposed via `"bin"` in `package.json`, not as a subpath export.

### Resolved Architectural Decisions

These questions were deferred from brainstorming and resolved here based on research:

**Q: How does the system discover which env vars to check? (R5)**
Standard-schema@1.1 provides NO runtime introspection of schema keys. The system uses a **prefix-scan strategy**: scan all keys in `process.env` matching `<PREFIX>_*`, then reverse-map each key to a nested path using the separator. The merged config object (files + env vars) is validated against the schema afterward, catching any invalid or unexpected keys.

This means env vars can introduce keys not present in any config file, and the schema validation catches invalid ones. For the "env-only, no files" case this works naturally — env vars are scanned regardless of whether files exist.

**Q: How should array values be represented in env vars? (R5)**
**JSON-string parsing**: if the env var value starts with `[`, parse as JSON array. Otherwise treat as a scalar string. This is explicit and unambiguous.

**Q: How should the public marker work? (R6)**
**Config-level key path list**: pass `public: ["api.url", "api.version"]` to `defineConfig()`. This is fully schema-agnostic — no wrapper functions, no metadata injection, no schema library coupling. The generated types produce separate `Config` and `PublicConfig` types.

Public env vars use the pattern: `<publicPrefix><PREFIX><sep><KEY>`, e.g. with `publicPrefix: "NEXT_PUBLIC_"`, prefix `APP`, key `api.url` → `NEXT_PUBLIC_APP_API_URL`. The public prefix is configurable.

**Q: Should generation use a shared core? (R8, R9)**
**Yes.** A single `generate()` function in `src/generator/core.ts` is called by both the unplugin and the CLI. It accepts a schema source file path, evaluates it via `jiti`, extracts JSON Schema (via `StandardJSONSchemaV1`) and TypeScript types, and writes output files.

**Q: What unplugin hooks are needed for file watching? (R10)**

- `buildStart`: run initial generation
- `vite.configureServer`: use `server.watcher` for dev-mode file watching (unplugin's `watchChange` does NOT work in Vite dev mode)
- `watchChange`: for Rollup/build-mode watching
- `webpack(compiler)`: use `compiler.hooks.watchRun` as fallback (unplugin `watchChange` unreliable in webpack)

**Q: How does the plugin/CLI discover the schema source file?**
**Explicit path with conventional default.** The plugin accepts `{ schema: "./src/config.ts" }`. The CLI accepts `--schema ./src/config.ts`. Both default to `./src/config.ts` relative to root. The schema file must export a `defineConfig()` call as its default export.

**Q: How does the CLI evaluate TypeScript?**
**jiti** (from the unjs ecosystem) for zero-config TypeScript evaluation. Already proven in tools like c12, nuxt, and nitro.

### Key Merge Behavior

Using `defu` with a custom merger via `createDefu()`:

- **Objects**: deep merged recursively (defu default)
- **Arrays**: **replacement** — higher-precedence array wins entirely (override defu's default concatenation). This matches user expectations for config overrides.
- **Null/undefined**: skipped by defu (treated as "not set"). This means you cannot use `null` in a `.local` file to unset a key from a base file. Documented as a known limitation.
- **Env var values**: always strings from `process.env`. Before merging, coerce to the expected type using the schema's type hints from JSON Schema (number → `Number()`, boolean → `"true"`/`"false"`, array → JSON.parse if starts with `[`).

### Env Var Collision Strategy

With single underscore separator, `database_url` (flat) and `database.url` (nested) both produce `APP_DATABASE_URL`. Resolution:

1. **At generation time** (when JSON Schema is available): detect collisions and emit a warning with suggested fixes (use double underscore separator, or rename keys).
2. **At runtime** (prefix-scan mode): the env var maps to the **shallowest** matching path. If the schema only has one of the two interpretations, validation catches the mismatch.
3. **Documentation**: clearly state that key names containing the separator character create ambiguity, and recommend `__` separator for projects with such keys.

### Error Reporting

Validation errors include:

- The key path that failed (e.g. `database.port`)
- The expected type and the received value
- The source of the value (env var name or file path)
- All validation errors collected (not fail-on-first)

Format: structured `ConfigError` class with `.issues` array, plus a formatted `.message` string for console output.

## System-Wide Impact

### Interaction Graph

`loadConfig()` runs at application startup, before any other module initializes. It reads files (fs), env vars (`process.env`), validates, and returns a frozen config object. No callbacks, middleware, or observers involved.

The unplugin hooks run during bundler lifecycle — `buildStart` triggers generation, `configureServer` sets up watching. These are isolated to build time.

### Error Propagation

- File read errors (ENOENT for optional paths): silently skipped
- File read errors (EACCES, parse errors): thrown as `ConfigError` with source attribution
- Validation errors: thrown as `ConfigError` with all issues collected
- Generation errors (no StandardJSONSchemaV1 support): thrown with clear message suggesting compatible schema libraries

### State Lifecycle Risks

None — config is loaded once, returned as a frozen object, no persistent state.

### API Surface Parity

No existing interfaces expose similar functionality. This is net-new.

### Integration Test Scenarios

1. **File precedence**: Create files at multiple precedence levels, verify highest-precedence value wins for each key
2. **Env override**: Set env var for a key that exists in a config file, verify env var wins
3. **Validation failure**: Provide config missing a required key, verify structured error with path and source
4. **Format conflict**: Create both `.yaml` and `.json` at same path, verify error thrown
5. **Generation roundtrip**: Define schema → generate → import generated types → verify type correctness

## Acceptance Criteria

### Functional Requirements

- [ ] `loadConfig()` discovers and loads YAML/JSON files in the specified precedence order (R2)
- [ ] `.local` variants override their non-local counterpart at each directory level (R2)
- [ ] Both `.yaml` and `.json` at the same path throws `ConfigError` (R3)
- [ ] Config files are deep-merged with array replacement semantics (R4)
- [ ] Env vars matching `<PREFIX>_*` override merged file values (R5)
- [ ] Env var separator is configurable, defaults to `_` (R5)
- [ ] Public keys generate env vars with configurable public prefix (R6)
- [ ] Custom env var name mapping callback is supported, falls back to default when returning null/undefined (R7)
- [ ] JSON Schema generation works for schemas implementing `StandardJSONSchemaV1` (R8)
- [ ] TypeScript types generated as `.gen.ts` with `Config` and `PublicConfig` exports (R9)
- [ ] unplugin generates on build start and watches for changes in dev (R10)
- [ ] CLI `standard-config generate` produces the same output as the plugin (R11)
- [ ] Output paths are configurable with sensible defaults (R12)
- [ ] Validation uses standard-schema `~standard.validate()` and reports all errors with source attribution (R1)
- [ ] Invalid config at startup throws `ConfigError` with structured issues

### Non-Functional Requirements

- [ ] Zero runtime dependency on any specific schema library
- [ ] ESM-only, `"type": "module"`, NodeNext resolution
- [ ] Follows monorepo `exports` pattern (`types`/`import`/`default` conditions)
- [ ] Generated files include "do not edit" header with generator version

### Quality Gates

- [ ] All acceptance criteria have corresponding tests
- [ ] `pnpm check` passes with no lint errors
- [ ] TypeScript strict mode, no `any` types in public API
- [ ] Works with at least Zod 4 and Valibot 1 as validation providers

## Dependencies & Prerequisites

### Runtime Dependencies

| Package | Purpose                                       |
| ------- | --------------------------------------------- |
| `defu`  | Deep merge with custom array-replace behavior |
| `yaml`  | YAML file parsing                             |

### Dev/Generation Dependencies

| Package                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `unplugin`              | Bundler plugin abstraction                                |
| `jiti`                  | TypeScript evaluation for schema files at generation time |
| `@standard-schema/spec` | Type definitions only (not a runtime dep)                 |

### Peer Dependencies

None — the schema library is brought by the user and accessed only through the `~standard` interface.

## Implementation Phases

### Phase 1: Package Scaffolding + File Discovery

**Goal:** New package in the monorepo with file discovery and deep merge.

**Tasks:**

- [ ] Create `packages/standard-config/` with `package.json`, `tsconfig.json`
- [ ] Set up `exports` following `@babytalk/zpages` pattern for subpaths
- [ ] Add to `pnpm-workspace.yaml` (already covered by `packages/*` glob)
- [ ] Add `turbo.json` build task dependencies if needed
- [ ] Implement `src/loader/discover.ts` — file path generation from prefix + root, existence checks, format conflict detection
- [ ] Implement `src/loader/merge.ts` — `createDefu()` with array-replace custom merger
- [ ] Tests for discovery (all 10 precedence levels) and merge behavior

**Files:**

- `packages/standard-config/package.json`
- `packages/standard-config/tsconfig.json`
- `packages/standard-config/src/index.ts`
- `packages/standard-config/src/loader/discover.ts`
- `packages/standard-config/src/loader/merge.ts`

### Phase 2: Env Var Overlay + Schema Validation

**Goal:** Complete runtime config loading with env vars and validation.

**Tasks:**

- [ ] Implement `src/loader/env.ts` — prefix scan of `process.env`, reverse-map to nested paths, type coercion (number, boolean, JSON array), public prefix handling, custom mapping callback
- [ ] Implement `src/loader/validate.ts` — call `schema['~standard'].validate()`, handle sync/async result, collect issues into `ConfigError`
- [ ] Implement `src/index.ts` — `defineConfig()` options builder, `loadConfig()` orchestrator (discover → merge → env overlay → validate → freeze)
- [ ] `ConfigError` class with `.issues` array (path, message, source, expected, received)
- [ ] Tests for env overlay, type coercion, public prefix, custom mapping, validation errors

**Files:**

- `packages/standard-config/src/loader/env.ts`
- `packages/standard-config/src/loader/validate.ts`
- `packages/standard-config/src/index.ts`
- `packages/standard-config/src/errors.ts`

### Phase 3: Code Generation (JSON Schema + TypeScript)

**Goal:** Generate `.schema.json` and `.gen.ts` from a schema source file.

**Tasks:**

- [ ] Implement `src/generator/core.ts` — `generate()` function: resolve schema path, evaluate via jiti, check for `StandardJSONSchemaV1`, extract JSON Schema, write output files
- [ ] Implement `src/generator/json-schema.ts` — call `schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' })`, format and write
- [ ] Implement `src/generator/typescript.ts` — generate `.gen.ts` with:
  - `Config` type (inferred from schema output)
  - `PublicConfig` type (Pick of public keys)
  - Env var name constants object
  - "Do not edit" header
- [ ] Configurable output paths with defaults (`./src/config.gen.ts`, `./src/config.schema.json`)
- [ ] Tests for generation with Zod 4 and Valibot 1 schemas

**Files:**

- `packages/standard-config/src/generator/core.ts`
- `packages/standard-config/src/generator/json-schema.ts`
- `packages/standard-config/src/generator/typescript.ts`

### Phase 4: Unplugin + CLI

**Goal:** Expose generation via bundler plugins and a CLI command.

**Tasks:**

- [ ] Implement `src/unplugin.ts` — `createUnplugin()` factory with:
  - `buildStart`: call `generate()`
  - `vite.configureServer`: `server.watcher.on('change', ...)` for schema file watching
  - `watchChange`: for Rollup/build-mode watch
  - `webpack(compiler)`: `compiler.hooks.watchRun` for webpack watch
- [ ] Export bundler-specific plugins: `unplugin.vite`, `unplugin.webpack`, etc.
- [ ] Implement `src/cli.ts` — parse args (`--schema`, `--output`, `--root`), call `generate()`
- [ ] Add `"bin": { "standard-config": "./dist/cli.js" }` to `package.json`
- [ ] Tests for CLI invocation and plugin hook behavior

**Files:**

- `packages/standard-config/src/unplugin.ts`
- `packages/standard-config/src/cli.ts`

### Phase 5: Integration with Existing Apps

**Goal:** Replace raw `process.env` usage in `apps/api` and `apps/web` with `@babytalk/standard-config`.

**Tasks:**

- [ ] Create schema definition in `apps/api/src/config.ts` with all 7 env vars
- [ ] Create schema definition in `apps/web/src/config.ts` with `API_URL` (public)
- [ ] Replace all `process.env` access in `apps/api` with typed config
- [ ] Replace `apps/web/src/lib/env.ts` with standard-config
- [ ] Add unplugin to web's Next.js config (or use CLI in build script)
- [ ] Run generation, commit `.gen.ts` and `.schema.json` files
- [ ] Update `apps/web/next.config.ts` `transpilePackages` to include `@babytalk/standard-config`

**Files:**

- `apps/api/src/config.ts` (new)
- `apps/web/src/config.ts` (new)
- `apps/api/src/index.ts` (modify)
- `apps/api/src/auth/jwt.ts` (modify)
- `apps/api/src/email/send.ts` (modify)
- `apps/web/src/lib/env.ts` (replace)
- `apps/web/next.config.ts` (modify)

## Alternative Approaches Considered

**Use c12 directly**: unjs/c12 is a mature config loader with file discovery, env overlay, and deep merge. However, it uses its own validation system, does not support standard-schema, does not generate TypeScript types, and bundles more features than needed (remote config, git extends, `.env` loading). Building a focused package gives us exactly the feature set needed.

**Use t3-env**: Handles env var validation with standard-schema support, but is flat-only (no nested config), no file loading, no deep merge. It solves a different problem (env var validation) rather than the full config loading pipeline.

**Extend cosmiconfig**: Could provide file discovery, but would still need custom env var overlay, validation integration, and code generation. The file discovery pattern in the requirements (10 explicit paths with local variants) is different enough from cosmiconfig's directory-walking approach that it's simpler to implement directly.

## Risk Analysis & Mitigation

| Risk                                                  | Likelihood | Impact                       | Mitigation                                                                                                                                  |
| ----------------------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema library doesn't support `StandardJSONSchemaV1` | Medium     | JSON Schema generation fails | Clear error message with list of supported libraries; generation gracefully degrades (skip JSON Schema, still generate TS types via import) |
| Env var separator collisions                          | Medium     | Silent misconfiguration      | Collision detection at generation time; documentation recommending `__` for projects with underscored keys                                  |
| unplugin watch limitations                            | Known      | Dev experience degraded      | Bundler-specific workarounds already planned (Vite `configureServer`, webpack `compiler.hooks`)                                             |
| `jiti` compatibility with schema libraries            | Low        | Generation fails             | jiti is battle-tested in the unjs ecosystem; fallback to `tsx` if needed                                                                    |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-18-standard-config-requirements.md](docs/brainstorms/2026-03-18-standard-config-requirements.md) — Key decisions carried forward: standard-schema agnosticism (R1), unplugin for bundler plugins, deep merge with array replacement, configurable separator with single underscore default, TanStack-style generated files, config-level public key marking.

### Internal References

- Package exports pattern: `packages/zpages/package.json` (subpath exports with `types`/`import`/`default`)
- Package tsconfig pattern: `packages/db/tsconfig.json` (extends `@babytalk/tsconfig/node.json`)
- AGENTS.md "Live Types via publishConfig" rules for new internal packages
- Current env var usage: `apps/api/src/index.ts`, `apps/api/src/auth/jwt.ts`, `apps/api/src/email/send.ts`, `apps/web/src/lib/env.ts`

### External References

- [standard-schema spec](https://standardschema.dev/schema) — `~standard.validate()` interface
- [StandardJSONSchemaV1 spec](https://standardschema.dev/json-schema) — `~standard.jsonSchema` interface
- [unplugin](https://github.com/unjs/unplugin) — unified plugin factory, hook limitations
- [defu](https://github.com/unjs/defu) — deep merge with `createDefu()` custom mergers
- [yaml](https://github.com/eemeli/yaml) — YAML parsing
- [jiti](https://github.com/unjs/jiti) — runtime TypeScript evaluation
- [t3-env](https://env.t3.gg/docs/core) — reference for `clientPrefix` public/private split pattern
- [TanStack Router](https://github.com/TanStack/router) — `.gen.ts` file convention reference
