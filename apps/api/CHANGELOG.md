# @bubsie/api

## 0.4.0

### Minor Changes

- d95914b: Send a pairing device to your own Bubsie server. On the approve page, "Using your own server?" checks the address you enter, moves the device's code there, and opens that server's approve page once the device has arrived. No account on this server is needed, and sign-in tokens never pass through it. The API adds `redirectDeviceCode`, `confirmDeviceCodeRedirect`, the `deviceCodeRedirect` query, a `redirected` poll status, and an optional `code` on `requestDeviceCode`. `/.well-known/config` is now readable from other origins.

### Patch Changes

- Updated dependencies [d95914b]
  - @bubsie/standard-config@0.1.2
  - @bubsie/vite-config@0.0.3

## 0.3.0

### Minor Changes

- 90d6c9e: Remove the AI and voice features (voice input, home-screen insights, pump hints) and the Tambo integration behind them. Logging, timers, history, growth, pumping, and station mode work as before.

  Breaking for self-hosters: the web app no longer reads `BUBSIE_WEB_TAMBO_URL` or `BUBSIE_WEB_TAMBO_API_KEY`. Remove them from your `.env` and compose file; if they stay set they are ignored. The API no longer exposes the `agentThread` query or `updateAgentThread` mutation. The `agent_threads` table is left in place.

### Patch Changes

- 90d6c9e: Keep unsaved changes across tab switches and reloads, and stop offline replays losing or duplicating entries.

  - Pending logs, edits, deletes, and discards are stored durably and resent after a reload.
  - The page now owns unsent changes and resends them when the app opens, comes back online, or becomes visible. The service worker no longer queues requests, so nothing is sent while the app is closed.
  - `logEvent` accepts an optional client-generated `id` and returns the existing event when that id is sent again, and `deleteEvent` succeeds when the event is already gone.
  - Editing or deleting an event from an older week is sent to the server again.
  - Growth measurements are stored as a calendar day, so they read the same in every timezone.
  - Editing a timed bottle feed keeps its duration, and a solid feed logs instantly from the sheet.
  - The API marks its own refusals with an error code and masks unexpected errors, so database error text no longer reaches clients. A request without a valid session now returns HTTP 401.
  - Temporary server errors are retried automatically, and signing out with unsent entries asks first.
  - A temporary failure while refreshing a session no longer signs the parent out, and a rejected refresh token is now an explicit refusal.

## 0.2.0

### Minor Changes

- fed6a29: Rename to Bubsie. Settings are now read from `BUBSIE_API_*` / `BUBSIE_WEB_*`, and every URL, domain, and secret must be set explicitly: the servers exit at startup if one is missing. Adds a self-hosting compose file and guide.

### Patch Changes

- Updated dependencies [fed6a29]
  - @bubsie/standard-config@0.1.1
  - @bubsie/vite-config@0.0.2

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

### Patch Changes

- Updated dependencies [762d745]
- Updated dependencies [b704a42]
  - @bubsie/standard-config@0.1.0
  - @bubsie/db@0.1.0
  - @bubsie/zpages@0.0.1
  - @bubsie/vite-config@0.0.1
