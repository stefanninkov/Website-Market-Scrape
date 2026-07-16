# Website Market Scrape

Personal lead generation app for Ninkov FlowDev. Finds European businesses with no website or an outdated one, scores them, generates AI-personalized cold emails and one-page website previews, and manages outreach from a single dashboard.

Docs: [SPEC.md](SPEC.md) (what) · [PLAN.md](PLAN.md) (order) · [DESIGN.md](DESIGN.md) (UI) · [CLAUDE.md](CLAUDE.md) (working rules) · [PROGRESS.md](PROGRESS.md) (log)

## Repo layout

```
app/        React 19 + Vite + TS + Tailwind v4 (Firebase Hosting)
functions/  Cloud Functions: px, gmailPushHandler, enqueueJob, servePreview
workers/    VPS workers: sweep, analyze, ai, preview, cron (pm2)
shared/     Types, zod schemas, Firestore helpers, budget guards
```

npm workspaces monorepo. `shared` is built first and consumed as `@wms/shared` by the other three.

## Local development

Requirements: Node ≥ 20, npm ≥ 10.

```bash
npm install                # installs all workspaces
npm run build:shared       # build @wms/shared (needed once, and after edits)
npm run dev:app            # Vite dev server
npm run typecheck          # typecheck all workspaces
npm run build              # build everything
```

App config: copy `app/.env.example` → `app/.env` and fill in the Firebase web app values.
Workers config: copy `workers/.env.example` → `workers/.env`, fill in keys, and drop the Firebase service account JSON next to it.

## Firebase setup (one-time)

1. Create a Firebase project (Blaze plan), region Europe. Enable Firestore, Authentication (Google provider), Hosting, Storage.
2. Put the project ID in `.firebaserc`.
3. In the same GCP project enable **Places API (New)** and **PageSpeed Insights API**, create API keys.
4. Deploy rules + hosting + functions:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage
npm run build:app && firebase deploy --only hosting
firebase deploy --only functions
```

Security rules lock every read/write to the owner Google account (`stefan.ninkov@gmail.com`); workers and functions use the Admin SDK.

## VPS setup (Hetzner CX22, Ubuntu 24.04)

One-time provisioning:

```bash
# as root: create user, basics
adduser wms && usermod -aG sudo wms
apt update && apt upgrade -y
apt install -y git build-essential

# Node 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# pm2
npm i -g pm2
pm2 startup systemd -u wms --hp /home/wms   # run the command it prints

# Playwright deps (needed from Phase 2)
npx playwright install-deps chromium

# as wms: clone + configure
su - wms
git clone https://github.com/stefanninkov/Website-Market-Scrape.git
cd Website-Market-Scrape
npm install
cp workers/.env.example workers/.env        # then fill it in
# scp the Firebase service account JSON to workers/service-account.json

# build + start
npm run build:workers
cd workers && pm2 start ecosystem.config.cjs && pm2 save
```

Deploying updates:

```bash
./scripts/deploy-workers.sh    # run on the VPS: pull, install, build, reload pm2
```

Useful:

```bash
pm2 status          # all 5 workers: wms-sweep, wms-analyze, wms-ai, wms-preview, wms-cron
pm2 logs wms-sweep  # tail one worker
pm2 reload all      # zero-downtime restart after a deploy
```

## Environment variables

See `app/.env.example` and `workers/.env.example`. Gmail OAuth values (Phase 3) are configured on the Functions side; see SPEC §13.
