---
description: Evaluate whether AI coding agents can discover, understand, integrate, debug, and generate code for a TypeScript package
argument-hint: "[package-path]"
---

# DX Review — Agentic DX Reviewer

Evaluate whether AI coding agents can discover, understand, integrate, debug, and generate code for a TypeScript package — while guarding against context-window bloat.

## Usage

```
/dx-review [package-path]
```

- `package-path`: Optional path to the package directory (defaults to current working directory)

---

## Scoring Dimensions

Rate each dimension 1-5. Total possible: 30 points.

| Dimension      | What it checks                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| **Discover**   | Entry point naming, verb-first functions, `defineX` starting point, no confusing synonyms                       |
| **Understand** | Types self-documenting, JSDoc only where types are ambiguous, `@example` on non-obvious APIs                    |
| **Integrate**  | Minimal setup steps, sensible defaults, required vs optional field ratio, usage examples in JSDoc               |
| **Debug**      | Structured error classes, actionable messages (what + where + fix), exported error types, diagnostic tools      |
| **Generate**   | JSON Schema output, generated types quality, env var mapping derivable from schema, auto-generated file headers |
| **Bloat**      | Total export count, barrel file re-exports, internal types leaked to public API, namespace `export *` chains    |

### Rubric

**5 — Exemplary:** An agent can use this with zero human intervention. Everything is discoverable from types and names alone.

**4 — Good:** Minor friction. An agent might need one clarifying read of a JSDoc block or README section.

**3 — Adequate:** Works but requires reading docs or source to fill gaps. Some naming ambiguity or missing examples.

**2 — Poor:** Significant friction. Missing error context, confusing naming, excessive exports, or undocumented behavior.

**1 — Hostile:** An agent would actively struggle. Overloaded names, no error structure, no schema, massive barrel files.

---

## Workflow

### Phase 1: Discover

**Goal:** Can an agent find the starting point in under 3 tool calls?

1. Read `package.json` exports map / main field
2. Read the primary entry point file
3. Check function naming conventions

```
grep patterns:
  export function       — named function exports
  export const          — named const exports
  export default        — default exports (flag as ambiguous)
  defineConfig          — conventional starting point
  createConfig          — alternative starting point
  export \*             — barrel re-exports
```

**Score criteria:**

- Entry point has a clear `defineX` or `createX` function
- Function names are verb-first (`loadConfig`, `validateSchema`, not `config`, `schema`)
- No confusing synonyms (e.g., both `config` and `configuration`, or `load` and `read` and `get` for the same concept)
- `package.json` exports map is clean and intentional

**Anti-patterns:**

- Default exports with no name hint
- Multiple entry points with overlapping functionality
- Generic names: `index`, `main`, `utils`, `helpers`

### Phase 2: Understand

**Goal:** Can an agent understand the API from types alone, without reading docs?

1. Read exported type definitions
2. Check JSDoc presence and quality
3. Verify `@example` tags on non-obvious APIs

```
grep patterns:
  @example              — usage examples in JSDoc
  @param                — parameter documentation
  @returns              — return type documentation
  @deprecated           — deprecation notices
  @see                  — cross-references
```

**Score criteria:**

- Types are self-documenting (descriptive property names, union types over booleans)
- JSDoc adds value beyond what types already express
- `@example` present on functions where usage isn't obvious from the signature
- Generics have descriptive names (`TConfig` not just `T`)

**Anti-patterns to flag:**

- JSDoc that restates the type signature: `@param name - the name` on `name: string`
- JSDoc on every internal function (bloats agent context)
- JSDoc blocks over 10 lines on simple functions
- Types named `Data`, `Info`, `Item`, `Params` without qualification

### Phase 3: Integrate

**Goal:** Can an agent go from zero to working integration in minimal steps?

1. Count required vs optional fields in primary config type
2. Check for sensible defaults
3. Look for minimal viable usage pattern

```
grep patterns:
  required:             — required field markers
  optional:             — optional field markers
  default:              — default values
  Partial<              — partial types (optional-heavy)
  Required<             — required types
```

**Score criteria:**

- Minimal required fields (ideally 0-2 for basic usage)
- Sensible defaults for everything that can have one
- A "happy path" that works with just `defineConfig({})` or similar minimal input
- Required vs optional ratio: fewer required = better agent experience

**Anti-patterns:**

- Requiring >5 fields for basic functionality
- No defaults — every field must be explicitly set
- Configuration that requires reading source code to understand valid values
- Setup that requires multiple files or steps

### Phase 4: Debug

**Goal:** When something goes wrong, can an agent diagnose and fix without human help?

1. Find error classes and error creation sites
2. Check error message quality
3. Verify error types are exported

```
grep patterns:
  extends Error         — custom error classes
  throw new             — error throw sites
  Error(                — error construction
  .code =               — error codes
  .cause =              — error cause chaining
```

**Score criteria:**

- Structured error classes (not bare `Error("something broke")`)
- Messages include: what failed + where (file/key) + how to fix
- Error types exported so agents can catch specific errors
- Diagnostic tools or validation functions available
- Error codes for programmatic handling

**Anti-patterns:**

- Generic messages: `"Invalid config"`, `"Error occurred"`
- Errors without actionable fix suggestions
- Swallowed errors or silent fallbacks that hide problems
- Error types internal-only (can't `catch (e) { if (e instanceof ConfigError) }`)

### Phase 5: Generate

**Goal:** Can an agent generate correct config files, types, or schemas from the package?

1. Check for JSON Schema generation
2. Evaluate generated type quality
3. Verify env var mapping is derivable

```
grep patterns:
  schema.json           — JSON Schema files
  .gen.ts               — generated TypeScript files
  .gen.d.ts             — generated declaration files
  @generated            — generated file markers
  DO NOT EDIT           — generated file headers
```

**Score criteria:**

- JSON Schema available and accurate
- Generated types include comments explaining origin
- Generated files have clear "do not edit" headers
- Env var names derivable from schema (predictable mapping)
- Schema-to-type pipeline is documented or obvious

**Anti-patterns:**

- No schema output at all
- Generated types missing JSDoc or origin info
- Env var mapping requires reading implementation source
- Generated files without headers (agent might try to edit them)

### Phase 6: Bloat

**Goal:** Does the package respect agent context windows?

1. Count total exports from all entry points
2. Check for barrel file re-export chains
3. Identify internal types leaked to public API

```bash
# Count exports
grep -r "^export " src/ --include="*.ts" | wc -l

# Find barrel files
find src/ -name "index.ts" -exec grep -l "export \*" {} \;

# Find export * chains
grep -r "export \* from" src/ --include="*.ts"
```

**Score criteria:**

- Total exports reasonable for package scope (rule of thumb: <20 for focused packages)
- No barrel file re-export chains (`index.ts` that just re-exports everything)
- Internal types not leaked to public API
- Tree-shaking friendly (named exports, not namespace objects)

**Anti-patterns to flag:**

- `export *` chains (each one multiplies context needed)
- > 20 exports for a focused, single-purpose package
- Internal utility types in public API surface
- Namespace re-exports that pull in entire dependency trees
- Barrel `index.ts` files that re-export everything from subdirectories

---

## Output Format

### Scorecard

```
## Agentic DX Scorecard

| Dimension  | Score | Notes |
|------------|-------|-------|
| Discover   | X/5   | ...   |
| Understand | X/5   | ...   |
| Integrate  | X/5   | ...   |
| Debug      | X/5   | ...   |
| Generate   | X/5   | ...   |
| Bloat      | X/5   | ...   |
| **Total**  | **XX/30** | |

Grade: A (25-30) / B (20-24) / C (15-19) / D (10-14) / F (<10)
```

### Per-Dimension Findings

For each dimension, list specific findings:

```
### Discover (X/5)

- [HIGH] path/to/file.ts:42 — Default export with no name hint; agents will guess wrong
- [MEDIUM] path/to/index.ts:1 — Both `loadConfig` and `readConfig` exported; which one?
- [LOW] package.json — Exports map includes internal paths
```

### Priority Recommendations

End with the top 3 changes ranked by impact-to-effort ratio:

```
## Top 3 Priorities

1. **[Impact: HIGH, Effort: LOW]** Add `@example` to `defineConfig` — agents will copy-paste this
2. **[Impact: HIGH, Effort: MEDIUM]** Export `ConfigError` type — agents can't catch specific errors today
3. **[Impact: MEDIUM, Effort: LOW]** Remove `export *` from index.ts — cuts agent context by ~40%
```
