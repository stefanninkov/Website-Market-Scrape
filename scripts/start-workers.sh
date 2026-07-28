#!/usr/bin/env bash
# Start (or restart) the five workers under pm2. Run as the app user from
# anywhere inside the repo, after workers/.env and workers/service-account.json
# are in place.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}/workers"

missing=0
for f in .env service-account.json; do
  if [ ! -f "$f" ]; then
    echo "ERROR: workers/$f is missing." >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

# Fail fast on placeholder keys rather than letting jobs fail one by one.
for key in GOOGLE_PLACES_API_KEY ANTHROPIC_API_KEY; do
  val="$(grep -E "^${key}=" .env | cut -d= -f2- || true)"
  if [ -z "$val" ]; then
    echo "ERROR: ${key} is empty in workers/.env" >&2
    exit 1
  fi
done

chmod 600 .env service-account.json

echo "==> building"
(cd "${REPO_ROOT}" && npm run build:workers)

echo "==> starting pm2"
if pm2 describe wms-sweep >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo
pm2 status
echo
echo "Tail a worker:  pm2 logs wms-sweep"
