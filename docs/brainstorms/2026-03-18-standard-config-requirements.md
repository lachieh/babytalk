---
date: 2026-03-18
topic: standard-config
---

# @babytalk/standard-config

## Problem Frame

The babytalk monorepo currently uses raw `process.env` access with no validation, no defaults, and no type safety. Config is scattered across apps with no shared loading convention. This package provides schema-validated, type-safe config loading from files and environment variables, with a clear precedence model.

## Requirements

- R1. **Schema-agnostic validation** — Accept any [standard-schema@1.1](https://github.com/standard-schema/standard-schema) compatible schema object (Zod, Valibot, ArkType, etc.) for defining and validating config shape, defaults, and required fields.

- R2. **File discovery with precedence** — Search for config files relative to a configurable `root` path (defaults to CWD). At each directory level, `.local` variants override their non-local counterpart. `.local` variants are intended for developer-specific config and should be gitignored; XDG/HOME paths intentionally have no `.local` variants since they are already user-specific. Listed from highest to lowest precedence:
  1. `<prefix>.config.local.yaml` / `.json`
  2. `<prefix>.config.yaml` / `.json`
  3. `.config/<prefix>.local.yaml` / `.json`
  4. `.config/<prefix>.yaml` / `.json`
  5. `.config/<prefix>/config.local.yaml` / `.json`
  6. `.config/<prefix>/config.yaml` / `.json`
  7. `$XDG_CONFIG_HOME/<prefix>.yaml` / `.json`
  8. `$XDG_CONFIG_HOME/<prefix>/config.yaml` / `.json`
  9. `$HOME/.config/<prefix>.yaml` / `.json`
  10. `$HOME/.config/<prefix>/config.yaml` / `.json`

- R3. **Conflict on duplicate formats** — If both `.yaml` and `.json` exist at the same path (e.g. `app.config.yaml` and `app.config.json`), throw an error rather than silently picking one.

- R4. **Deep merge across files** — Config files are deep-merged in precedence order. Higher-precedence files override individual nested keys, not entire objects.

- R5. **Env var override with full precedence** — Environment variables always win over file values. Nested keys map to uppercased env vars using a configurable separator (default: single underscore). E.g. with prefix `APP`, `data.foo` maps to `APP_DATA_FOO`. The separator is configurable for projects where key collisions are a concern.

- R6. **Public config values** — Config values can be explicitly marked as public (client-safe). Public values generate env vars with a configurable public prefix (e.g. `VITE_PUBLIC_`, `NEXT_PUBLIC_`). Only values marked public are exposed to client-side bundles.

- R7. **Custom env var name mapping** — An optional callback function can override the default env var name for any config key. If the callback returns `null`/`undefined`, the default naming convention applies. This runs after public prefix and separator logic.

- R8. **JSON Schema generation** — Generate a JSON Schema file from the standard-schema definition, usable for editor autocomplete and external validation.

- R9. **TypeScript type generation** — Generate a `.gen.ts` file with TypeScript types derived from the schema, following TanStack conventions (`.gen.ts` suffix, lives alongside source, intended to be committed).

- R10. **Bundler plugins via unplugin** — Built on [unplugin](https://github.com/unjs/unplugin) for a single plugin definition. Exported as `@babytalk/standard-config/vite`, `@babytalk/standard-config/webpack`, etc. Generates JSON Schema and TS types on dev server start, watches for schema changes, and regenerates automatically.

- R11. **CLI command** — Provide a CLI (e.g. `standard-config generate`) for explicit generation in CI or manual use, independent of bundler plugins.

- R12. **Configurable output path** — Generated files (JSON Schema + TS types) output path is configurable. Default follows TanStack convention: `./src/config.gen.ts` and `./src/config.schema.json` alongside source.

## Success Criteria

- Config loaded from files and env vars is fully type-safe with no manual type definitions
- Invalid config throws a clear validation error at startup with the schema's error messages
- Switching schema libraries (e.g. Zod to Valibot) requires only changing the schema definition, not the config loading code
- Env vars reliably override file values for any nesting depth

## Scope Boundaries

- **Not a dotenv replacement** — This package does not load `.env` files. It reads already-set environment variables.
- **No remote config** — Files are local only. No HTTP fetching, no cloud config services.
- **No runtime config reloading** — Config is loaded once at startup. Hot-reload of config values is out of scope.
- **No TOML/INI support** — Only YAML and JSON.
- **Public release is deferred** — Ships as `@babytalk/standard-config` first; extraction to a standalone org/repo happens later if it proves useful.

## Key Decisions

- **unplugin for bundler plugins** — Single plugin implementation covers Vite, webpack, Rollup, esbuild, and more without maintaining separate codepaths.
- **standard-schema over custom validation** — Avoids coupling to any specific schema library while still providing full validation and type inference.
- **Deep merge** — Chosen over shallow merge so that local overrides can target individual keys without replacing entire objects.
- **Error on format conflict** — Prevents silent precedence bugs when both `.yaml` and `.json` exist at the same path.
- **Single underscore default separator with uppercasing** — Simpler env var names; configurable separator for projects where key collisions are a concern.
- **TanStack-style generated files** — `.gen.ts` suffix, lives in source tree, committed to version control so editors and CI work without a build step.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] Which standard-schema utilities are available for extracting JSON Schema and TypeScript types from an arbitrary standard-schema provider?
- [Affects R5][Technical] How should array values be represented in env vars? (e.g. comma-separated string, JSON string, or unsupported)
- [Affects R6][Technical] How should the public marker work with standard-schema? Wrapper function, metadata field, or separate schema for public values?
- [Affects R8, R9][Technical] Should generation happen via a shared core that both plugins and CLI call, or should the CLI shell out to the plugin?
- [Affects R10][Needs research] What unplugin hooks are needed for file watching and regeneration on schema changes?

## Next Steps

→ `/ce:plan` for structured implementation planning
