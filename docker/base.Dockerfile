FROM node:24-slim
RUN apt-get update && apt-get install -y \
    jq \
    curl \
    ca-certificates \
    python3-full \
    python3-pip
RUN rm -rf /var/lib/apt/lists/* && apt-get clean

RUN curl https://mise.run | MISE_INSTALL_PATH=/usr/local/bin/mise bash

ENV MISE_YES=1
ENV PATH="/root/.local/share/mise/shims:$PATH"
WORKDIR /app
COPY .config/mise.toml package.json ./
RUN --mount=type=secret,id=GITHUB_TOKEN,required=false \
    GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN 2>/dev/null || true) \
    mise trust && mise install && mise reshim

# install root dependencies and turbo globally
COPY turbo.json package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    LEFTHOOK=0 pnpm install --no-link-workspace-packages --frozen-lockfile
ENV PATH="/app/node_modules/.bin:$PATH"
