# Infrastructure

## Overview

Babytalk runs on a single Hetzner Cloud VPS managed by Coolify, with Cloudflare
providing DNS, TLS termination, and tunneled connectivity.

```
Internet → Cloudflare Edge (TLS termination)
         → Cloudflare Tunnel (cloudflared on server)
         → Traefik reverse proxy (Coolify-managed, port 443)
         → Docker containers (API / Web)
```

## Server

| Property   | Value                             |
| ---------- | --------------------------------- |
| Provider   | Hetzner Cloud                     |
| Plan       | CPX21                             |
| OS         | Ubuntu 24.04                      |
| Management | Coolify (self-hosted)             |
| Dashboard  | `https://hosting.devbox.party`    |
| Proxy      | Traefik v3.6 (managed by Coolify) |

## Domain: `devbox.party`

### DNS (Cloudflare)

| Record                 | Type  | Target                         | Proxied |
| ---------------------- | ----- | ------------------------------ | ------- |
| `devbox.party`         | CNAME | `<tunnel-id>.cfargotunnel.com` | Yes     |
| `*.devbox.party`       | CNAME | `<tunnel-id>.cfargotunnel.com` | Yes     |
| `hosting.devbox.party` | CNAME | `<tunnel-id>.cfargotunnel.com` | Yes     |
| `ssh.devbox.party`     | CNAME | `<tunnel-id>.cfargotunnel.com` | Yes     |

**Important**: All subdomains are single-level (e.g. `babytalk-staging.devbox.party`,
not `babytalk.staging.devbox.party`). Multi-level wildcard subdomains like
`*.staging.devbox.party` don't work because Cloudflare's Universal SSL certificate
only covers `devbox.party` and `*.devbox.party`. Second-level wildcards require
Advanced Certificate Manager ($10/mo).

### Subdomain Convention

Use hyphens to encode environment into the subdomain:

```
<app>-<environment>.devbox.party
```

Examples:

- `babytalk-staging.devbox.party` (web, staging)
- `babytalk-api-staging.devbox.party` (API, staging)
- `babytalk-on.devbox.party` (web, production)
- `babytalk-api-on.devbox.party` (API, production)
- `hosting.devbox.party` (Coolify dashboard)
- `ssh.devbox.party` (SSH access via cloudflared)

## Cloudflare Tunnel

| Property | Value                                         |
| -------- | --------------------------------------------- |
| Name     | Hetzner                                       |
| ID       | `7ba2ef4b-efb4-4738-a9c5-d964ed7a18cd`        |
| Config   | Remote (managed via Cloudflare API/dashboard) |
| Agent    | cloudflared 2026.3.0 on the Hetzner server    |

### Ingress Rules

| Hostname               | Service                 | Origin Request         |
| ---------------------- | ----------------------- | ---------------------- |
| `hosting.devbox.party` | `http://localhost:8000` | —                      |
| `ssh.devbox.party`     | `ssh://localhost:22`    | —                      |
| `devbox.party`         | `https://localhost:443` | `matchSNItoHost: true` |
| `*.devbox.party`       | `https://localhost:443` | `matchSNItoHost: true` |
| _(catch-all)_          | `http_status:404`       | —                      |

### `matchSNItoHost` — Why It's Required

Cloudflare terminates TLS at the edge and re-establishes a TLS connection to the
origin (Traefik on port 443). By default, `cloudflared` sends `localhost` as the
SNI, which causes Traefik to fail the TLS handshake because its Let's Encrypt
certificates are issued for the actual domain names.

`matchSNItoHost: true` tells `cloudflared` to forward the original request
hostname as the SNI (e.g. `babytalk-staging.devbox.party`), allowing Traefik to
present the correct certificate.

**Do not use `noTLSVerify`** — the server has valid Let's Encrypt certificates
managed by Traefik. Skipping verification would mask certificate issues.

## Coolify Applications

| UUID (short)  | Name         | Environment | Domain                                      |
| ------------- | ------------ | ----------- | ------------------------------------------- |
| `cg51gprd...` | babytalk-api | Staging     | `https://babytalk-api-staging.devbox.party` |
| `sneaof93...` | babytalk-web | Staging     | `https://babytalk-staging.devbox.party`     |
| `sbyja1jz...` | babytalk-api | Production  | `https://babytalk-api-on.devbox.party`      |
| `zkranruk...` | babytalk-web | Production  | `https://babytalk-on.devbox.party`          |

### Coolify CLI

The `coolify` CLI is installed via mise and pre-configured. Common commands:

```sh
coolify app list                          # list all applications
coolify app get <uuid>                    # get app details
coolify app restart <uuid>                # restart an app
coolify app env list <uuid>               # list environment variables
coolify app deployments list <uuid>       # list deployments
coolify app logs <uuid>                   # view app logs
```

### Coolify API

The CD pipeline (`.github/workflows/cd.yml`) triggers deployments via Coolify's
REST API. Secrets are stored in GitHub Actions environment secrets:

- `COOLIFY_API_URL` — Coolify instance URL
- `COOLIFY_TOKEN` — API bearer token
- `COOLIFY_API_UUID` — API application UUID
- `COOLIFY_WEB_UUID` — Web application UUID

## Cloudflare API

The zone-scoped API token is stored in `.mise.local.toml` as
`CLOUDFLARE_ZONE_API_KEY`. It has permissions for:

- `#dns_records:read` / `#dns_records:edit`
- `#zone_settings:read` / `#zone_settings:edit`
- `#zone:read` / `#zone:edit`

It also has account-level tunnel access. Zone ID: `e0d692724626f6a230a3ca0cc79f3165`.
Account ID: `80455b166b5749e896bf0abc62a49503`.

### Common API Patterns

```sh
# List DNS records
curl -s -H "Authorization: Bearer $CLOUDFLARE_ZONE_API_KEY" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records"

# Get tunnel config
curl -s -H "Authorization: Bearer $CLOUDFLARE_ZONE_API_KEY" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations"

# Update tunnel config (PUT replaces entire config — always include all rules)
curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_ZONE_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
  -d '{"config": {"ingress": [...], "warp-routing": {"enabled": false}}}'
```

**Warning**: The tunnel configurations endpoint uses PUT, not PATCH. You must
include the complete ingress list every time — omitted rules will be deleted.

## TLS / Certificate Chain

```
Client ↔ Cloudflare Edge    : Cloudflare Universal SSL (*.devbox.party)
Cloudflare ↔ Origin (Traefik): Let's Encrypt (per-domain, HTTP challenge via Traefik)
```

Traefik is configured with `certresolver=letsencrypt` using HTTP challenge on
port 80. Cloudflare's proxy passes ACME challenge traffic through to the origin.

## Adding a New Application

1. Create the application in Coolify with domain `https://<name>.devbox.party`
2. The `*.devbox.party` DNS wildcard and tunnel ingress already cover it
3. Traefik will auto-provision a Let's Encrypt certificate on first request
4. If the app needs a dedicated tunnel service (non-443), add an ingress rule
   **above** the `*.devbox.party` catch-all
