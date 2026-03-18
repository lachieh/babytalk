# Babytalk Monorepo — Agent Guide

## Overview

Babytalk is a full-stack TypeScript application built as a pnpm monorepo. It
consists of a GraphQL API backend and a Next.js frontend, backed by PostgreSQL.
The project is in early stage — auth (magic links), user management, and basic
infrastructure are in place, with the product domain still being built out.

## Monorepo Structure

```
babytalk/
├── apps/
│   ├── api/              # GraphQL Yoga API (port 4000)
│   │   ├── src/
│   │   │   ├── auth/     # JWT + magic link logic
│   │   │   ├── email/    # Nodemailer transport (SMTP)
│   │   │   ├── schema/   # Pothos GraphQL schema
│   │   │   ├── context.ts
│   │   │   └── index.ts  # HTTP server entry point
│   │   └── Dockerfile
│   └── web/              # Next.js 15 frontend (port 3000)
│       ├── src/
│       │   ├── app/      # App Router pages
│       │   │   ├── auth/ # Login + verify pages
│       │   │   └── page.tsx
│       │   └── lib/      # urql GraphQL client setup
│       └── Dockerfile
├── packages/
│   ├── db/               # Drizzle ORM schema, client, migrations
│   │   ├── src/
│   │   │   ├── schema/   # Table definitions (users, magic_links)
│   │   │   ├── client.ts # Database connection + Drizzle instance
│   │   │   └── index.ts  # Re-exports
│   │   └── drizzle.config.ts
│   └── tsconfig/         # Shared TypeScript configs
│       ├── base.json     # Strict TS base
│       ├── node.json     # Node.js (NodeNext modules, ES2022)
│       └── nextjs.json   # Next.js (Bundler resolution, JSX)
├── .github/workflows/
│   ├── ci.yml            # Lint → type-check → migrate → build
│   ├── release.yml       # Changesets version/tag
│   └── deploy.yml        # Docker build → GHCR → Coolify
├── docker-compose.yml      # Local dev services (Postgres + Mailpit)
├── docker-compose.test.yml # Full stack from local Dockerfiles
├── docker-compose.prod.yml # Full stack from GHCR images
├── .oxlintrc.json          # Lint config (extends ultracite presets)
├── .oxfmtrc.jsonc          # Format config (oxfmt)
├── .dockerignore
├── turbo.json
└── pnpm-workspace.yaml
```

**Tooling**: Turborepo, pnpm 10.x workspaces, Ultracite (oxlint + oxfmt),
Node.js 24, TypeScript 5.

## Tech Stack

| Layer          | Technology                                        |
| -------------- | ------------------------------------------------- |
| Runtime        | Node.js 24                                        |
| Language       | TypeScript 5 (strict mode)                        |
| Package Mgr    | pnpm 10.29.3 with workspaces                      |
| Monorepo       | Turborepo                                         |
| API Server     | GraphQL Yoga 5 (standalone HTTP)                  |
| Schema         | Pothos type-safe schema builder                   |
| Frontend       | Next.js 15 (App Router, React 19)                 |
| Styling        | Tailwind CSS 4 (via PostCSS)                      |
| GraphQL Client | urql 4 + @urql/next                               |
| ORM            | Drizzle ORM (beta channel: 1.0.0-beta.17)         |
| Database       | PostgreSQL 17                                     |
| Auth           | JWT (jose, HS256) + magic links                   |
| Email          | Nodemailer (Mailpit in dev)                       |
| Linting        | Ultracite 7.3.1 (oxlint + oxfmt)                  |
| CI             | GitHub Actions                                    |
| Releases       | @changesets/cli                                   |
| Docker         | Multi-stage builds, GHCR registry                 |
| Testing        | Playwright 1.56.1 (installed, not yet configured) |
| Hosting        | Hetzner Cloud (CPX21) + Coolify                   |

## Essential Commands

```sh
# Development
pnpm install              # install all dependencies
docker compose up -d      # start Postgres + Mailpit
pnpm dev                  # start API (4000) + web (3000) via Turborepo

# Code quality
pnpm check                # lint with ultracite (oxlint)
pnpm fix                  # auto-fix lint + format (oxfmt)

# Database
pnpm db:generate          # generate migration from schema changes
pnpm db:migrate           # apply pending migrations
pnpm db:studio            # open Drizzle Studio GUI

# Build
pnpm build                # build all apps

# Type checking (as CI does it)
pnpm --filter @babytalk/api exec tsc --noEmit
pnpm --filter @babytalk/web exec tsc --noEmit

# Releases
pnpm changeset            # create changeset for PR
pnpm version              # bump versions from changesets
pnpm release              # create git tags
```

## Live Types via publishConfig

Internal packages use the **publishConfig pattern** for instant type feedback
without build steps. This is critical to understand for this monorepo.

### How it works

The `exports` field points at raw `.ts` source files:

```json
"exports": {
  ".": { "default": "./src/index.ts" },
  "./schema": { "default": "./src/schema/index.ts" }
}
```

During development, `tsx`, Next.js (`transpilePackages`), and TypeScript resolve
these entries directly. No `tsc --watch` needed.

The `publishConfig` block overrides `exports` at publish time for external
consumers. **pnpm is the only package manager that supports this.**

### Rules for new internal packages

1. Set `"exports"` to point at raw `.ts` entry points.
2. Add a `"publishConfig"` block mapping the same entries to compiled `dist/`
   outputs with explicit `"types"` and `"import"` conditions.
3. Do **not** add top-level `"main"` or `"types"` fields.
4. If consumed by Next.js, add to `transpilePackages` in
   `apps/web/next.config.ts`.

## Database

### Schema (`packages/db/src/schema/`)

Two tables currently defined:

**users** — `packages/db/src/schema/users.ts`

- `id` (uuid, PK, auto-generated)
- `email` (text, unique, not null)
- `name` (text, nullable)
- `createdAt` / `updatedAt` (timestamptz)

**magic_links** — `packages/db/src/schema/magic-links.ts`

- `id` (uuid, PK, auto-generated)
- `email` (text, not null)
- `token` (text, unique, not null)
- `expiresAt` (timestamptz, not null)
- `usedAt` (timestamptz, nullable — marks token as consumed)
- `createdAt` (timestamptz)

### Client (`packages/db/src/client.ts`)

Uses `drizzle-orm/postgres-js` with the `postgres` driver. Requires
`DATABASE_URL` env var. Exports `db` instance and `Database` type.

### Drizzle Config

- Dialect: `postgresql`
- Schema: `./src/schema/index.ts`
- Migrations output: `./src/migrations`

### Workflow

After editing a schema file:

1. `pnpm db:generate` — generates SQL migration
2. `pnpm db:migrate` — applies it to the database

### Conventions

- Column names: `snake_case` in SQL, `camelCase` in TypeScript
- All tables use `uuid` primary keys with `defaultRandom()`
- Timestamps use `timestamp("name", { withTimezone: true })`
- Schema columns are ordered alphabetically in the Drizzle definition

## GraphQL API (`apps/api`)

### Server Setup (`apps/api/src/index.ts`)

Standalone HTTP server using `createYoga` from `graphql-yoga`. CORS configured
to accept requests from `WEB_URL` (defaults to `http://localhost:3000`).

### Context (`apps/api/src/context.ts`)

Every request creates a context with:

- `db` — Drizzle database instance
- `currentUser` — JWT payload (`{ sub, email }`) or `null` if unauthenticated

Authentication is extracted from the `Authorization: Bearer <token>` header.

### Schema (Pothos) — `apps/api/src/schema/`

| File           | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `builder.ts`   | SchemaBuilder instance, typed with Context             |
| `types.ts`     | Object types: `User`, `AuthPayload`                    |
| `queries.ts`   | Query fields: `me`                                     |
| `mutations.ts` | Mutation fields: `requestMagicLink`, `verifyMagicLink` |
| `index.ts`     | Imports all files, exports built `schema`              |

**Adding new types/queries/mutations**: Create or edit files in
`apps/api/src/schema/`, then import them in `index.ts`. Pothos registers
types and fields on the builder as a **side effect** of importing the module.
The import in `index.ts` is what makes them part of the schema — if you forget
the import, the type/field won't exist. Use `builder.queryField()`,
`builder.mutationField()`, `builder.objectRef()`, etc.

### Auth Module (`apps/api/src/auth/`)

**jwt.ts** — Token signing (HS256, 7-day expiry) and verification using `jose`.
Secret from `JWT_SECRET` env var.

**magic-link.ts** — Two functions:

- `requestMagicLink(email)` — inserts token (UUID, 15-min expiry), sends email
- `verifyMagicLink(token)` — validates, marks used, upserts user, returns JWT

### Email (`apps/api/src/email/send.ts`)

Nodemailer transport configured via `SMTP_HOST`/`SMTP_PORT` env vars. In dev,
points to Mailpit (localhost:1025). Sends HTML + plaintext magic link emails.

## Frontend (`apps/web`)

### Framework

Next.js 15 with App Router, React 19, Tailwind CSS 4 (PostCSS plugin).

### Key Files

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `src/app/layout.tsx`           | Root layout (metadata, global CSS)          |
| `src/app/page.tsx`             | Landing page with sign-in link              |
| `src/app/auth/login/page.tsx`  | Magic link request form                     |
| `src/app/auth/verify/page.tsx` | Token verification + redirect               |
| `src/lib/graphql-client.ts`    | urql client factory                         |
| `src/lib/urql-provider.tsx`    | Client-side urql provider with SSR exchange |
| `next.config.ts`               | `output: "standalone"`, `transpilePackages` |

### GraphQL Client

Uses urql with `@urql/next` for SSR support. The client reads
`NEXT_PUBLIC_API_URL` and attaches JWT from `localStorage` key
`babytalk_token` as Bearer auth header.

Note: The login and verify pages use raw `fetch()` for GraphQL mutations rather
than the urql client (they are simple one-off operations).

### Styling

Tailwind CSS 4 via `@tailwindcss/postcss`. Utility classes used directly in JSX.
No component library or CSS-in-JS.

## Auth Flow (End-to-End)

1. User visits `/auth/login`, enters email
2. Frontend POSTs `requestMagicLink(email)` mutation via fetch
3. API inserts token into `magic_links` table, sends email via SMTP
4. User clicks link in email → `/auth/verify?token=<uuid>`
5. Frontend calls `verifyMagicLink(token)` mutation
6. API validates token (not expired, not used), marks as used, upserts user
7. API signs JWT with user ID + email, returns it
8. Frontend stores JWT in `localStorage` as `babytalk_token`
9. Subsequent requests include `Authorization: Bearer <token>` header

## TypeScript Configuration

Three shared configs in `packages/tsconfig/`:

- **base.json** — Strict mode, ES2022 target, declaration maps, `skipLibCheck`
- **node.json** — Extends base. `NodeNext` module resolution, `outDir: ./dist`
- **nextjs.json** — Extends base. `Bundler` resolution, JSX preserve, `noEmit`,
  Next.js plugin

All configs use `"isolatedModules": true` for compatibility with transpilers.

## CI/CD

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on PRs, pushes to main, and manual dispatch:

1. Start Postgres 17 service container
2. `pnpm install --frozen-lockfile`
3. `pnpm check` (lint)
4. `tsc --noEmit` for API and web (type-check)
5. `pnpm db:generate` + `pnpm db:migrate`
6. `pnpm build`

### Release Pipeline (`.github/workflows/release.yml`)

On push to main: uses `changesets/action` to either open a "Version Packages"
PR or (when that PR merges) create git tags.

### Deploy Pipeline (`.github/workflows/deploy.yml`)

Two trigger paths:

- **Main branch commits**: Detects changed apps via `dorny/paths-filter`, builds
  only changed Docker images, tags `nightly` + `sha-<hash>`.
- **Tag push** (from changesets): Builds tagged app, tags semver + `latest`.

API image gets a smoke test (health check via GraphQL introspection query)
before pushing. After push, triggers Coolify deployment webhook. Cleanup job
prunes to 10 most recent images per package.

Images published to GHCR:

- `ghcr.io/<owner>/babytalk-api`
- `ghcr.io/<owner>/babytalk-web`

### Changesets

```sh
pnpm changeset     # add changeset before merging PR
```

The release workflow handles `version` and `release` automatically.

Changesets config (`.changeset/config.json`): access `restricted` (private
packages), base branch `main`, internal dependency updates use `patch`.

## Docker

### API Dockerfile (`apps/api/Dockerfile`)

4-stage build: base → deps → build → runner.

- Uses `pnpm deploy --prod` with hoisted node-linker for minimal production image
- Health check: GraphQL introspection query on port 4000
- Runs as non-root `appuser`

### Web Dockerfile (`apps/web/Dockerfile`)

4-stage build: base → deps → build → runner.

- Uses Next.js `output: "standalone"` for minimal image
- Copies standalone server + static assets
- Runs as non-root `nextjs` user

### Docker Compose Variants

Three compose files for different environments:

**`docker-compose.yml`** — Local dev (services only, apps run via `pnpm dev`):

```sh
docker compose up -d
```

- **PostgreSQL 17** — `localhost:5432` (user/pass/db: `babytalk`)
- **Mailpit** — SMTP on `localhost:1025`, web UI on `localhost:8025`

**`docker-compose.test.yml`** — Full stack from local Dockerfiles:

- Builds API + Web images from source
- Postgres with health check, API depends on healthy Postgres
- Web depends on API. Mailpit included.

**`docker-compose.prod.yml`** — Full stack from GHCR images:

- Pulls `ghcr.io/lachieh/babytalk-api` and `ghcr.io/lachieh/babytalk-web`
- Uses `IMAGE_TAG` env var (defaults to `nightly`)
- Requires `POSTGRES_PASSWORD` and `JWT_SECRET` to be set

## Infrastructure

Hosted on Hetzner Cloud, managed by Coolify:

- **Server**: hthosting-alpha (`5.161.45.94`), CPX21, Ubuntu 24.04
- **Coolify Dashboard**: `http://5.161.45.94:8000`

## Environment Variables

### `apps/api/.env`

| Variable       | Default                                                  | Purpose                        |
| -------------- | -------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL` | `postgresql://babytalk:babytalk@localhost:5432/babytalk` | Postgres connection            |
| `JWT_SECRET`   | `change-me-to-a-random-secret`                           | HS256 signing key              |
| `SMTP_HOST`    | `localhost`                                              | Mail server host               |
| `SMTP_PORT`    | `1025`                                                   | Mail server port               |
| `SMTP_FROM`    | `noreply@babytalk.dev`                                   | Sender address                 |
| `WEB_URL`      | `http://localhost:3000`                                  | Frontend URL (for email links) |
| `PORT`         | `4000`                                                   | API server port                |

### `apps/web/.env`

| Variable              | Default                         | Purpose          |
| --------------------- | ------------------------------- | ---------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/graphql` | GraphQL endpoint |

### `packages/db/.env`

| Variable       | Default                                                  | Purpose     |
| -------------- | -------------------------------------------------------- | ----------- |
| `DATABASE_URL` | `postgresql://babytalk:babytalk@localhost:5432/babytalk` | Drizzle CLI |

## Code Conventions

### Style & Formatting

- **Ultracite** handles all formatting and linting. Run `pnpm fix` before
  committing.
- **oxfmt** for formatting (`.oxfmtrc.jsonc`): 80-char width, double quotes,
  semicolons, 2-space indent, trailing commas (ES5), sorted imports
  (ascending, case-insensitive), sorted `package.json` fields.
- **oxlint** for linting (`.oxlintrc.json`): extends ultracite core + next +
  react presets. `oxc/no-barrel-file` is explicitly disabled (barrel files
  are allowed).
- No pre-commit hooks (no husky/lint-staged).

### TypeScript Patterns

- ESM throughout (`"type": "module"` in all packages)
- `.js` extensions in relative imports (required for NodeNext resolution):
  `import { foo } from "./bar.js"`
- Arrow functions for exports and callbacks
- `const` by default, `let` only when needed
- Destructuring for object parameters
- `unknown` over `any`
- Alphabetical ordering of object properties in schema definitions

### GraphQL Patterns

- Pothos builder pattern: one file per concern (types, queries, mutations)
- `builder.queryField()` / `builder.mutationField()` for individual fields
- `objectRef<Shape>("TypeName")` for type definitions
- All query/mutation files must be imported in `schema/index.ts`

### Database Patterns

- Drizzle `pgTable()` definitions with `snake_case` SQL names
- TypeScript column properties in `camelCase`
- UUID primary keys everywhere
- All timestamps include timezone (`withTimezone: true`)
- Alphabetical column ordering in table definitions

### Frontend Patterns

- Next.js App Router with `"use client"` directive where needed
- `Suspense` boundaries for client components that use search params
- Tailwind utility classes directly in JSX
- `localStorage` for auth token storage (key: `babytalk_token`)
- Path alias: `@/*` maps to `./src/*` in `apps/web/tsconfig.json`

### Import Style

- External packages first, then internal packages, then relative imports
- Explicit `.js` extension on all relative imports in Node packages

## Testing

No automated test suite yet. Playwright 1.56.1 is installed as a root
devDependency but has no config file or test files. Quality assurance is
currently handled by:

- **Static analysis**: Ultracite (oxlint) catches common issues
- **Type checking**: `tsc --noEmit` in CI for both apps
- **Docker smoke tests**: API image health check in the deploy workflow
- **Integration testing**: `docker-compose.test.yml` provides a full-stack
  environment for manual or future automated testing

## Quick Start for New Developers

```sh
git clone <repo-url> && cd babytalk
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

- API playground: http://localhost:4000/graphql
- Web app: http://localhost:3000
- Mailpit UI: http://localhost:8025
