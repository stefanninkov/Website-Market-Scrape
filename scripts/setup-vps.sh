#!/usr/bin/env bash
# One-shot VPS provisioning for the Website Market Scrape workers.
#
# Run as root on a fresh Ubuntu 24.04 Hetzner CX22:
#   bash setup-vps.sh
#
# Installs Node 20, pm2, Chromium deps for Playwright, clones the repo and
# builds everything. It does NOT start the workers — you still need to drop in
# workers/.env and workers/service-account.json, then run start-workers.sh.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/stefanninkov/Website-Market-Scrape.git}"
BRANCH="${BRANCH:-claude/website-market-scrape-phase-0-uhum4i}"
APP_USER="${APP_USER:-wms}"
APP_HOME="/home/${APP_USER}"
APP_DIR="${APP_HOME}/Website-Market-Scrape"

echo "==> [1/6] System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates build-essential >/dev/null

echo "==> [2/6] Node.js 20"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v), npm $(npm -v)"

echo "==> [3/6] pm2"
npm i -g pm2 >/dev/null 2>&1
echo "    pm2 $(pm2 -v)"

echo "==> [4/6] App user + repo"
id -u "${APP_USER}" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "${APP_USER}"
if [ -d "${APP_DIR}/.git" ]; then
  sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch origin "${BRANCH}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${BRANCH}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  sudo -u "${APP_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

echo "==> [5/6] Dependencies + build (a few minutes)"
cd "${APP_DIR}"
sudo -u "${APP_USER}" npm install --no-audit --no-fund
# Chromium for the analyzer + OG image renderer
sudo -u "${APP_USER}" npx playwright install chromium
npx playwright install-deps chromium >/dev/null 2>&1 || true
sudo -u "${APP_USER}" npm run build:workers

echo "==> [6/6] pm2 boot service"
pm2 startup systemd -u "${APP_USER}" --hp "${APP_HOME}" >/dev/null 2>&1 || true

cat <<EOF

============================================================
 Provisioning done.

 Two files still needed in ${APP_DIR}/workers/ :
   1. .env                  (API keys — paste the block Claude gave you)
   2. service-account.json  (Firebase service account key)

 Then start the workers:
   sudo -u ${APP_USER} bash ${APP_DIR}/scripts/start-workers.sh
============================================================
EOF
