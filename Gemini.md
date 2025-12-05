# Kaelux Automate - Project Context for Gemini

## Overview
Kaelux Automate is an enterprise-grade automation builder that integrates a Next.js control plane with an embedded n8n instance and a vector-powered retrieval layer. It uses AI to synthesize workflow modifications (add/update/remove/reconnect) rather than replacing entire canvases, ensuring safe iteration on complex workflows.

## Architecture
The project is composed of four main services orchestrated via Docker Compose:

1. **Next.js App (`app` service)**:
   - Located in `src/` and root configuration files.
   - Handles API requests, Prisma/Postgres interactions, and AI orchestration (`/api/ai/workflow`, `/api/ai/prompts`).
   - Manages the "control plane" logic.

2. **n8n (`n8n` service)**:
   - Located in the `n8n/` directory.
   - This is a modified/embedded version of the n8n workflow automation tool.
   - Provides the visual workflow canvas and execution engine.
   - Extended with an AI Builder panel supporting three model modes.

3. **Postgres (`postgres` service)**:
   - Primary relational database.
   - Managed via Prisma ORM (schema in `prisma/`).

4. **Qdrant (`qdrant` service)**:
   - Vector database for storing and retrieving workflow exemplars.
   - Used by the AI to find relevant examples for user queries.

## Directory Structure
- **`src/`**: Source code for the Next.js application.
- **`n8n/`**: Source code for the embedded n8n instance (monorepo).
- **`prisma/`**: Database schema and migrations.
- **`docker/`**: Docker configuration files.
- **`scripts/`**: Utility scripts (e.g., seeding Qdrant).
- **`data/`**: Local data storage for persistent state (gitignored).

## Current Development State

### Completed Features
- AI Builder panel with Perplexity-style centered layout
- Three model modes: Fast (Gemini 2.0 Flash), Thinking (Gemini 2.5 Pro), Thinking-Pro (Gemini 3 Pro)
- Backend model switching logic with LangChain integration
- Kaelux theme framework scoped to `[data-theme="kaelux"]`
- Resource-safe dev scripts to prevent system crashes

### Known Issues
1. **Native Dependency Conflicts**: Platform-specific binaries conflict between host (glibc) and Docker (musl). Fixed via `.npmrc` with `supported-architectures` setting.
2. **High Resource Usage**: Full `pnpm dev` crashes system. Use hybrid development mode instead.
3. **Verification Pending**: Model switching not yet manually tested in running application.

### Key Modified Files
- `n8n/packages/frontend/editor-ui/src/features/execution/logs/components/AiWorkflowPanel.vue`
- `n8n/packages/@n8n/ai-workflow-builder.ee/src/ai-workflow-builder-agent.service.ts`
- `n8n/packages/@n8n/api-types/src/dto/ai/ai-build-request.dto.ts`
- `n8n/.npmrc` (multi-platform support)
- `n8n/package.json` (safe dev scripts)

## Key Workflows

### AI Workflow Generation
The Next.js app receives user prompts, queries Qdrant for examples, and uses an LLM to generate structured actions (diffs) which are sent to the n8n frontend to update the canvas.

### Development (Recommended: Hybrid Mode)
```bash
# Terminal 1: Start Docker containers
cd n8n && docker compose -f .devcontainer/docker-compose.yml up -d

# Terminal 2: Backend in Docker
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm dev:be:safe

# Terminal 3: Frontend on host
pnpm dev:fe
```

Access points:
- Frontend: http://localhost:8080
- Backend API: http://localhost:5678

### Production Stack
```bash
docker compose -f docker-compose.dev.yml up -d
```
- Next.js: http://localhost:3000
- n8n: http://localhost:5678

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `N8N_AI_GEMINI_KEY` | Gemini API key for AI Builder |
| `GEMINI_API_KEY` | Fallback for Gemini API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `QDRANT_URL` | Vector database URL |
| `QDRANT_COLLECTION` | Vector collection name |

## Important Notes for AI Assistant
- When modifying the Next.js app, focus on `src/` and `app/` directories.
- When modifying the workflow engine or canvas UI, focus on the `n8n/` directory.
- Changes to `n8n/` require rebuilding the Docker image and restarting services.
- The project uses `pnpm` exclusively for package management.
- Always redirect build output to files: `pnpm build > build.log 2>&1`
- Check `.npmrc` if encountering native binding errors.

## Related Documentation
- [CLAUDE.md](./CLAUDE.md) - Detailed AI assistant context
- [n8n/CLAUDE.md](./n8n/CLAUDE.md) - n8n-specific guidelines
- [AGENTS.md](./AGENTS.md) - Repository guidelines
