FROM alpine
RUN apk add --no-cache npm gcompat curl bash
RUN curl https://mise.run | MISE_INSTALL_PATH=/usr/local/bin/mise bash
ENV MISE_YES=1
ENV PATH="/root/.local/share/mise/shims:$PATH"
WORKDIR /app
COPY mise.toml ./
RUN mise trust && mise install && mise reshim

# install root dependencies and turbo globally
COPY turbo.json package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --no-link-workspace-packages --frozen-lockfile
ENV PATH="/app/node_modules/.bin:$PATH"
