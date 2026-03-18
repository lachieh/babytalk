FROM node:24-slim

RUN apt-get update && apt-get install -y \
    jq \
    dumb-init
RUN rm -rf /var/lib/apt/lists/* && apt-get clean

ENV NODE_ENV=production
WORKDIR /app
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/readyz | jq -e '.status == "ok"' > /dev/null
