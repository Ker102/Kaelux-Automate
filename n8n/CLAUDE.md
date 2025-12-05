# CLAUDE.md - n8n Embedded Instance (Kaelux Fork)

This file provides guidance to AI assistants when working with the embedded n8n instance in the Kaelux Automate project.

## Overview

This is a **modified fork** of the n8n workflow automation platform, embedded within Kaelux Automate. Key customizations include:
- AI Builder panel with multi-model support (Gemini integration)
- Kaelux theme framework
- Custom dev scripts for resource-constrained environments

## Monorepo Structure

n8n uses pnpm workspaces with Turbo build orchestration.

### Key Packages

| Package | Purpose |
|---------|---------|
| `packages/cli` | Express server, REST API, CLI commands |
| `packages/frontend/editor-ui` | Vue 3 frontend application |
| `packages/@n8n/ai-workflow-builder.ee` | AI Builder backend service |
| `packages/@n8n/api-types` | Shared TypeScript interfaces (FE/BE) |
| `packages/@n8n/design-system` | Vue component library |
| `packages/workflow` | Core workflow interfaces |
| `packages/core` | Workflow execution engine |
| `packages/nodes-base` | Built-in integrations |

## Kaelux-Specific Modifications

### AI Builder (Model Switching)
- **Frontend**: `packages/frontend/editor-ui/src/features/execution/logs/components/AiWorkflowPanel.vue`
  - Three model modes: Fast, Thinking, Thinking-Pro
  - Perplexity-style centered layout
  - Custom empty state with "Kaelux-Agent" branding

- **Backend**: `packages/@n8n/ai-workflow-builder.ee/`
  - `ai-workflow-builder-agent.service.ts` - Model switching based on `modelMode`
  - `llm-config.ts` - Gemini model configurations
  - Uses `N8N_AI_GEMINI_KEY` environment variable

- **API Types**: `packages/@n8n/api-types/src/dto/ai/ai-build-request.dto.ts`
  - `modelMode` field: `'fast' | 'thinking' | 'thinking-pro'`

### Theme Framework
- `packages/frontend/@n8n/design-system/src/css/_tokens.dark.scss` - Kaelux theme tokens
- Styles scoped to `[data-theme="kaelux"]` selector

### Dev Scripts (Resource-Safe)
Added to root `package.json`:
- `dev:be:safe` - Backend with concurrency=10 (prevents system crashes)
- `dev:safe` - Full stack with concurrency=10
- `dev:be:quiet` / `dev:quiet` - Redirects logs to files

## Current Issues

### 1. Native Binding Conflicts
The project uses platform-specific binaries (rollup, rolldown) that differ between:
- **Host (glibc)**: `@rollup/rollup-linux-x64-gnu`
- **Docker (musl)**: `@rolldown/binding-linux-x64-musl`

**Fix applied**: `.npmrc` includes:
```ini
supported-architectures=os=linux;cpu=x64;libc=glibc,musl
```

**If errors persist**: Run fresh `pnpm install` after switching environments.

### 2. Docker Dev Container Setup
The `.devcontainer/` configuration is functional but requires:
```bash
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm install --ignore-scripts
```
Note: `--ignore-scripts` is needed because the `prepare` script (lefthook) fails in container context.

### 3. Verification Pending
Model switching logic compiled but has not been manually tested in a running application.

## Development Commands

### Building
```bash
pnpm build > build.log 2>&1  # ALWAYS redirect output
tail -n 20 build.log         # Check for errors
```

### Testing
```bash
pnpm test              # All tests
pnpm test:affected     # Tests for changed files
```

### Code Quality
```bash
pnpm lint              # ESLint
pnpm typecheck         # TypeScript checks
```

### Development (Recommended: Hybrid Mode)
```bash
# Terminal 1: Docker containers
docker compose -f .devcontainer/docker-compose.yml up -d

# Terminal 2: Backend in Docker
docker compose -f .devcontainer/docker-compose.yml exec -w /workspaces n8n pnpm dev:be:safe

# Terminal 3: Frontend on host (from n8n/ directory)
pnpm dev:fe
```

### Docker Image Build
```bash
pnpm build:docker > docker.log 2>&1
```

## Technology Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia
- **Backend**: Node.js + TypeScript + Express + TypeORM
- **Testing**: Jest (unit) + Playwright (E2E)
- **Code Quality**: Biome (formatting) + ESLint + lefthook

## Best Practices

### TypeScript
- **NEVER use `any`** - use proper types or `unknown`
- **Avoid `as` casting** - use type guards instead
- **Shared interfaces** go in `@n8n/api-types`

### Frontend
- **All UI text must use i18n** - add translations to `@n8n/i18n`
- **Use CSS variables** - never hardcode px values
- **data-test-id** must be single value (no spaces)

### Error Handling
- Don't use `ApplicationError` (deprecated)
- Use `UnexpectedError`, `OperationalError`, or `UserError`

### Testing
- Work from within package directory
- Mock all external dependencies
- Run `pnpm typecheck` before committing

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `N8N_AI_GEMINI_KEY` | Gemini API key for AI Builder |
| `GEMINI_API_KEY` | Fallback for Gemini API key |
| `N8N_PORT` | Port for n8n server (default: 5678) |

## Key File Locations

For AI Builder modifications:
1. **API DTO**: `packages/@n8n/api-types/src/dto/ai/ai-build-request.dto.ts`
2. **Controller**: `packages/cli/src/controllers/ai.controller.ts`
3. **Service**: `packages/@n8n/ai-workflow-builder.ee/src/ai-workflow-builder-agent.service.ts`
4. **Frontend Panel**: `packages/frontend/editor-ui/src/features/execution/logs/components/AiWorkflowPanel.vue`

For Theme modifications:
1. **Theme Tokens**: `packages/frontend/@n8n/design-system/src/css/_tokens.dark.scss`
2. **Global Styles**: `packages/frontend/@n8n/design-system/src/css/n8n-theme.scss`

## Related Documentation

- [Parent CLAUDE.md](../CLAUDE.md) - Project-wide context
- [packages/frontend/CLAUDE.md](./packages/frontend/CLAUDE.md) - Frontend-specific guidelines (if exists)
- `.github/pull_request_template.md` - PR conventions
