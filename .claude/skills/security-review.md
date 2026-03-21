# Security Review — Secret Leakage Auditor

Audit a TypeScript package for secrets leaking to clients via config endpoints, build output, generated types, env var prefixes, and error messages.

## Usage

```
/security-review [package-path]
```

- `package-path`: Optional path to the package directory (defaults to current working directory)

---

## Workflow

### Phase 1: Inventory

Locate all relevant files and entry points. Search for:

```
grep patterns:
  defineConfig(         — config definition sites
  createConfigHandler   — well-known endpoint handlers
  fetchPublicConfig     — client-side consumers
  getPublicConfig       — public config extractors
  pickPublic            — public field pickers
  loadConfig            — full config loaders
  scanEnvVars           — env var scanners
```

Also inventory:

- Generated files: `*.gen.ts`, `*.gen.d.ts`, `config.schema.json`
- Build plugins: files matching `*plugin*`, `*unplugin*`, `*vite*`, `*webpack*`
- Config files: `*.yaml`, `*.json` in root and config directories

Record each file and its role. This inventory drives all subsequent phases.

### Phase 2: Public Config Filtering Audit

**Goal:** Verify that public config uses an allowlist-only approach — never a denylist.

1. Find `getPublicConfig()` / `pickPublic()` implementations
2. Verify they select from an explicit `public` array, not by excluding private keys
3. Cross-reference every key in the `public` array against the full config schema
4. Flag any key whose name matches secret patterns:

```
secret patterns (case-insensitive):
  secret, token, password, passwd, key, apikey, api_key,
  auth, credential, private, jwt, hmac, signing,
  connection_string, dsn, bearer
```

**Checklist:**

- [ ] `getPublicConfig` uses allowlist (picks from `public` array)
- [ ] No secret-named keys appear in `public` array
- [ ] No `delete` / `omit` pattern used (denylist smell)
- [ ] Public array is defined statically, not computed at runtime

### Phase 3: Env Var Exposure Audit

**Goal:** Prevent secrets from being exposed through public env var prefixes.

1. Find env var prefix configuration (`envPrefix`, `NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_`)
2. Check for collision: a non-public config key bound to a public-prefixed env var (e.g., `NEXT_PUBLIC_APP_SECRET` mapped to a secret key)
3. Inspect generated `ImportMetaEnv` / `ProcessEnv` type augmentations for secret-named vars
4. Verify `scanEnvVars` (or equivalent runtime env reader) is never imported in client bundles

```
grep patterns:
  NEXT_PUBLIC_         — Next.js public prefix
  VITE_                — Vite public prefix
  EXPO_PUBLIC_         — Expo public prefix
  ImportMetaEnv        — Vite env type augmentation
  ProcessEnv           — Node env type augmentation
  scanEnvVars          — runtime env scanning
```

**Checklist:**

- [ ] No secret-named keys use public env prefixes
- [ ] Generated env types don't include secret-named vars
- [ ] `scanEnvVars` not imported in any client-side code
- [ ] Env prefix mapping matches the `public` array exactly

### Phase 4: Well-Known Endpoint Security

**Goal:** Verify config endpoints only serve public config with safe headers and error handling.

1. Find handler implementations (`createConfigHandler`, route handlers serving config)
2. Verify they call `getPublicConfig()` — NOT `loadConfig()` or raw config access
3. Check response cache headers (should have `Cache-Control`, no `private` config in cached responses)
4. Verify error responses don't leak config values in messages or stack traces

```
grep patterns:
  createConfigHandler  — handler factory
  loadConfig           — full config loader (should NOT appear in handlers)
  Cache-Control        — cache header setting
  res.json(config      — raw config in response (suspicious)
  JSON.stringify(config — raw config serialization (suspicious)
```

**Checklist:**

- [ ] Handlers call `getPublicConfig()`, not `loadConfig()`
- [ ] Cache headers are set appropriately
- [ ] Error responses contain messages only, no config values
- [ ] No raw config object passed to `res.json()` or `JSON.stringify()`

### Phase 5: Build-Time Leakage

**Goal:** Prevent full config types or values from being embedded in client bundles.

1. Check if the full `Config` type (not `PublicConfig`) is imported in any client-side code
2. Verify build plugins don't use `define` / `DefinePlugin` to embed secret values
3. Check that `config.schema.json` is not in `public/`, `static/`, or any served directory
4. Verify generated `.gen.ts` files with full config types aren't imported client-side

```
grep patterns:
  import.*Config.*from   — config type imports (check if full or public)
  define:                 — Vite define config
  DefinePlugin             — Webpack define plugin
  process.env.             — direct env access in client code
```

**Checklist:**

- [ ] Full `Config` type not imported in client code
- [ ] Build plugins don't embed secret values via `define`
- [ ] `config.schema.json` not in any publicly served directory
- [ ] Generated full-config types stay server-side only

### Phase 6: Config File Discovery

**Goal:** Ensure config files with secrets aren't committed or publicly served.

1. Check `.gitignore` for `*.local.yaml`, `*.local.json`, `.env.local` patterns
2. Verify no config files exist in `public/`, `static/`, `dist/`, or `out/` directories
3. Check for committed `.env` files with actual values (not `.env.example`)

```bash
# Check gitignore coverage
git ls-files --cached '*.local.yaml' '*.local.json' '.env.local'
# Check public directories
find public/ static/ dist/ out/ -name '*.yaml' -o -name '*.json' -o -name '.env*' 2>/dev/null
```

**Checklist:**

- [ ] `*.local.*` config files are gitignored
- [ ] No config files in publicly served directories
- [ ] No committed `.env` files with real values
- [ ] `.env.example` contains only placeholder values

### Phase 7: Error Handling

**Goal:** Ensure config validation errors don't leak secret values in production.

1. Find `ConfigError` or equivalent error classes
2. Check if error objects include a `received` field or similar that contains the actual config value
3. Verify these errors don't reach HTTP responses or client-visible logs
4. Check for `console.log` / `console.debug` of config objects

```
grep patterns:
  ConfigError          — config error class
  received:            — received value in error
  console.log(config   — logging config values
  console.debug(config — debug logging config values
  console.error(config — error logging config values
```

**Checklist:**

- [ ] `ConfigError.received` doesn't reach HTTP responses
- [ ] No `console.log` of full config objects
- [ ] Validation errors show key name and expected type, not received value
- [ ] Error serialization strips sensitive fields

---

## Output Format

### Findings

Report each finding in this format:

```
[SEVERITY] FINDING-ID: Title
  File: path/to/file.ts:42
  Risk: Description of what could go wrong
  Fix:  Specific recommendation to resolve
```

Severity levels:

- **CRITICAL** — Secret actively exposed to clients right now
- **HIGH** — Secret exposure possible under realistic conditions
- **MEDIUM** — Defense-in-depth gap; no immediate exposure but weakens security posture
- **LOW** — Best practice violation; minimal direct risk
- **INFO** — Observation worth noting; no action required

### Summary Checklist

End with a consolidated checklist suitable for PR reviews:

```
## PR Review Checklist — Secret Leakage

- [ ] Public config uses allowlist-only approach
- [ ] No secret-named keys in public array
- [ ] No secret keys bound to public env prefixes
- [ ] Endpoints serve getPublicConfig(), not loadConfig()
- [ ] Error responses don't include config values
- [ ] Generated types stay server-side
- [ ] Config files with secrets are gitignored
- [ ] No config files in public directories

Findings: X CRITICAL, X HIGH, X MEDIUM, X LOW, X INFO
```
