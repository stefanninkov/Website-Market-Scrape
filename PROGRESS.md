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

## 2026-07-17 — Phase 3: Outreach (AI emails + Gmail)

**Phase:** Phase 3 — Outreach

**Done (8 of 11 tasks verified running; 3 built but blocked on live Gmail creds):**
- **ai-worker email drafts** (`workers/src/handlers/ai-email.ts`, verified): prompt from lead data + analysis.reasons + preview.url + config/toneGuide + config/identity; strict JSON `{subject, body}`; ≤120 words / one CTA / identity + address + opt-out rules in the system prompt; defensive parsing (`lib/parse.ts`: fences, prose-wrapped JSON) + zod; one retry with a "return only valid JSON" reminder then fail; budget assert/record around every call using real token usage; optional freetext steering. **Verified with a fake Anthropic client**: RS lead exercised the invalid-JSON → retry path and produced a Serbian draft; DE lead got English; anthropic budget counter accrued from token usage; prompts carried the right language rule.
- **Anthropic client** (`lib/anthropic.ts`): `claude-sonnet-4-6` per SPEC (env-overridable), lazy init so a missing key fails jobs, not the worker.
- **Settings page** (verified by screenshot at 1440/375): identity card, tone-guide editor, Gmail connect card (live status from config/gmail), monthly budget limits editor.
- **Lead drawer outreach section** (verified): steering input, Generate/Regenerate via enqueueJob, editable subject/body persisted on blur, Send via Gmail with confirm; sent/opens/replied summary; soft-warning toast when the send count passes 20/day. Events timeline (Activity) from `events` with a composite index added.
- **px function** (verified against the functions emulator): serves the 1x1 gif always, increments `outreach.opens`, sets `lastOpenAt`, appends an `open` event; unknown lead ids still get the gif.
- **sendEmail callable** (code + auth gate verified): validates owner/lead/draft/email, builds multipart MIME (RFC 2047 subject, UTF-8 plain + HTML with pixel — builder verified by decoding output), sends via Gmail, sets threadId/lastSentAt/followUpDue(+4d), auto-advances new/qualified → contacted, writes `sent` event, returns today's send count for the soft warning.
- **Gmail OAuth flow** (code complete): gmailAuthStart → consent (offline, forced refresh token) → gmailAuthCallback verifies the Google account is the owner, stores tokens in config/gmail, bounces to /settings. Hosting rewrites for /px and the OAuth endpoints added.
- **Reply detection** (code complete; fallback logic verified): gmailPushHandler (Pub/Sub topic gmail-replies) walks history → threadIds → `applyRepliesFromThreads`; VPS cron polls threads every 30 min via `pollReplies` and renews the watch daily via `renewWatchIfDue`. **Verified with a fake Gmail client against the emulator**: reply detection (`threadHasReply`), lead → replied + stage change + followUpDue cleared + `reply` event, idempotent second poll, watch renewal at <24h and skip when fresh.
- **Dashboard v2** (verified): due-follow-ups counter + list (followUpDue ≤ now, unanswered), reply-rate counter (replied/contacted, 33% on seed data).
- **Pipeline kanban** (verified at 1440/375): six columns, drag-and-drop on desktop, per-card stage picker on mobile, horizontal scroll.
- **Leads bulk actions** (verified UI): select-all/per-row checkboxes, bulk Generate drafts (sequential enqueue; the single ai-worker serializes generation per SPEC), bulk stage move, bulk Ignore with confirm.

**Decisions:**
- Mobile kanban uses a per-card stage select instead of long-press drag — reliable on touch, zero dependencies; long-press drag can replace it later if it ever grates.
- sendEmail returns `{sentToday, softLimit}` and the UI toasts the soft warning — keeps the 20/day rule advisory (SPEC: soft), never blocking.
- gmailAuthCallback rejects any Google account other than the owner's before storing tokens (single-user lock, matches rules/OWNER_EMAIL).
- Reply detection is belt-and-braces per SPEC: push handler for freshness, VPS poll as the fallback; both share the same lead-update shape and event type.
- Composite indexes added for `events(leadId, at desc)` (drawer timeline) and `events(type, at)` (daily send count).

**Deviations from SPEC:** none.

**New dependencies:**
- `@anthropic-ai/sdk` (workers) — the Anthropic API client for SPEC §7/§8 generation.
- `googleapis` (functions, workers) — Gmail API + OAuth for send/replies/watch (SPEC §7).

**Known issues / next up:**
- The three unchecked Phase 3 tasks (OAuth flow, live send, live reply detection) are code-complete but need Stefan's GMAIL_CLIENT_ID/SECRET, the `gmail-replies` Pub/Sub topic, and a real Gmail account to verify end-to-end — everything up to the Gmail API boundary is tested.
- gmailPushHandler deploys only after `gcloud pubsub topics create gmail-replies` (topic must exist).
- Next: Phase 4 (preview generator) — templates, preview copy, preview-worker, servePreview; verifiable locally.

---

## 2026-07-16 — Phase 2: Analyzer + scoring

**Phase:** Phase 2 — Analyzer + scoring

**Done (all 6 tasks, verified running):**
- **Pure analysis module** in `/shared` (`analysis.ts`): `scoreSite()` (SPEC §6 scoring table, cap 100), `extractCopyrightYear()` (newest plausible year regex), `detectTechStack()` (WordPress, jQuery 1.x, layout tables, Flash, Wix/Weebly/Jimdo free tiers), point constants, and the checks-object builder. Dependency-free so it's unit tested in isolation.
- **Unit tests** (vitest in `/shared`, 25 tests, all passing): websiteType classifier (incl. the "domain merely contains 'facebook'" trap), copyright-year regex (ranges, phone-number rejection, future-year rejection), tech fingerprints, and every scoring band incl. the 100 cap and the unreachable short-circuit.
- **PSI client** (`workers/src/lib/pagespeed.ts`): mobile performance score 0-100, returns null on any error/quota/timeout (graceful skip, SPEC §6).
- **Playwright analyzer** (`workers/src/lib/analyzer.ts`): one shared browser, honest UA, 375px viewport, 20s timeout, 2s spacing between sites. Extracts HTTPS/SSL (via response securityDetails), viewport meta, horizontal overflow, copyright year, tech fingerprints, Last-Modified, parked-domain markers. Email scraping: homepage + /kontakt, /contact, /impressum, /o-nama, mailto + visible addresses, asset-filename filtered, stops at the first hit. Secondary pages gated by a minimal robots.txt parser (`robots.ts`) — homepage always visited, deeper pages respect Disallow (SPEC §11).
- **analyze handler** (`workers/src/handlers/analyze.ts`, factory over {db, analyzer, psi}): audits the lead's site, adds PSI, runs `scoreSite`, writes `analysis: done` with score/checks/reasons, and fills `email`/`emailSource: site_scrape` only when the lead had no email. On analyzer failure writes `analysis: failed` and fails the job.
- **Lead drawer analysis section**: checks grid (HTTPS, viewport, responsive, SSL), PageSpeed with color band, copyright year, tech-stack chips, full reasons list; pending/failed states handled.
- **Weekly cron** (`workers/src/handlers/cron.ts` + `cron.ts`): fires once per ISO week the first time it sees Sunday ≥ 06:00 Europe/Belgrade (CET/CEST via Intl), enqueues a `sweep` job per `schedule=='weekly'` sweep, idempotent via `config/cron.lastWeeklyKey`. isNewBusiness flagging on re-runs was already in the sweep handler; the "New business" badge already exists in the UI.

**Verification (real Chromium + Firestore emulator):**
- Analyzer vs. local fixture sites — OLD (no viewport, 375px overflow, © 2014, WordPress + jQuery 1.x + layout tables, mailto): score 100, all 8 reasons, email scraped. MODERN (viewport, © 2026, clean): only the fixture's http penalty, email scraped. DOM extraction, tech fingerprinting, copyright regex, overflow, email all correct.
- analyze handler vs. emulator: lead → `analysis.status done`, score 100, checks + techStack populated, 8 reasons, `email` set with `emailSource site_scrape`, job done.
- Cron vs. emulator: Sunday 07:00 CEST enqueues 2 weekly sweeps (skips the manual one), second call same week enqueues 0 (idempotent), weekday/Saturday not due.
- Drawer analysis section rendered against a done-status lead (screenshot): checks grid, PageSpeed 34/100 in red, copyright 2016, tech chips, reasons, site_scrape email.

**Decisions:**
- Analyzer launches with `ignoreHTTPSErrors: true` so the DOM always loads; SSL validity is judged separately from the response's securityDetails. This separates "insecure cert" from "unreachable".
- Cron keys on the Belgrade local Sunday date rather than firing at an exact minute — robust to restarts and missed ticks, and DST-correct without a tz dependency.
- `PLAYWRIGHT_CHROMIUM_PATH` env override added to the analyzer (defaults to Playwright's bundled browser) — documented in `.env.example`; lets a VPS image pin its own Chromium.
- Tech fingerprint points cap at +20 (two fingerprints) per SPEC even when three+ are detected.

**Deviations from SPEC:**
- Added `"DOM"` to the workers tsconfig `lib` — type declarations only (for `page.evaluate` browser-context callbacks), no runtime effect on the Node worker.

**New dependencies:**
- `playwright` (workers) — the analyzer engine, required by SPEC §6. Browsers are not downloaded in CI (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`), pinned via `PLAYWRIGHT_CHROMIUM_PATH` where needed.
- `vitest` (shared, dev) — the unit-test runner named in PLAN Phase 2.

**Known issues / next up:**
- SSL "valid" is inferred from a successful secure handshake (securityDetails present); it does not distinguish expired-but-chaining certs. Good enough for the opportunity signal.
- Live analyzer runs against real sites still want a quick smoke test once the VPS + a real lead exist (fixtures cover the logic; the network path through a residential IP is environment-specific).
- Next: Phase 3 (AI emails + Gmail) — needs Stefan's Anthropic API key and Gmail OAuth before its generation/send paths can be verified, so that's the natural place to pause for setup.

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
