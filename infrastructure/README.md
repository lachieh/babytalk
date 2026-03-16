# Infrastructure

## Hetzner Server: hthosting-alpha

- **IP**: `5.161.45.94`
- **Type**: CPX21 (3 vCPUs, 4 GB RAM, 80 GB disk)
- **OS**: Ubuntu 24.04
- **Location**: Ashburn, VA (ash-dc1)
- **Hetzner Server ID**: 50546164

## Coolify

[Coolify](https://coolify.io) is installed on hthosting-alpha as the self-hosted PaaS for deploying services.

- **Dashboard**: `http://5.161.45.94:8000`
- **SSH Key**: The `Hetzner` SSH key (ed25519) is configured for root access.

### First-time setup

1. Visit `http://5.161.45.94:8000` and create your admin account.
2. The localhost server is automatically added as a deployment target.
3. Connect your GitHub repository to deploy the babytalk apps.

### Deploying babytalk

Coolify can pull Docker images from GHCR or build from source. The recommended approach:

1. Add a new **Resource** in Coolify.
2. Choose **Docker Compose** or **Dockerfile** and point to the repo.
3. Configure environment variables (see each app's `.env.example`).
4. Coolify handles SSL, reverse proxy (Traefik), and container management.

### Environment variables

Required for the API:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for signing JWTs
- `SMTP_HOST`, `SMTP_PORT` — email delivery

Required for the web app:

- `NEXT_PUBLIC_API_URL` — URL of the GraphQL API

## Hetzner API

The `HETZNER_API_KEY` environment variable is used for Hetzner Cloud API access.
Do not commit this key — it should be stored in your secrets manager or CI/CD variables.
