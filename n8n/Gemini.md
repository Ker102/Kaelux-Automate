# n8n - Embedded Instance Context for Gemini

## Overview
This directory contains the source code for the embedded n8n instance used in Kaelux Automate. It is a monorepo containing the frontend, backend, and various packages that make up the n8n workflow automation tool.

## Role in Kaelux Automate
In the broader Kaelux Automate architecture, this directory corresponds to the `n8n` service. It provides the visual interface for building workflows and the execution engine that runs them. The Next.js app interacts with this service to inject AI-generated workflow modifications.

## Structure
This is a turborepo/pnpm workspace. Key directories include:
-   **`packages/`**: Contains the individual packages (nodes, core, design-system, etc.).
    -   `packages/cli`: The main entry point for the n8n backend.
    -   `packages/editor-ui`: The Vue.js based frontend.
    -   `packages/nodes-base`: The collection of built-in nodes.
-   **`docker/`**: Docker build context for creating the n8n image.

## Development & Build
To apply changes made in this directory to the Kaelux Automate stack:

1.  **Rebuild n8n**:
    ```bash
    pnpm build:n8n
    ```
2.  **Rebuild Docker Image**:
    ```bash
    pnpm build:docker
    ```
    This creates the `n8nio/n8n:local` image.
3.  **Restart Service**:
    Go to the project root and restart the n8n service:
    ```bash
    docker compose -f docker-compose.dev.yml up -d n8n
    ```

## Key Considerations
-   **Frontend Changes**: If modifying the canvas or UI, look into `packages/editor-ui`.
-   **Backend Logic**: Core execution logic is largely in `packages/core` and `packages/cli`.
-   **Nodes**: New nodes or modifications to existing nodes happen in `packages/nodes-base`.
-   **AI Integration**: Look for custom components or modifications that enable the "AI Builder" panel, likely within `packages/editor-ui` or custom extensions.
