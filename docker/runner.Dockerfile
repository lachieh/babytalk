FROM alpine
RUN apk add --no-cache nodejs-current gcompat dumb-init jq
ENV NODE_ENV=production
WORKDIR /app
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/readyz | jq -e '.status == "ok"' > /dev/null
