FROM base AS installer

# copy all source files and prune to app dependencies
COPY packages ./packages
COPY apps/api ./apps/api
RUN turbo prune @babytalk/api --docker

FROM base AS builder

# install dependencies solo
COPY --from=installer /app/out/json/ .
RUN pnpm install --frozen-lockfile

# copy source from pruned output and then build
COPY --from=installer /app/out/full/ .
RUN --mount=type=secret,id=TURBO_TOKEN,env=TURBO_TOKEN \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm turbo build --filter=@babytalk/api

FROM runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

COPY --from=builder /app .

ENV PORT=4000
EXPOSE 4000

CMD [ "dumb-init", "node", "apps/api/dist/index.js" ]
