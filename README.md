# Kaelux Automate

[![Compose](https://img.shields.io/badge/stack-docker--compose-0db7ed?logo=docker&logoColor=white)](#architecture)
[![Node](https://img.shields.io/badge/node-22.x-43853d?logo=node.js&logoColor=white)](#requirements)
[![CodeQL](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml)

![Custom Model](https://img.shields.io/badge/Custom%20Model-Training%20In%20Progress-orange?style=for-the-badge)
![RAG](https://img.shields.io/badge/RAG%20Vectors-36,166-FF4F64?style=for-the-badge)

### 🔧 Core Tech Stack
![Next.js](https://img.shields.io/badge/Next.js%2015-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript%205.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![n8n](https://img.shields.io/badge/n8n%201.x-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2022-339933?style=flat-square&logo=nodedotjs&logoColor=white)

### 🗄️ Database & Storage  
![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma%205-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant%20Cloud-FF4F64?style=flat-square&logo=qdrant&logoColor=white)

### 🧠 AI & LLM
![Gemini](https://img.shields.io/badge/Gemini%203-Pro%20Preview-4285F4?style=flat-square&logo=google&logoColor=white)
![Qwen](https://img.shields.io/badge/Qwen%203-Coder%2014B-7C3AED?style=flat-square)
![Unsloth](https://img.shields.io/badge/Unsloth-Fine--Tuning-orange?style=flat-square)

> 🚀 **Enterprise AI-powered n8n workflow builder** with RAG-enhanced generation.  
> 🔥 **Custom Qwen 3 Coder 14B** model training in progress for specialized workflow generation.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🧠 **AI Workflow Builder** | Generate n8n workflows from natural language (Gemini 3 Pro Preview) |
| 🔍 **RAG-Powered** | 36,166 workflow vectors for semantic retrieval |
| ⚡ **Diff-Based Updates** | Safe add/update/remove/reconnect actions (no canvas overwrites) |
| 🎨 **Embedded n8n** | Full n8n canvas with custom AI Builder panel |
| 🤖 **Custom Model** | Qwen 3 Coder 14B fine-tuned on 21,925 n8n workflow examples |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kaelux Automate                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Next.js 15    │   n8n Canvas    │      AI Pipeline            │
│   (Port 3000)   │   (Port 5678)   │                             │
├─────────────────┴─────────────────┤                             │
│                                   │  ┌───────────────────────┐  │
│   ┌─────────────────────────┐     │  │  Gemini 3 Pro Preview │  │
│   │    PostgreSQL 16        │     │  │  (Primary LLM)        │  │
│   │      (Port 5433)        │     │  └───────────┬───────────┘  │
│   └─────────────────────────┘     │              │              │
│                                   │  ┌───────────▼───────────┐  │
│   ┌─────────────────────────┐     │  │   Qwen 3 Coder 14B    │  │
│   │  Qdrant Cloud (36k RAG) │     │  │   (Custom Fine-Tuned) │  │
│   └─────────────────────────┘     │  └───────────────────────┘  │
└───────────────────────────────────┴─────────────────────────────┘
```

| Component | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 15.x | API routes, Prisma/Postgres, AI orchestration |
| **React** | 19.x | Frontend framework |
| **n8n** | 1.x (forked) | Vue-based workflow canvas with AI Builder panel |
| **PostgreSQL** | 16.x | Primary data store |
| **Prisma** | 5.x | Database ORM |
| **Qdrant** | Cloud | Vector index for 36,166 workflow exemplars |
| **Gemini** | 3 Pro Preview | Primary LLM for workflow generation |
| **Qwen 3 Coder** | 14B (training) | Custom fine-tuned model for n8n workflows |

---

## 🚀 Quick Start

### Requirements
- Docker + Docker Compose v2
- Node.js 22.x / pnpm 9.x  
- Gemini API key (3 Pro Preview)

### Setup

```bash
# 1. Clone and configure
git clone https://github.com/Ker102/Kaelux-Automate.git
cd Kaelux-Automate
cp .env.example .env
cp .env.local.example .env.local

# 2. Add your API keys to .env.local
# GEMINI_API_KEY=your-key-here

# 3. Build n8n with AI Builder
cd n8n
pnpm install
pnpm build:n8n && pnpm build:docker
cd ..

# 4. Start services
docker compose -f docker-compose.dev.yml up -d

# 5. (Optional) Seed RAG database
docker compose exec app npm run seed:qdrant
```

### Access Points

| Service | URL |
|---------|-----|
| Next.js App | http://localhost:3000 |
| n8n Canvas | http://localhost:5678 |
| Qdrant REST | http://localhost:6333 |
| PostgreSQL | localhost:5433 |

---

## 🧠 AI Workflow Builder

The AI builder uses **Gemini 3 Pro Preview** for generation and structured diff actions:

```typescript
// Example API response
{
  "workflow": { /* n8n workflow JSON */ },
  "actions": [
    { "type": "add", "node": {...} },
    { "type": "update", "nodeId": "123", "changes": {...} },
    { "type": "connect", "from": "A", "to": "B" }
  ]
}
```

**Endpoints:**
- `POST /api/ai/workflow` - Generate workflow from prompt
- `GET /api/ai/prompts` - List prompt templates

---

## 🤖 Custom Model (In Progress)

We're fine-tuning **Qwen 3 Coder 14B** specifically for n8n workflow generation:

| Metric | Value |
|--------|-------|
| Base Model | Qwen 3 Coder 14B |
| Training Framework | Unsloth (QLoRA) |
| Training Examples | 21,925 (cleaned) |
| Vector Dimensions | 768 (M2-BERT) |
| Training Platform | GCP / Colab |

---

## 🔧 Development

### Rebuild n8n UI
```bash
cd n8n && pnpm build:n8n && pnpm build:docker && cd ..
docker compose -f docker-compose.dev.yml up -d n8n
```

### Database Migrations
```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
```

---

## 🔐 Security

- [Dependabot](.github/dependabot.yml) monitors npm and GitHub Actions
- [CodeQL](.github/workflows/codeql.yml) scans on pushes and PRs
- [SECURITY.md](./SECURITY.md) documents disclosure process

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines. All changes require PRs with tests/docs.

---

## 📄 License

Copyright © Kaelux. See repository license for details.

---

## 🔗 Related

- **[n8n Automation Atlas](https://github.com/Ker102/n8n-workflows-36k)** - Source of 131k+ workflows powering the RAG
- **[HuggingFace Dataset](https://huggingface.co/datasets/Ker102/n8n-mega-workflows)** - Training data for fine-tuning
