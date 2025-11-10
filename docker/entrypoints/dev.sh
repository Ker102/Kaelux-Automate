#!/usr/bin/env bash
set -euo pipefail

cd /app

if [ -f package-lock.json ]; then
  npm install
fi

npx prisma generate

exec npx next dev --hostname "${HOST:-0.0.0.0}" --port "${PORT:-3000}"
