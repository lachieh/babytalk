FROM alpine AS base
RUN apk add --no-cache mise npm
ENV MISE_YES=1
ENV PATH="/root/.local/share/mise/shims:$PATH"
WORKDIR /app
COPY mise.toml ./
RUN mise trust && mise install && mise reshim

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm turbo build --filter=@babytalk/api
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter=@babytalk/api --config.node-linker=hoisted deploy --prod /app/deploy

FROM alpine AS runner
RUN apk add --no-cache nodejs-current
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
COPY --from=build /app/deploy .
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/readyz').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
USER appuser
EXPOSE 4000
CMD ["node", "dist/index.js"]
