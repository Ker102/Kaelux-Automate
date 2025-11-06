# n8n Integration Strategy (Local Showcase Only)

This document captures how we are embedding the upstream n8n OSS codebase in our project so we can customize the server/UI and layer on the AI workflow builder. Because the n8n Sustainable Use License forbids redistribution/hosting without a commercial license, everything described here is for **local demos and personal learning only**.

## Repository Layout

- `./n8n`: Entire upstream repo (cloned at commit referenced by `n8n/package.json`). `.git` was removed so it is tracked inside this mono-repo.
- `./src`: Existing Next.js 16 app that will provide marketing pages, auth, and AI prompt surfaces. Initially it can talk to n8n over REST/webhooks.
- `./docs`: Design notes such as this strategy document.

## Build Tooling

n8n uses pnpm + turborepo. We will install pnpm locally and run:

```bash
cd n8n
pnpm install
pnpm build
pnpm dev        # launches editor + backend (see upstream docs for env flags)
```

For isolation, the Next.js app keeps using npm. Later we can add a root `package.json` + turbo config if we want unified scripts, but for now the two stacks build independently.

## Customization Plan

1. **LLM Service (Next.js)**  
   Keep iterating inside `src/` to expose an authenticated AI endpoint that turns natural language into n8n workflow JSON. Persist generated workflows + embeddings on our side.

2. **n8n UI Hooks**  
   - Target the editor UI inside `n8n/packages/editor-ui`.  
   - Add a new sidebar/panel (“AI Builder”) that calls our Next.js endpoint, displays suggestions, and lets the user insert the generated workflow into the current canvas.  
   - Ensure we keep n8n attribution, since this remains a local-only showcase.

3. **Server Extension**  
   - Extend `n8n/packages/cli/src` with a lightweight API route (or use existing workflow endpoints) that accepts AI-built workflows from the UI and saves them.  
   - Optionally register custom nodes that represent AI-generated steps or template references.

4. **Dev Orchestration**  
   - Introduce a `docker-compose.dev.yml` that runs: PostgreSQL, our Next.js app, and the customized n8n server.  
   - Share environment variables via `.env.local`/`.env.n8n` to keep secrets separate.

## Immediate Next Steps

1. Install pnpm locally and verify `n8n` builds/runs.  
2. Document baseline dev commands (start editor, run CLI).  
3. Plan the React component changes for the AI panel inside `packages/editor-ui`.  
4. Expose an internal REST endpoint in Next.js that the n8n UI can call (likely via cookie-authenticated fetch).  
5. Sync database models between Prisma (Next.js) and n8n where needed, or keep them isolated with eventual token-based bridging.
