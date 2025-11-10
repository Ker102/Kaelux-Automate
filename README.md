## Containerized Dev Stack

The whole platform (Next.js app, Postgres, Qdrant, vanilla n8n) is orchestrated via Docker Compose.

```bash
# first time: create env files (.env + .env.local) with your secrets
docker compose -f docker-compose.dev.yml up -d postgres qdrant n8n app
```

What you get:

- `app`: Next.js dev server on [http://localhost:3000](http://localhost:3000) with hot reload.
- `postgres`: backing database on port `5433`.
- `qdrant`: vector store on port `6333`.
- `n8n`: reference UI on port `5678` (embedded at `/builder`).

### Rebuilding the n8n image (after UI changes)

```bash
cd n8n
VITE_AI_WORKFLOW_ENDPOINT=http://app:3000/api/ai/workflow \
VITE_AI_SAMPLE_PROMPTS_ENDPOINT=http://app:3000/api/ai/prompts \
pnpm build:docker   # produces n8nio/n8n:local
cd ..
docker compose -f docker-compose.dev.yml up -d n8n   # restart service with new image
```

### Database & Seeding

```bash
# run migrations / generate Prisma client inside the app container
docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec app npx prisma generate

# seed Qdrant with the curated workflows (requires qdrant service running)
docker compose -f docker-compose.dev.yml exec app npm run seed:qdrant
```

### Logs & Shutdown

```bash
docker compose -f docker-compose.dev.yml logs -f app
docker compose -f docker-compose.dev.yml down
```

All persistent data lives under `./.data/**` (Postgres, Qdrant, n8n). Remove those folders if you want a clean slate.
