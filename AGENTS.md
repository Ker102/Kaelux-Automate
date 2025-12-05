# Repository Guidelines

## Project Structure & Module Organization
Kaelux Automate pairs a Next.js control plane with the upstream n8n monorepo. Application routes live in `src/app` (handlers, server actions, React Server Components), shared UI in `src/components`, and helpers in `src/lib`. Database schema and migrations sit in `prisma/`, static assets land in `public/`, and workflow samples in `data/`. The `n8n/` directory is an embedded pnpm workspace that builds the canvas image consumed by Docker Compose. Docs and workflow automation manifests live under `docs/` and `workflows/`.

## Current Development State

### Completed Features
- AI Builder panel with Perplexity-style layout and three model modes (Fast/Thinking/Thinking-Pro)
- Gemini integration with LangChain for model switching
- Kaelux theme framework scoped to `[data-theme="kaelux"]`
- Custom styling for Logs/AI Panel (dark backgrounds, styled tab bar)
- Resource-safe dev scripts (`dev:be:safe`, `dev:safe`)

### Known Issues
1. **Native Dependency Conflicts**: Platform-specific binaries (rollup, rolldown) conflict between host (glibc) and Docker (musl). Workaround: `.npmrc` configured with multi-platform support.
2. **High Resource Usage**: Full `pnpm dev` crashes host system. Solution: Use hybrid mode (Backend in Docker, Frontend on Host).
3. **Verification Pending**: AI Builder model switching not yet manually tested.

### Recommended Development Workflow
```bash
# Terminal 1: Docker containers
cd n8n && docker compose -f .devcontainer/docker-compose.yml up -d

# Terminal 2: Backend in Docker
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm dev:be:safe

# Terminal 3: Frontend on host
pnpm dev:fe
```

## Build, Test, and Development Commands
Use Node 22.x with pnpm 9+. At the repo root, `pnpm dev` launches Next.js, `pnpm build` compiles for production, and `pnpm lint` enforces `eslint-config-next` with the Core Web Vitals ruleset. Seed the vector index via `pnpm seed:qdrant`. Build the customized n8n image with `pnpm --dir n8n build:docker`, then start services using `COMPOSE_CONVERT_WINDOWS_PATHS=0 docker compose -f docker-compose.dev.yml up -d postgres qdrant app n8n`. Run Prisma utilities inside the app container, e.g., `docker compose ... exec app npx prisma migrate deploy`.

## Coding Style & Naming Conventions
TypeScript is the default, and files should follow Next.js app-router conventions (`page.tsx`, `layout.tsx`, `route.ts`). Use two-space indentation, single quotes in JSX, and explicit return types on exported helpers. Components stay in PascalCase (`SignInForm`), hooks/utilities in camelCase (`useWorkflowSchema`). Keep helper logic in `src/lib`, API glue in `src/app/api/**`, and Prisma access isolated in `src/lib/prisma.ts`. ESLint plus Tailwind's PostCSS plugin enforce formatting—run `pnpm lint` before submitting.

## Testing Guidelines
Browser-facing work should add tests alongside the feature (e.g., `src/components/__tests__/workflow-card.test.tsx`). n8n packages rely on Vitest/Jest pipelines configured in `n8n/vitest.workspace.ts`; run them with `pnpm --dir n8n test:ci:backend` or `pnpm --dir n8n test:ci:frontend`. Prioritize coverage around workflow generation logic and ensure new Prisma queries include regression tests or seed adjustments.

## Key Files Modified in Kaelux Fork
- `n8n/packages/frontend/editor-ui/src/features/execution/logs/components/AiWorkflowPanel.vue` - AI Builder UI
- `n8n/packages/@n8n/ai-workflow-builder.ee/src/ai-workflow-builder-agent.service.ts` - Model switching
- `n8n/packages/@n8n/api-types/src/dto/ai/ai-build-request.dto.ts` - DTO with modelMode
- `n8n/.npmrc` - Multi-platform native binding support

## Commit & Pull Request Guidelines
Write imperative commits scoped to one concern (`Add Gemini fallback toggle`) and reference issues when applicable (`Fix #123`). Pull requests must describe behaviour changes, list local verification (`pnpm lint`, `pnpm --dir n8n test:ci:backend`), and include screenshots or cURL traces for API/UI tweaks. Update README, docs, or workflow samples whenever the UX or schema shifts.

## Security & Configuration Tips
Secrets belong in `.env` (containers) and `.env.local` (Next.js). Keep `GEMINI_*`, `N8N_AI_GEMINI_KEY`, `DATABASE_URL`, and `QDRANT_*` values out of commits. When touching authentication or workflow import code, review `SECURITY.md` and add brief threat-model notes to the PR. Dockerized services store persistent data under `.data/`; wipe cautiously.

## Related Documentation
- [CLAUDE.md](./CLAUDE.md) - Detailed project context for AI assistants
- [n8n/CLAUDE.md](./n8n/CLAUDE.md) - n8n-specific development guidelines
- [Gemini.md](./Gemini.md) - Project context (alternative format)
