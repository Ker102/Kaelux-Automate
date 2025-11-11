# Contributing Guidelines

Thanks for taking the time to contribute! This document explains how to propose improvements, report bugs, and submit pull requests.

## Development flow

1. **Fork and clone** the repository.
2. **Create a topic branch** off `main`.
3. **Install dependencies** and ensure tooling is available:
   ```bash
   pnpm install
   cd n8n && pnpm install
   ```
4. **Build and run** the stack locally:
   ```bash
   pnpm build:n8n && pnpm build:docker
   COMPOSE_CONVERT_WINDOWS_PATHS=0 docker compose -f docker-compose.dev.yml up -d postgres qdrant app n8n
   ```
5. **Add tests or update fixtures** whenever applicable.
6. **Run formatting and linting** before opening a PR.

## Pull requests

- Keep PRs focused; avoid mixing unrelated changes.
- Link related issues in the description.
- Ensure CI passes before requesting review.
- Update documentation (README or inline docs) when behaviour changes.

## Commit messages

- Prefer imperative mood (e.g. “Add workflow patch support”).
- Reference issues when relevant (`Fix #123`).

## Security issues

Please do **not** open public issues for vulnerabilities. Follow the process described in [`SECURITY.md`](./SECURITY.md).

## Code of Conduct

By participating you agree to uphold the community expectations documented in this repository. Be respectful, helpful, and transparent.
