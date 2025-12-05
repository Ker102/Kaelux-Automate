# CLAUDE.md - Kaelux Automate Project Context

This file provides guidance to AI assistants (Claude, Gemini, etc.) when working with the Kaelux Automate codebase.

## Project Overview

Kaelux Automate is an enterprise-grade automation builder that integrates:
- **Next.js control plane** (`src/`) - API, Prisma/Postgres access, AI orchestration
- **Embedded n8n instance** (`n8n/`) - Modified workflow automation platform with AI Builder panel
- **Qdrant vector database** - For workflow exemplar retrieval
- **PostgreSQL** - Primary relational data store

The AI assistant synthesizes workflow diffs (add/update/remove/reconnect) instead of replacing entire canvases, enabling safe iteration on complex workflows.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Next.js application code (API routes, components, lib) |
| `n8n/` | Embedded n8n monorepo (heavily customized) |
| `prisma/` | Database schema and migrations |
| `docker/` | Docker configuration files |
| `scripts/` | Utility scripts (e.g., seeding Qdrant) |
| `data/` | Local workflow samples and seed data |
| `.data/` | Persistent container state (gitignored) |

## Current Development State

### ✅ Completed Features
- AI Builder panel with Perplexity-style layout
- Three model modes: Fast (Gemini 2.0 Flash), Thinking (Gemini 2.5 Pro), Thinking-Pro (Gemini 3 Pro)
- Kaelux theme framework (scoped to `[data-theme="kaelux"]`)
- Custom styling for Logs/AI Panel (dark backgrounds, styled tab bar)
- Backend model switching logic with LangChain integration

### 🔧 Current Issues / Blockers

1. **Native Dependency Conflicts**: The n8n monorepo uses platform-specific binaries (rollup, rolldown) that conflict between:
   - Host machine (glibc/gnu bindings)
   - Docker container (musl bindings)
   
   **Workaround**: `.npmrc` configured with `supported-architectures=os=linux;cpu=x64;libc=glibc,musl` but may need fresh `pnpm install` after switching environments.

2. **High Resource Usage**: Running `pnpm dev` crashes the host system due to high concurrency.
   
   **Solution**: Use hybrid development mode (Backend in Docker, Frontend on Host).

3. **Verification Pending**: AI Builder model switching has not been manually verified in a running application.

### Recommended Development Workflow

For stable local development, use **Hybrid Mode**:

```bash
# Terminal 1: Start Docker containers
cd n8n
docker compose -f .devcontainer/docker-compose.yml up -d

# Terminal 2: Run backend in Docker
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm install --ignore-scripts
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm dev:be:safe

# Terminal 3: Run frontend on host
pnpm install  # Run if you haven't after container install
pnpm dev:fe
```

Access points:
- Frontend: http://localhost:8080
- Backend API: http://localhost:5678

## Requirements

- **Node.js**: 22.x
- **pnpm**: 9+
- **Docker**: Docker Compose v2
- **Environment Variables**: See `.env.example` and `.env.local.example`

Key env vars:
- `N8N_AI_GEMINI_KEY` or `GEMINI_API_KEY` - Gemini API key for AI Builder
- `DATABASE_URL` - PostgreSQL connection string
- `QDRANT_URL` / `QDRANT_COLLECTION` - Vector database config

## Key Files Modified in Kaelux Fork

### Frontend
- `n8n/packages/frontend/editor-ui/src/features/execution/logs/components/AiWorkflowPanel.vue` - AI Builder UI
- `n8n/packages/frontend/@n8n/design-system/src/css/_tokens.dark.scss` - Kaelux theme tokens

### Backend
- `n8n/packages/@n8n/ai-workflow-builder.ee/src/ai-workflow-builder-agent.service.ts` - Model switching logic
- `n8n/packages/@n8n/ai-workflow-builder.ee/src/llm-config.ts` - Gemini model configs
- `n8n/packages/@n8n/api-types/src/dto/ai/ai-build-request.dto.ts` - DTO with `modelMode`
- `n8n/packages/cli/src/controllers/ai.controller.ts` - AI endpoint controller

### Configuration
- `n8n/.npmrc` - Multi-platform support for native bindings
- `n8n/package.json` - Safe dev scripts (`dev:be:safe`, `dev:safe`)

## Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start full Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm seed:qdrant` | Seed vector database |
| `pnpm --dir n8n dev:be:safe` | Run n8n backend with reduced concurrency |
| `pnpm --dir n8n dev:fe` | Run n8n frontend watcher |
| `pnpm --dir n8n build:docker` | Build n8n Docker image |

## AI Assistant Guidelines

1. **When modifying Next.js app**: Focus on `src/` directory
2. **When modifying workflow engine/canvas**: Focus on `n8n/` directory (see `n8n/CLAUDE.md`)
3. **After n8n changes**: Rebuild with `pnpm build:docker` and restart services
4. **Always use pnpm** - npm/yarn are not supported
5. **Check `.npmrc`** if encountering native binding errors
6. **Redirect build output** to files to avoid terminal overflow: `pnpm build > build.log 2>&1`

## Related Documentation

- [n8n/CLAUDE.md](./n8n/CLAUDE.md) - n8n-specific development guidelines
- [AGENTS.md](./AGENTS.md) - Repository guidelines
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution workflow
- [SECURITY.md](./SECURITY.md) - Security policies
