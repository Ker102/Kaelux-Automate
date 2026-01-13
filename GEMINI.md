# GEMINI.md - AI Assistant Context

## 🎯 Project Overview

**Name:** Kaelux Automate  
**Purpose:** Enterprise AI-powered n8n workflow builder with RAG-enhanced generation.

---

## 🚀 Current Status

### ✅ Completed

| Feature | Status | Details |
|---------|--------|---------|
| **AI Builder Panel** | ✅ Working | n8n frontend integration |
| **Diff-Based Updates** | ✅ Implemented | Add/update/remove/reconnect actions |
| **Qdrant Integration** | ✅ Connected | RAG with 36,166 workflow vectors |
| **Docker Stack** | ✅ Configured | Next.js + n8n + Postgres + Qdrant |

### 🔄 In Progress

| Feature | Status | Details |
|---------|--------|---------|
| **Custom Fine-Tuned Model** | ⏳ Pending | Qwen2.5-Coder for workflow generation |

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│   Qdrant RAG    │    │  Fine-Tuned LLM │
│   (Port 3000)   │    │ (36,166 vectors)│    │ (Qwen2.5-Coder) │
└────────┬────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│   n8n Canvas    │───▶│   PostgreSQL    │
│   (Port 5678)   │    │   (Port 5433)   │
└─────────────────┘    └─────────────────┘
```

---

## 📁 Directory Structure

```
Project05/
├── app/                    # Next.js app router
│   └── api/ai/            # AI endpoints
│       ├── workflow/      # Workflow generation
│       └── prompts/       # Prompt templates
├── n8n/                   # Forked n8n with AI Builder
│   └── packages/frontend/ # Modified Vue components
├── scripts/
│   └── seed-qdrant.ts    # Qdrant seeding script
├── data/workflows/        # High-quality workflow examples
│   └── episodes/          # 33 curated workflows
├── docker-compose.dev.yml # Development stack
└── prisma/               # Database schema
```

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14, React, TypeScript |
| **n8n Integration** | Forked n8n with custom AI Builder panel |
| **Database** | PostgreSQL + Prisma ORM |
| **Vector Store** | Qdrant Cloud (Gemini embeddings) |
| **LLM** | Gemini 2.0 Flash (configurable) |
| **Embeddings** | Gemini text-embedding-004 (768-dim) |

---

## 🔑 Environment Variables

```bash
# .env.local
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBED_MODEL=text-embedding-004

# Qdrant (uses project06's Qdrant Cloud instance)
QDRANT_URL=https://04c89d54-9692-49b8-8d51-f86645400865.europe-west3-0.gcp.cloud.qdrant.io
QDRANT_API_KEY=<your-key>
QDRANT_COLLECTION=n8n_workflows

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/kaelux
```

---

## 🚀 Quick Start

```bash
# 1. Build n8n with AI Builder
cd n8n && pnpm build:n8n && pnpm build:docker && cd ..

# 2. Start services
docker compose -f docker-compose.dev.yml up -d

# 3. Seed Qdrant (optional - uses shared collection)
docker compose exec app npm run seed:qdrant
```

**Access Points:**
- Next.js: http://localhost:3000
- n8n Canvas: http://localhost:5678
- Qdrant: http://localhost:6333

---

## 🎓 AI Assistant Guidelines

1. **n8n Fork**: This uses a custom n8n fork in `n8n/` directory with AI Builder modifications.
2. **Shared RAG**: Uses the same Qdrant Cloud collection (`n8n_workflows`) as project06.
3. **Embeddings**: Uses Gemini `text-embedding-004` (768-dim, matches project06).
4. **Workflow Format**: AI generates diff actions (add/update/remove), not full replacements.

---

## 🔗 Related Projects

- **n8n Automation Atlas (Project06)**: Source of 36k+ workflows and training data
- **Qdrant Cloud**: Shared vector database for RAG
