# PROGRESS.md — Website Market Scrape

Living build log. Claude Code appends an entry at the end of every session and after significant milestones. Newest entry on top. Never rewrite old entries.

Entry template:

```
## YYYY-MM-DD — short session title

**Phase:** (from PLAN.md)
**Done:**
- ...

**Decisions:**
- ... (anything chosen that SPEC/DESIGN didn't fully specify, with one-line reason)

**Deviations from SPEC:**
- ... (or "none")

**New dependencies:**
- package — reason (or "none")

**Known issues / next up:**
- ...
```

---

## 2026-07-16 — Phase 1: Sweeps + Leads (first usable version)

**Phase:** Phase 1 — Sweeps + Leads

**Done (all 8 tasks, verified running):**
- **Places client** (`workers/src/lib/places.ts`): Places API (New) behind a `PlacesClient` interface. Two-step per SPEC §5 — Text Search with an ID-only field mask (`places.id,nextPageToken`), then Place Details with the strict SPEC §5 field mask for new IDs only. zod-validates every response, honest User-Agent, network/HTTP errors surface per-job (never crash the loop). Missing key fails the job, not startup.
- **Budget guard** (`workers/src/lib/budget.ts`): Firestore-backed wrapper over the shared pure helpers — `ensureBudget` (creates config/apiBudget with defaults, resets monthly), `assertBudget` (throws BudgetBlockedError at ≥90%), `recordSpend` (transactional). Every metered call goes assert → call → record.
- **sweep-worker** (`workers/src/handlers/sweep.ts` as a factory over `{db, places}`): loads the sweep, queries each niche `"{niche} in {region}, {country}"` up to 3 pages, dedupes place IDs across the run, fetches Details for new IDs, classifies websiteType, upserts leads (none→100/skipped, fb/ig→95/skipped, real→pending + enqueues an `analyze` job), bumps `lastSeenAt` for existing, flags `isNewBusiness` only on re-runs, writes sweep stats + `lastRunAt`.
- **classifyWebsiteType** in `/shared` (`classify.ts`): pure, reusable, with `WEBSITE_TYPE_SCORE` and `isDirectScored`.
- **enqueueJob** callable (`functions/src/index.ts`): owner-gated, validates job type + required payload id, writes a queued job doc, returns `{jobId}`.
- **Sweeps page**: live list, create/edit modal (country dropdown of European countries, region, niche multi-select from config/niches with free-text add, schedule), Run now (→ enqueueJob), per-sweep stats (found / no-site / new), delete with confirm.
- **Leads page**: score-sorted table (desktop) / card list (mobile, DESIGN.md), filters (country, niche, websiteType, min score, stage, new-only), ignored hidden unless filtered; opens the lead drawer.
- **Lead drawer v1**: details, rating, analysis reasons, stage select (writes through), manual email field (+ emailSource), notes (save on blur). Right-side on desktop, bottom sheet on mobile.
- **Dashboard v1**: total leads / no-real-website / new-this-week via server-side count aggregation.
- **Budget banner**: shows at ≥90% for Places/Anthropic from config/apiBudget.

**Verification (Firestore emulator + fake Places client, screenshots at 375/1440):**
- Sweep run: 3 businesses → correct classification + scores, 1 `analyze` job enqueued for the real site, budget spent $0.083 (1 text search + 3 details), stats `{found:3, noWebsite:2, newLastRun:3}`, `lastRunAt` set. Second run idempotent: still 3 leads / 1 analyze job / `newLastRun:0`.
- Budget block: at 95% the sweep job → `blocked_budget` and the Places API was never called.
- enqueueJob against the functions emulator: unauth → PERMISSION_DENIED; owner + valid → `{jobId}` and a correct queued job doc; bad type / missing placeId → INVALID_ARGUMENT.
- UI rendered against the emulator with seeded data: Leads table + drawer, mobile cards, Sweeps, Dashboard counters (5/3/5), budget banner at 93%.

**Decisions:**
- Two-step Places with ID-only Text Search (cheapest SKU) + Details only for new IDs. Budget records the conservative SPEC unit prices (text search $0.032/page, details $0.017) — may slightly over-count, never under-count, which is the safe direction for a hard guard.
- Leads: fetch top 1000 by `analysis.score` desc (one automatic index) and filter client-side — avoids composite indexes in Phase 1. Virtualization deferred (DESIGN mentions it; not needed at this volume yet).
- `category` = the sweep's first niche when a sweep has multiple niches (place→niche isn't tracked per ID); single-niche sweeps are exact.
- Every swept lead gets a non-null `analysis` (skipped+score for direct, pending+0 for real) so the table can sort by score immediately.
- Default budget limits when config/apiBudget is absent: Places $200 (matches the free credit), Anthropic $20. Editable in Settings (Phase 3).
- App gains opt-in emulator wiring (`VITE_USE_EMULATORS=1`) — a dev affordance, off in production.

**Deviations from SPEC:** none.

**New dependencies:** none (all Phase 1 code uses the stack already added in Phase 0).

**Known issues / next up:**
- Still blocked on Stefan for a live run: Firebase project + `app/.env`, a Google Places (New) API key, and deploy. All code is ready; the Places client has a single seam (`GOOGLE_PLACES_API_KEY`).
- Combined Firestore filters are client-side; if lead volume grows past ~1000, add composite indexes and server-side filtering.
- Next: Phase 2 (analyzer-worker with Playwright — runnable and verifiable in this environment, Chromium is installed).

---

## 2026-07-16 — Phase 0 scaffolding

**Phase:** Phase 0 — Scaffolding

**Done:**
- Seeded source-of-truth docs into the repo (SPEC, PLAN, DESIGN, CLAUDE, PROGRESS).
- Monorepo per SPEC §12 as npm workspaces: `shared/`, `app/`, `functions/`, `workers/`; `@wms/shared` built first, consumed via `file:../shared` by the other three.
- `/shared`: `types.ts` (full SPEC §4 model incl. PreviewCopy + config docs), zod schemas for every doc and AI output contract, SDK-agnostic Firestore helpers (paths, validated snapshot parsing, new-doc defaults, niche presets from SPEC §10), `budget.ts` guards (90% block threshold, Places/Anthropic unit prices, spend/reset helpers).
- `firestore.rules` + `storage.rules`: owner-only everything, locked to stefan.ninkov@gmail.com; syntax validated by the Firestore emulator loading them. Storage has no public path — previews are served only through servePreview (Admin SDK).
- `firebase.json` (Hosting rewrites `/p/**` → servePreview, SPA fallback, emulators), `.firebaserc` placeholder, `firestore.indexes.json`.
- Functions skeleton (compile-clean stubs): enqueueJob (owner check + unimplemented), px, servePreview. Region europe-west1.
- App skeleton: React 19 + Vite + TS strict + Tailwind v4 `@theme` with the exact DESIGN.md tokens, React Router, Google auth gate locked to owner email, graceful "Firebase not configured" screen, app shell verified by screenshot at 375px (bottom nav + safe area), 768px (icon rail), 1440px (220px sidebar). 5 stub pages.
- Workers skeleton: Firestore job-queue loop in `workers/src/lib/queue.ts` (onSnapshot on queued jobs by type, transactional claim queued→running, handler, done/failed/blocked_budget writes, BudgetBlockedError, loop never crashes), 5 entries (sweep/analyze/ai/preview/cron), pm2 ecosystem config, `.env.example`. **Verified end-to-end against the Firestore emulator**: seeded a queued sweep job, worker claimed it and wrote `status: 'failed'`, `error: 'Not implemented yet — lands in Phase 1.'`.
- README with local dev, Firebase setup, full Hetzner VPS provisioning notes and `scripts/deploy-workers.sh`.

**Decisions:**
- npm workspaces monorepo with `@wms/shared` compiled to `dist/` — single source of types consumable by web SDK, admin SDK and Vite without duplication.
- `TimestampLike` structural interface in shared types — web and admin SDK Timestamp classes differ; both satisfy it.
- Owner email hardcoded in security rules (single-user app per SPEC; also in `VITE_OWNER_EMAIL` for the UI gate).
- Functions region europe-west1 (SPEC doesn't specify; closest to European users/data).
- Budget warn and block share the 90% threshold (SPEC defines only 90%).
- Workers process jobs sequentially per process — required later by Playwright politeness rules, fine for single-user volume.

**Deviations from SPEC:**
- `ecosystem.config.cjs` instead of `ecosystem.config.js` — workers package is ESM (`"type": "module"`), pm2 config must be CommonJS.
- gmailPushHandler stub not exported yet — declaring a Pub/Sub-triggered function would break deploys until the `gmail-replies` topic exists (Phase 3, matching PLAN).
- Workers' Firebase init supports `FIRESTORE_EMULATOR_HOST` (no service account needed) — dev/verification affordance, not a feature.

**New dependencies:**
- react, react-dom, react-router-dom, firebase, vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, typescript — prescribed frontend stack (CLAUDE.md/SPEC §1).
- zod — prescribed validation layer (CLAUDE.md).
- firebase-admin, firebase-functions — Functions/workers Firestore access (SPEC §1).
- dotenv, tsx — workers env loading + dev runner (CLAUDE.md stack rules).

**Known issues / next up:**
- "Firebase project init" task stays unchecked: blocked on Stefan creating the Firebase project (Blaze), enabling Firestore/Auth/Hosting/Storage, and filling `.firebaserc` + `app/.env`. Everything code-side is ready to deploy.
- Firestore `where('type','in',...)` + `where('status','==','queued')` may need a composite index on the real project — add to `firestore.indexes.json` when first seen.
- app bundle is ~508KB minified (firebase SDK); consider code-splitting later, irrelevant for a single user.
- Next: Phase 1 (Places client + sweep-worker + enqueueJob + Sweeps/Leads pages).
