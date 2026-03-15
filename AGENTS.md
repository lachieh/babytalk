# Babytalk Monorepo — Agent Guide

## Monorepo Structure

```
babytalk/
├── apps/
│   ├── api/          # GraphQL Yoga API (port 4000)
│   └── web/          # Next.js frontend (port 3000)
└── packages/
    ├── db/           # Drizzle ORM schema, client, migrations
    └── tsconfig/     # Shared TypeScript configs
```

Tooling: Turborepo, pnpm workspaces, Ultracite (oxlint + oxfmt).

## Live Types via publishConfig

Internal packages (e.g. `@babytalk/db`) use the **publishConfig pattern** from
[colinhacks.com/essays/live-types-typescript-monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)
to provide instant type feedback without build steps.

### How it works

The top-level `exports` field points directly at raw `.ts` source files:

```json
"exports": {
  ".": "./src/index.ts",
  "./schema": "./src/schema/index.ts"
}
```

During development, tools like `tsx`, Next.js (`transpilePackages`), and
TypeScript itself resolve these entries and extract types straight from the
source. Changes propagate immediately — no `tsc --watch` or build step needed.

The `publishConfig` block overrides `exports` at publish time so that
consumers outside the monorepo receive compiled JS + declaration files:

```json
"publishConfig": {
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

**pnpm** is the only package manager that applies `publishConfig` overrides to
`exports`. This is a pnpm-specific feature — npm and yarn ignore it.

### Rules for new internal packages

1. Set `"exports"` to point at raw `.ts` entry points.
2. Add a `"publishConfig"` block that maps the same entry points to compiled
   `dist/` outputs with explicit `"types"` and `"import"` conditions.
3. Do **not** add a top-level `"main"` or `"types"` field — `exports` is
   sufficient for modern Node.js and TypeScript.
4. If the package is consumed by Next.js, add it to `transpilePackages` in
   `apps/web/next.config.ts`.

## Dev Environment

### Services (Docker Compose)

- **PostgreSQL 17** — `localhost:5432` (user/pass/db: `babytalk`)
- **Mailpit** — SMTP on `localhost:1025`, web UI on `localhost:8025`

Start with `docker compose up -d`.

### Running

```sh
pnpm dev          # starts both apps via Turborepo
pnpm check        # lint (ultracite/oxlint)
pnpm fix          # auto-fix lint + format (ultracite/oxfmt)
```

### Database

```sh
pnpm db:generate  # generate migration from schema changes
pnpm db:migrate   # apply migrations
pnpm db:studio    # open Drizzle Studio
```

Schema lives in `packages/db/src/schema/`. After editing a schema file, run
`pnpm db:generate` then `pnpm db:migrate`.

## Auth Flow

JWT-based with magic links. The API (`apps/api`) handles the full flow:

1. `Mutation.requestMagicLink(email)` — creates token in `magic_links` table,
   sends email via SMTP (Mailpit in dev).
2. User clicks link → `Mutation.verifyMagicLink(token)` — validates token,
   upserts user, returns JWT.
3. Frontend stores JWT in localStorage and sends it as
   `Authorization: Bearer <token>` on subsequent GraphQL requests.

JWT signing uses `jose` with HS256. Secret is configured via `JWT_SECRET` env
var in `apps/api`.

## GraphQL API

- **Server**: GraphQL Yoga (standalone HTTP, port 4000)
- **Schema**: Pothos type-safe builder (`apps/api/src/schema/`)
- **Playground**: `http://localhost:4000/graphql`

Schema is split across files in `apps/api/src/schema/`:
- `builder.ts` — Pothos SchemaBuilder instance
- `types.ts` — object type definitions (User, AuthPayload)
- `queries.ts` — query fields
- `mutations.ts` — mutation fields
- `index.ts` — imports all the above, exports the built schema

## CI/CD

### Workflows (`.github/workflows/`)

- **ci.yml** — runs on PRs, pushes to main, and manual dispatch. Spins up a
  Postgres service container and runs: lint → type-check → migrations → build.
- **release.yml** — runs on push to main. Uses `changesets/action` to either
  open a "Version Packages" PR or (when that PR merges) tag releases.
- **deploy.yml** — builds Docker images and pushes to GHCR. Two trigger paths:
  - **Every commit to main**: builds changed apps, tags `nightly` + `sha-<hash>`.
    A cleanup job prunes images keeping the last 10 per package.
  - **Tag push** (from changesets): builds the tagged app, tags with the
    semver version + `latest`.

### Changesets

Versioning and changelogs are managed with `@changesets/cli`.

```sh
pnpm changeset         # add a changeset before merging a PR
pnpm version           # apply changesets (bumps versions, updates changelogs)
pnpm release           # create git tags for changed packages
```

The release workflow automates `version` and `release` — developers only need
to run `pnpm changeset` locally and include the changeset file in their PR.

### Docker

Both apps have Dockerfiles using multi-stage builds (deps → build → runner).
Images are published to GHCR as:
- `ghcr.io/<owner>/babytalk-api`
- `ghcr.io/<owner>/babytalk-web`

The web app uses Next.js `output: "standalone"` for a minimal Docker image.

## Environment Variables

Each app/package has a `.env.example`. Copy to `.env` and adjust as needed.
The `.env` files are gitignored.
