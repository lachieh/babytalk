# @bubsie/standard-config

## 0.1.1

### Patch Changes

- fed6a29: Rename to Bubsie. Settings are now read from `BUBSIE_API_*` / `BUBSIE_WEB_*`, and every URL, domain, and secret must be set explicitly: the servers exit at startup if one is missing. Adds a self-hosting compose file and guide.

## 0.1.0

### Minor Changes

- 762d745: Code generation with type-safe env vars

  - Wire up standard-config unplugin in API (Vite) and web (webpack/Next.js)
  - Generate `.gen.ts` with `Config` and `PublicConfig` types
  - Generate `.env.d.ts` with type-safe `process.env` and `import.meta.env` declarations
  - Generate `.schema.json` for editor autocomplete in config files
  - JSDoc descriptions from `.describe()` propagate to all generated types
  - Use `bubsie_api` and `bubsie_web` prefixes for unique env var namespacing
  - Refactor db package to use `initDb()` factory, initialized from API config
  - Add `database_url` to API config schema

- b704a42: Initial release
  - Add `@bubsie/standard-config` package with schema-validated config loading, file discovery, env var overlay, code generation, unplugin bundler plugins, CLI, and `/.well-known/config` route handler
  - Replace raw `process.env` access in API and web apps with typed config via standard-config
  - Switch all library packages from tsc to Vite 8 library builds
  - Drop `.js` extensions from all imports (Bundler module resolution)
