---
"@babytalk/standard-config": minor
"@babytalk/db": minor
"@babytalk/api": minor
"@babytalk/web": minor
---

Code generation with type-safe env vars

- Wire up standard-config unplugin in API (Vite) and web (webpack/Next.js)
- Generate `.gen.ts` with `Config` and `PublicConfig` types
- Generate `.env.d.ts` with type-safe `process.env` and `import.meta.env` declarations
- Generate `.schema.json` for editor autocomplete in config files
- JSDoc descriptions from `.describe()` propagate to all generated types
- Use `babytalk_api` and `babytalk_web` prefixes for unique env var namespacing
- Refactor db package to use `initDb()` factory, initialized from API config
- Add `database_url` to API config schema
