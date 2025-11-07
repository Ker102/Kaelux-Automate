# Vector Store Setup (Qdrant)

To support similarity search for workflows we run Qdrant locally via Docker. This keeps the stack self‑contained during development while giving us room to move to Qdrant Cloud later.

## Run Qdrant

```bash
docker compose -f docker-compose.dev.yml up qdrant
```

* REST API: `http://localhost:6333`
* gRPC API: `http://localhost:6334`
* Persistent data lives in `./.data/qdrant` (gitignored).

Stop with `Ctrl+C` or `docker compose -f docker-compose.dev.yml stop qdrant`.

## Seed Example Workflows

Once Qdrant is running and `GEMINI_API_KEY` is set, seed the sample collection:

```bash
npx tsx scripts/update-sample-workflows.ts   # rebuild curated dataset (optional)
npm run seed:qdrant
```

This loads `data/workflows/sample-workflows.json`, embeds each example with Gemini (`text-embedding-004` by default), and writes them into the `ai_workflow_examples` collection. Edit the JSON file or point the script at your own dataset to customize.

## Environment Variables

| Env Variable      | Description                                     |
|-------------------|-------------------------------------------------|
| `QDRANT_URL`      | Base URL for REST calls (defaults to localhost) |
| `QDRANT_API_KEY`  | Optional key if you enable auth later           |

Add these to `.env.local` (Next.js) or `.env` for scripts when we start ingesting data.

## Next Steps

1. Seed Qdrant with embeddings (LangChain + Gemini embed API or another model).
2. Query Qdrant inside `generateWorkflowSuggestion()` to fetch top-k workflow examples.
3. Optionally expose an admin script to wipe/seed collections.
