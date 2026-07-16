#!/usr/bin/env bash
# Deploy workers on the VPS: pull latest, install, build, reload pm2.
# Run from anywhere inside the repo clone on the VPS.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> git pull"
git pull --ff-only

echo "==> npm install"
npm install

echo "==> build shared + workers"
npm run build:workers

echo "==> pm2 reload"
cd workers
if pm2 describe wms-cron >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> done"
pm2 status
