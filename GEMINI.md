# GEMINI.md - AI Assistant Context

## 🎯 Project Overview

**Name:** Kaelux Automate  
**Purpose:** Enterprise AI-powered n8n workflow builder with RAG-enhanced generation.

---

## 🚀 Current Status

### ✅ Completed

| Feature | Status | Details |
|---------|--------|---------|
| **Lightweight Workflow Generator** | ✅ Working | Vue 3 + Vite + Express standalone app |
| **CRAG Pipeline** | ✅ Implemented | Jina Reranker + Mistral-Nemo Judge |
| **Qdrant Integration** | ✅ Connected | RAG with 36,166 workflow + 296 node vectors |
| **n8n-Style Canvas** | ✅ Complete | Vue Flow with real n8n icons, node editing |
| **Multi-Model Support** | ✅ Working | Gemini (generation) + Together (judge) + Jina (rerank) |

### 🔄 In Progress

| Feature | Status | Details |
|---------|--------|---------|
| **Custom Fine-Tuned Model** | ⏳ Pending GPU quota | Qwen2.5-Coder for workflow generation |

---

## 🏗️ Architecture

### CRAG Pipeline (Corrective RAG)

```
User Query
    ↓
┌─────────────────┐
│  Qdrant Cloud   │  ← Retrieve 30+ candidates
│  (36k workflows)│
└────────┬────────┘
         ↓
┌─────────────────┐
│  Jina Reranker  │  ← Rerank by semantic relevance
│  (top 10)       │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Mistral-Nemo   │  ← Judge relevance, rewrite query if needed
│  (Together AI)  │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Gemini Pro     │  ← Generate workflow JSON
│  (Main LLM)     │
└─────────────────┘
```

---

## 📁 Directory Structure

```
Project05/
├── workflow-generator/        # Lightweight standalone app
│   ├── src/client/           # Vue 3 + Vue Flow canvas
│   │   ├── components/       # WorkflowNode, NodeEditor, etc.
│   │   └── styles/           # n8n-like dark theme
│   ├── src/server/           # Express API
│   │   ├── services/         # RAG, CRAG, ReAct agent
│   │   └── routes/           # /api/generate endpoint
│   ├── public/icons/         # 254 n8n SVG icons
│   └── scripts/              # Node extraction, Qdrant ingestion
├── n8n/                      # Forked n8n (optional)
└── data/workflows/           # 33 curated high-quality workflows
```

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Vue 3, Vue Flow, Vite, TypeScript |
| **Backend** | Express.js, Node.js |
| **Vector Store** | Qdrant Cloud |
| **Embeddings** | Gemini text-embedding-004 (768-dim) |
| **Reranker** | Jina AI (jina-reranker-v2-base-multilingual) |
| **Judge LLM** | Mistral-Nemo-12B via Together AI |
| **Generator LLM** | Gemini (gemini-3-flash-preview / gemini-2.5-pro) |

---

## 🔑 Environment Variables

```bash
# workflow-generator/.env
GEMINI_API_KEY=<your-key>
QDRANT_URL=https://04c89d54-...cloud.qdrant.io
QDRANT_API_KEY=<your-key>
QDRANT_COLLECTION=n8n_workflows

# CRAG Pipeline
JINA_API_KEY=<your-key>           # Reranker
TOGETHER_API_KEY=<your-key>       # Mistral-Nemo judge
```

---

## 🚀 Quick Start (Workflow Generator)

```bash
cd workflow-generator
pnpm install
pnpm dev
```

**Access:** http://localhost:5173

---

## 🎓 AI Assistant Guidelines

1. **CRAG Pipeline**: All RAG queries go through Jina reranker + Mistral-Nemo judge
2. **Canvas State**: User edits on canvas are synced and sent to model on next generate
3. **Workflow Format**: Generated as n8n JSON with nodes + connections
4. **Expressions**: Use `={{$json.field}}` syntax for data references
5. **Document Progress**: Update GEMINI.md before each commit

---

## 📊 Progress Log

| Date | Update |
|------|--------|
| 2026-01-16 | ✅ CRAG pipeline complete (Jina + Mistral-Nemo) |
| 2026-01-15 | ✅ UI improvements: node editing, manual connecting, canvas sync |
| 2026-01-15 | ✅ Added 254 n8n SVG icons, improved system prompt for skeleton workflows |
| 2026-01-14 | ✅ Fixed connections bug, added detailed terminal logging |
| 2026-01-13 | ✅ RAG integration with Qdrant (workflows + nodes), ReAct agent |

---

## 🔗 Related Projects

- **n8n Automation Atlas (Project06)**: Source of 36k+ workflows and training data
- **Qdrant Cloud**: Shared vector database for RAG
