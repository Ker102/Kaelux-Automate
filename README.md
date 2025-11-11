# Kaelux Automate

[![Compose](https://img.shields.io/badge/stack-docker--compose-0db7ed?logo=docker&logoColor=white)](#architecture)
[![Node](https://img.shields.io/badge/node-22.x-43853d?logo=node.js&logoColor=white)](#requirements)
[![CodeQL](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml)
[![Release Drafter](https://github.com/Ker102/Kaelux-Automate/actions/workflows/release-drafter.yml/badge.svg)](https://github.com/Ker102/Kaelux-Automate/actions/workflows/release-drafter.yml)

Enterprise-grade automation builder that blends a Next.js control plane, an embedded n8n instance, and a vector-powered retrieval layer for curated workflow examples. The AI assistant synthesizes diffs (add/update/remove/reconnect) instead of blindly replacing canvases, making it safe to iterate on complex workflows.

## Architecture

| Component | Purpose |
| --------- | ------- |
| Next.js app (`app` service) | API, Prisma/Postgres access, AI orchestration endpoints (`/api/ai/workflow`, `/api/ai/prompts`). |
| Postgres (`postgres` service) | Primary relational data store (`DATABASE_URL`). |
| Qdrant (`qdrant` service) | Vector index for workflow exemplars (`QDRANT_URL`, `QDRANT_COLLECTION`). |
| n8n (`n8n` service) | Vue-based workflow canvas extended with the AI Builder panel. |

All services are orchestrated via Docker Compose (`docker-compose.dev.yml`). Persistent state lives in `./.data/**`.

## Requirements

- Docker + Docker Compose v2
- Node.js 22.x / pnpm 9.x for local builds
- A compatible LLM API key (configured via `GEMINI_*` environment variables). The README intentionally references a “configurable LLM provider” only; swap providers as needed.

## Getting started

1. Copy env templates and add secrets:
   ```bash
   cp .env.local.example .env.local   # create this file if it doesn't exist
   cp .env.example .env
   ```
2. Build the editor + image:
   ```bash
   cd n8n
   pnpm build:n8n > /tmp/n8n-build.log 2>&1 && pnpm build:docker > /tmp/n8n-dockerize.log 2>&1
   cd ..
   ```
3. Start the stack:
   ```bash
   COMPOSE_CONVERT_WINDOWS_PATHS=0 docker compose -f docker-compose.dev.yml up -d postgres qdrant app n8n
   ```
4. Seed Qdrant (optional but recommended):
   ```bash
   docker compose -f docker-compose.dev.yml exec app npm run seed:qdrant
   ```

Access points:

- Next.js dev server: http://localhost:3000
- n8n canvas: http://localhost:5678
- Qdrant REST: http://localhost:6333
- Postgres: localhost:5433 (`postgres/postgres`)

## Iterating on the n8n UI

Whenever `packages/frontend` files change:

```bash
cd n8n
pnpm build:n8n && pnpm build:docker
cd ..
COMPOSE_CONVERT_WINDOWS_PATHS=0 docker compose -f docker-compose.dev.yml up -d n8n
```

This produces the `n8nio/n8n:local` image consumed by the compose stack.

## Database and Prisma

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec app npx prisma generate
```

## AI workflow builder

- `/api/ai/workflow` produces workflow JSON **plus structured actions** (add/update/remove/reconnect).
- The n8n panel validates the payload and only imports diffable actions when safe. Empty or invalid responses are rejected before touching the canvas.
- Model settings are controlled exclusively through environment variables (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, etc.) so you can swap providers without code changes.

## Automation & security

- [Dependabot](.github/dependabot.yml) monitors npm workspaces and GitHub Actions.
- [CodeQL](.github/workflows/codeql.yml) scans JS/TS on pushes and PRs.
- [Release Drafter](.github/release-drafter.yml) aggregates release notes.
- [SECURITY.md](./SECURITY.md) documents the responsible disclosure process.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branching strategy, local build steps, and testing expectations. All changes must go through pull requests and include relevant documentation or tests. CODEOWNERS routes reviews to @Ker102.

## License & credits

Copyright © Kaelux. See the repository license for full details.
