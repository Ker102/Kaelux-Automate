# Local Setup Guide

This guide describes how to run the Kaelux Automate application locally.

## Prerequisites

Ensure you have the following installed:
-   **Docker** & **Docker Compose v2**
-   **Node.js** v22.x
-   **pnpm** v9.x

## Step-by-Step Instructions

### 1. Environment Setup

1.  Copy the environment variable templates:
    ```bash
    cp .env.example .env
    # .env.local should already exist, but if not:
    # cp .env.local.example .env.local 
    ```
2.  Review `.env` and `.env.local` to ensure all required keys (especially `GEMINI_API_KEY` or similar) are set.

### 2. Build n8n

The n8n instance is embedded and requires a local build to generate the Docker image.

```bash
cd n8n
pnpm build:n8n > n8n-build.log 2>&1
pnpm build:docker > n8n-docker.log 2>&1
cd ..
```
This creates the `n8nio/n8n:local` image used by Docker Compose.

> [!TIP]
> **Sharing Logs with AI**: The `> filename.log 2>&1` syntax redirects both output and errors to a file. If the build fails, you can ask the AI to "read n8n-build.log" to help diagnose the issue.

### 3. Start the Stack

Run the following command to start all services (App, Postgres, Qdrant, n8n):

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 4. Seed Data (Optional)

To populate Qdrant with initial workflow examples:

```bash
docker compose -f docker-compose.dev.yml exec app npm run seed:qdrant
```

## Access Points

Once running, the services are available at:

-   **Next.js Control Plane**: [http://localhost:3000](http://localhost:3000)
-   **n8n Canvas**: [http://localhost:5678](http://localhost:5678)
-   **Qdrant REST API**: [http://localhost:6333](http://localhost:6333)
-   **Postgres**: `localhost:5433` (User: `postgres`, Pass: `postgres`, DB: `project05`)

## Troubleshooting

-   **Windows Users**: If you encounter path issues, prepend `COMPOSE_CONVERT_WINDOWS_PATHS=0` to the docker compose command.
-   **Rebuilding n8n**: If you make changes to the `n8n/` directory, you must repeat Step 2 and restart the `n8n` service:
    ```bash
    docker compose -f docker-compose.dev.yml up -d n8n
    ```
