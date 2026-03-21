---
description: Comprehensive code review for maintainability, type safety, and fast feedback loops in TypeScript library packages
argument-hint: "[package-path]"
---

# Review TypeScript Package — Maintainability, Type Safety & Fast Feedback

Comprehensive code review for long-term health of TypeScript library packages. Evaluates maintainability, type safety, and fast feedback loops through targeted grep scans, deep analysis, and actionable scoring.

## Usage

```
/review-ts-package [package-path]
```

- `package-path`: Optional path to the package directory (defaults to current working directory)

---

## Workflow

### Phase 1: Inventory

Gather baseline metrics to scope the review.

1. **File counts** — `.ts`, `.tsx`, `.test.ts`, `.spec.ts`, `.gen.ts`, `.gen.d.ts`
2. **Entry points** — `package.json` exports map, main/module/types fields
3. **Dependencies** — `dependencies` vs `devDependencies` count, any `@types/*` that should be dev-only
4. **TypeScript strictness** — Read `tsconfig.json` for `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
5. **Test infrastructure** — Test runner, coverage config, watch mode support
6. **Git velocity** — Recent commit count, number of contributors, last modified dates

```bash
# Quick file census
find . -name "*.ts" -not -path "*/node_modules/*" | wc -l
find . -name "*.test.ts" -o -name "*.spec.ts" | wc -l
find . -name "*.gen.ts" -o -name "*.gen.d.ts" | wc -l
```

Record the inventory — it contextualizes all findings.

### Phase 2: Anti-Pattern Scan

Run targeted grep patterns organized by dimension. Each pattern has a purpose and expected action.

#### Maintainability Patterns

| Pattern                                                               | What it finds                                | Severity |
| --------------------------------------------------------------------- | -------------------------------------------- | -------- |
| `: any`                                                               | Explicit `any` usage                         | HIGH     |
| `as any`                                                              | Type assertion to any                        | HIGH     |
| `console.log\|console.debug\|console.warn`                            | Console statements in library code           | MEDIUM   |
| `^\s{16,}`                                                            | Deep nesting (4+ levels with 4-space indent) | MEDIUM   |
| Function bodies >50 lines                                             | Overly long functions                        | MEDIUM   |
| Duplicated logic blocks                                               | Copy-paste code                              | MEDIUM   |
| Unused exports (exported but never imported internally or externally) | Dead exports                                 | LOW      |
| Magic strings/numbers without const                                   | Unnamed constants                            | LOW      |

```
grep patterns:
  : any[^t]             — any usage (exclude "anything", "anywhere")
  as any                — type assertion to any
  console\.(log|debug|warn|error)\( — console statements
  ^\s{16,}\S            — deep nesting (16+ spaces)
  // TODO|// FIXME|// HACK — tech debt markers
  eslint-disable        — lint rule suppressions
```

#### Type Safety Patterns

| Pattern                                          | What it finds                          | Severity |
| ------------------------------------------------ | -------------------------------------- | -------- |
| `as [A-Z]` (excl. `as const`)                    | Type assertions                        | HIGH     |
| Exported functions without explicit return types | Missing return types on public API     | MEDIUM   |
| `any` in function parameters                     | Untyped parameters                     | HIGH     |
| `Record<string, unknown>` on validated data      | Lost type information                  | MEDIUM   |
| Generic `T` not propagated through call chain    | Type information dropped               | HIGH     |
| Missing `readonly` on config objects             | Mutability where immutability expected | LOW      |

```
grep patterns:
  as [A-Z]\w+           — type assertions (exclude as const)
  \): [^{]              — return type annotation presence check
  Record<string,        — generic record usage
  readonly              — readonly modifier usage
  Readonly<             — readonly utility type
```

#### Fast Feedback Patterns

| Pattern                                          | What it finds                | Severity |
| ------------------------------------------------ | ---------------------------- | -------- |
| `readFileSync\|writeFileSync` in non-CLI code    | Sync filesystem in hot paths | HIGH     |
| Exported symbols without corresponding test      | Untested public API          | MEDIUM   |
| Tests writing to real filesystem without cleanup | Test isolation issues        | MEDIUM   |
| No `--watch` or HMR support in dev scripts       | Slow iteration loop          | LOW      |
| Unnecessary file regeneration on every build     | Wasted build time            | LOW      |

```
grep patterns:
  readFileSync          — sync file reads
  writeFileSync         — sync file writes
  mkdirSync             — sync directory creation
  existsSync            — sync existence checks (OK in CLI, flag in library)
  fs.watch|chokidar     — file watching support
  --watch               — watch mode in scripts
```

### Phase 3: Deep Analysis

Go beyond grep patterns into structural analysis.

#### Maintainability Deep Dive

1. **Module dependency direction** — Do modules depend on abstractions or concrete implementations? Check import graph for circular dependencies.
2. **Interface consistency** — Do similar modules (loaders, generators, validators) follow consistent patterns? Compare function signatures across related files.
3. **Separation of concerns** — Is generation logic independent from loading logic? Can you test one without the other?

```
grep patterns for dependency analysis:
  import .* from '\./    — relative imports (map the dependency graph)
  import .* from '\.\./  — parent directory imports (potential abstraction leak)
  import type            — type-only imports (good separation)
```

#### Type Safety Deep Dive

1. **Generic propagation** — Trace the generic `T` (or `TConfig`, etc.) through the full call chain:
   - `defineConfig<T>()` -> `loadConfig<T>()` -> `validateConfig<T>()` -> return typed value
   - Does `T` survive every hop or get widened to `unknown` / `any` somewhere?
2. **Trust boundaries** — Is `fetchPublicConfig<T>()` a trust-cast (asserts the server returns `T` without validation)? Document where validation actually happens vs where types are assumed.
3. **Generated type fidelity** — Do generated types match runtime values? Check for drift between schema definitions and generated TypeScript types.

#### Fast Feedback Deep Dive

1. **Test isolation** — Do tests use temp directories? Can tests run in parallel without conflicts?
2. **Build efficiency** — Is tree-shaking supported? Are there unnecessary barrel files that prevent it?
3. **Coverage gaps** — Map exported symbols to test files. Identify untested public API surface.
4. **Run actual checks:**

```bash
# Type check
pnpm tsc --noEmit 2>&1 | head -50

# Run tests
pnpm test 2>&1 | tail -30

# Check for circular deps (if tool available)
npx madge --circular src/ 2>/dev/null
```

### Phase 4: Scoring

Rate each dimension 1-5 using these criteria.

#### Maintainability

| Score | Criteria                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------- |
| 5     | Zero `any`, no console statements, all functions <30 lines, clear module boundaries, no circular deps |
| 4     | Minimal `any` (1-2 justified), functions mostly <40 lines, good separation of concerns                |
| 3     | Some `any` usage, a few long functions, module boundaries mostly clean                                |
| 2     | Frequent `any`, several 50+ line functions, tangled dependencies                                      |
| 1     | Pervasive `any`, god functions, circular dependencies, no clear architecture                          |

#### Type Safety

| Score | Criteria                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------- |
| 5     | Full strict mode, generics propagate end-to-end, no `as` assertions, explicit trust boundaries |
| 4     | Strict mode, minor gaps in generic propagation, rare justified assertions                      |
| 3     | Mostly strict, some `as` assertions, generics partially propagated                             |
| 2     | Missing strict flags, frequent assertions, generics break mid-chain                            |
| 1     | No strict mode, pervasive `any`/`as`, no generic propagation                                   |

#### Fast Feedback

| Score | Criteria                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------ |
| 5     | Tests pass fast (<10s), full coverage of public API, watch mode, no sync IO in library, isolated tests |
| 4     | Tests pass <30s, good coverage, minor isolation gaps                                                   |
| 3     | Tests pass <60s, moderate coverage, some sync IO                                                       |
| 2     | Slow tests, poor coverage, shared test state, no watch mode                                            |
| 1     | Tests broken or absent, sync IO everywhere, no dev tooling                                             |

---

## Output Format

### Score Table

```
## TypeScript Package Review

| Dimension        | Score | Grade | Summary |
|------------------|-------|-------|---------|
| Maintainability  | X/5   | A-F   | ...     |
| Type Safety      | X/5   | A-F   | ...     |
| Fast Feedback    | X/5   | A-F   | ...     |
| **Overall**      | **XX/15** | **X** | |

Grade scale: A (13-15) / B (10-12) / C (7-9) / D (4-6) / F (<4)
```

### Findings

Group findings by dimension. Use this format:

```
### Maintainability Findings

[HIGH] M-001: Excessive `any` usage in config loader
  File: src/loader.ts:42
  Problem: `any` used for parsed YAML output, losing type safety downstream
  Fix: Define a `RawConfig` type for parsed YAML, validate with zod/valibot
  Effort: Medium (1-2 hours)

[MEDIUM] M-002: Function exceeds 50 lines
  File: src/generator.ts:78-145
  Problem: `generateTypes()` handles parsing, transforming, and writing in one function
  Fix: Extract `parseSchema()`, `transformToTS()`, and `writeOutput()` helpers
  Effort: Low (30 minutes)
```

### Top 3 Priorities

End with the three highest-impact changes:

```
## Top 3 Priorities

1. **M-001: Eliminate `any` in config loader** — Highest type safety impact, unlocks better inference downstream
2. **T-003: Propagate generic through validate step** — Currently widens to `unknown` at validation boundary
3. **F-001: Add test isolation with tmp directories** — Tests currently share filesystem state, fails in CI parallel mode
```

### Architecture Notes

Optional section for structural observations that don't fit neatly into findings:

```
## Architecture Notes

- The loader/generator/validator triad follows a clean pipeline pattern. Maintain this.
- Consider extracting the schema definition types into a separate entry point for lighter client imports.
- The generated types file is the primary integration surface for downstream consumers — treat it as a public API.
```
