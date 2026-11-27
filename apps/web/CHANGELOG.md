# @bubsie/web

## 0.4.1

### Patch Changes

- c0ec3c8: The installed Android app's status bar now always matches the page, including when the app is dark and the phone is light. Its navigation bar is now the night colour instead of cream, so it no longer glares under the dark app. The bottom tabs also keep clear of Android's navigation bar from the first paint.

## 0.4.0

### Minor Changes

- 739f2e1: Moving between tabs is smoother: the header and bottom bar stay put, the page slides gently in the direction of the tab, and the tab marker glides across. Pages you have already seen open with what they showed last time and refresh quietly, and opening the app shows your baby and recent entries straight away while the latest is fetched. Placeholders shaped like the page only appear when there is genuinely nothing to show yet. The Feed, Sleep, Diaper and pump buttons wait until entries are known, so the side or amount they suggest is not a guess.

## 0.3.3

### Patch Changes

- ef98cbf: Editing a feed shows the same Ended and length fields as sleep, so feeds saved as a single moment can be given a finish time. Solid feeds still edit as a single time.

## 0.3.2

### Patch Changes

- 385a90f: Tapping Feed starts a feed timer again for breast, bottle and formula feeds, the same one-tap flow as sleep. Bottle and formula feeds ask for the amount after you stop the timer. Solid feeds are still logged as a single moment.

## 0.3.1

### Patch Changes

- b48044c: Week view draws sleep and feeds as square-cornered blocks: sleep fills the left 80% of each day, feeds and pumps the right 80%, and diapers sit centred as fixed-time marks, so daily patterns line up across the week.

## 0.3.0

### Minor Changes

- 90d6c9e: Remove the AI and voice features (voice input, home-screen insights, pump hints) and the Tambo integration behind them. Logging, timers, history, growth, pumping, and station mode work as before.

  Breaking for self-hosters: the web app no longer reads `BUBSIE_WEB_TAMBO_URL` or `BUBSIE_WEB_TAMBO_API_KEY`. Remove them from your `.env` and compose file; if they stay set they are ignored. The API no longer exposes the `agentThread` query or `updateAgentThread` mutation. The `agent_threads` table is left in place.

- 90d6c9e: Rework the app from a design critique so manual logging is reliable and usable with one thumb.

  - Fix the first log after onboarding doing nothing until a reload.
  - Log optimistically: entries appear at once, failed and offline saves stay visible with a retry, and toasts say whether a timer started or an entry was saved.
  - Stop past entries turning into running timers, and show growth measurements on the day they were entered.
  - Raise secondary text to WCAG AA contrast in both themes, add a visible focus style, and allow pinch-zoom.
  - Enlarge the log buttons and pickers, add start-time and bottle-amount chips, and log bottles as finished feeds.
  - Redraw the week chart, growth chart, averages view, app icon, and in-app icons. The growth chart uses recomputed WHO reference tables up to 24 months.
  - Simplify sign-in, setup, and the landing page, and reorder the history tabs.

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

- 5e55239: Add a station settings control for switching feed volume display between millilitres and fluid ounces.
- Updated dependencies [762d745]
- Updated dependencies [b704a42]
  - @bubsie/standard-config@0.1.0
  - @bubsie/zpages@0.0.1
