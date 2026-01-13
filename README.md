# Kaelux Automate

[![Compose](https://img.shields.io/badge/stack-docker--compose-0db7ed?logo=docker&logoColor=white)](#architecture)
[![Node](https://img.shields.io/badge/node-22.x-43853d?logo=node.js&logoColor=white)](#requirements)
[![CodeQL](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ker102/Kaelux-Automate/actions/workflows/codeql.yml)
[![Release Drafter](https://github.com/Ker102/Kaelux-Automate/actions/workflows/release-drafter.yml/badge.svg)](https://github.com/Ker102/Kaelux-Automate/actions/workflows/release-drafter.yml)

### Tech Stack
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)

### AI & RAG
![Gemini](https://img.shields.io/badge/Gemini%202.0-Flash-4285F4?style=flat-square&logo=google&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-FF4F64?style=flat-square&logo=qdrant&logoColor=white)
![Vectors](https://img.shields.io/badge/Vectors-36,166-blueviolet?style=flat-square)

> 🚀 **Enterprise AI-powered n8n workflow builder** with RAG-enhanced generation and diff-based canvas updates.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🧠 **AI Workflow Builder** | Generate n8n workflows from natural language prompts |
| 🔍 **RAG-Powered** | 36,166 workflow vectors for semantic retrieval |
| ⚡ **Diff-Based Updates** | Safe add/update/remove/reconnect actions (no canvas overwrites) |
| 🎨 **Embedded n8n** | Full n8n canvas with custom AI Builder panel |
| 🔄 **Live Preview** | Real-time workflow visualization |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kaelux Automate                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Next.js App   │   n8n Canvas    │      AI Pipeline            │
│   (Port 3000)   │   (Port 5678)   │                             │
├─────────────────┴─────────────────┤                             │
│                                   │  ┌───────────────────────┐  │
│   ┌─────────────────────────┐     │  │   Gemini 2.0 Flash    │  │
│   │      PostgreSQL         │     │  └───────────┬───────────┘  │
│   │      (Port 5433)        │     │              │              │
│   └─────────────────────────┘     │  ┌───────────▼───────────┐  │
│                                   │  │   Qdrant (36k RAG)    │  │
│                                   │  └───────────────────────┘  │
└───────────────────────────────────┴─────────────────────────────┘
```

| Component | Purpose |
|-----------|---------|
| **Next.js app** | API routes, Prisma/Postgres, AI orchestration (`/api/ai/workflow`) |
| **PostgreSQL** | Primary data store |
| **Qdrant** | Vector index for 36,166 workflow exemplars |
| **n8n** | Vue-based workflow canvas with AI Builder panel |

---

## 🚀 Quick Start

### Requirements
- Docker + Docker Compose v2
- Node.js 22.x / pnpm 9.x
- Gemini API key

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

The AI builder generates structured diff actions instead of replacing entire canvases:

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
