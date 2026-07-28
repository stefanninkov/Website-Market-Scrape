#!/usr/bin/env bash
# Run the workers on your own machine (macOS / Linux / WSL) instead of a VPS.
#
# Free alternative to the Hetzner setup: the workers talk to the same
# production Firestore, so sweeps, analysis, AI drafts and previews all work
# exactly the same — they just only run while your computer is on.
#
#   bash scripts/setup-local.sh
#
# Needs workers/.env and workers/service-account.json to exist first.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

if [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "ERROR: Node 20+ required (found $(node -v)). Install from nodejs.org." >&2
  exit 1
fi

missing=0
for f in workers/.env workers/service-account.json; do
  [ -f "$f" ] || { echo "ERROR: $f is missing." >&2; missing=1; }
done
[ "$missing" -eq 0 ] || exit 1

echo "==> installing dependencies"
npm install --no-audit --no-fund

echo "==> installing chromium for the analyzer"
npx playwright install chromium

echo "==> building"
npm run build:workers

echo "==> starting workers with pm2"
npm i -g pm2 >/dev/null 2>&1 || sudo npm i -g pm2
cd workers
if pm2 describe wms-sweep >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

echo
pm2 status
cat <<'EOF'

============================================================
 Workers are running locally.

   pm2 logs wms-sweep    watch a sweep happen
   pm2 stop all          stop them
   pm2 start all         start them again

 They only work while this computer is on and awake. Move to
 a VPS (scripts/setup-vps.sh) when you want them always-on.
============================================================
EOF
