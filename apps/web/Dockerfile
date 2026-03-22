FROM base AS installer

# copy all source files and prune to app dependencies
COPY packages ./packages
COPY apps/web ./apps/web
RUN turbo prune @babytalk/web --docker

FROM base AS builder

# install dependencies solo
COPY --from=installer /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    LEFTHOOK=0 pnpm install --frozen-lockfile

# copy source from pruned output and then build
COPY --from=installer /app/out/full/ .
RUN --mount=type=secret,id=TURBO_TOKEN,env=TURBO_TOKEN \
    --mount=type=secret,id=TURBO_TEAM,env=TURBO_TEAM \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm turbo build --filter=@babytalk/web

FROM runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder /app/apps/web/.next/standalone  ./
COPY --from=builder /app/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder /app/apps/web/public            ./apps/web/public

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:${PORT}/readyz | jq -e '.status == "ok"' > /dev/null

CMD ["dumb-init", "node", "apps/web/server.js"]
