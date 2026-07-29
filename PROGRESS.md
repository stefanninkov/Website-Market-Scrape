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

## 2026-07-17 — Phase 5: Polish backlog

**Phase:** Phase 5 — Polish backlog

**Done (all 4 tasks):**
- **Bulk preview generation**: "Generate previews" in the Leads bulk bar — sequential `generate_preview` enqueue for the selection (same verified enqueue + preview pipeline as singles).
- **CSV export** (verified by capturing the actual download in headless Chromium): exports the currently filtered leads with name/niche/location/contact/websiteType/score/stage/rating/previewUrl columns, correct RFC-style quoting (comma-containing addresses verified), BOM for Excel, dated filename.
- **Won/Lost stats + reply-rate chart** (verified by screenshot): Won/Lost counters (shown once any exist) and an inline-SVG sent-vs-replies weekly bar chart for the last 8 weeks, built from `events` with the existing `(type, at)` composite index — no chart dependency.
- **PWA manifest** (verified served): `manifest.webmanifest` + generated 192/512 icons (dark bg, lime F), linked with theme color and apple-touch-icon so the app installs to the phone home screen.

**Decisions:**
- Chart is hand-rolled SVG in palette colors (info/success) — a chart library for one small bar chart would violate the no-unjustified-dependencies rule.
- CSV is generated client-side from the filtered table view, so filters double as the export selector.

**Deviations from SPEC:** none.

**New dependencies:** none.

**Known issues / next up:**
- Phase 6 (FlowDev portfolio) starts with "gather content from Stefan" and a design direction decided with him — blocked on his input by design, so autonomous work stops here.
- Full remaining-for-Stefan list: Firebase project + `.firebaserc`/`app/.env`, Places API key, Anthropic key, Gmail OAuth client + `gmail-replies` topic, Hetzner VPS (README has steps), niche image sets (optional), then live-verify the three Gmail tasks and the Phase 0 "Firebase project init" checkbox.

---

## 2026-07-17 — Phase 4: Preview generator

**Phase:** Phase 4 — Preview generator

**Done (8 of 9 tasks verified running; image curation awaits Stefan's assets):**
- **4 preview templates** (`workers/templates/*.html`, verified by screenshot at 375/1440 with zero horizontal overflow): minimal-light (dot-grid hero, oversized clamp headline, numbered 3-col services), bold-dark (full-bleed dark hero + gradient overlay, per-niche accent — gym lime / auto red / trades amber, uppercase grotesk, diagonal divider, hover-lift cards), warm-local (cream + serif display, 24px-rounded hero visual, cozy 2-col services with icons, prominent rating), corporate-clean (navy/teal, split hero, checkmark service rows). All four: shared structure per DESIGN.md, tel: CTA, rating block only at ≥4.0 (verified hidden below), Serbian/English content strings by country, always-English dismissible branding bar (sessionStorage), concept disclaimer, full OG/Twitter meta, one preloaded Google Font each, no unfilled slots (asserted).
- **PreviewCopy generation** (`workers/src/handlers/ai-preview.ts`): SPEC §8 JSON contract, zod-validated, one retry, budget-tracked, RS→Serbian rule, weakness-aware but never negative, invents no facts.
- **preview-worker** (`workers/src/handlers/preview.ts` + `lib/render.ts` + `lib/og.ts`, verified E2E against firestore+storage emulators): copy → slug (`frizerski-salon-ana-x7k2` shape, transliterated diacritics) → render → `previews/{slug}.html` + OG PNG (1200x630, template-palette card screenshotted via the existing Playwright dep) → `preview: ready`. Auto template by niche (verified warm-local for hair salons), manual override honored, slug + view count stable across regenerate (verified), failure path → `preview.status: failed`.
- **servePreview** (verified through the functions emulator): streams HTML and `{slug}-og.png` from Storage via Admin SDK (owner-only rules stay closed), correct content types, 404 for unknown slugs, and on page views only — increments `preview.views`, sets `lastViewAt`, appends `preview_view` event (all verified).
- **Drawer preview section** (verified by screenshot): status + view count + last view, clickable /p/ URL, template select with "(auto)" marker, Generate/Regenerate.
- **{previewUrl} in email prompts** (verified): a ready preview's URL flows into the generate_email prompt; without one the prompt pivots to a call CTA.
- **Dashboard preview-views counter** (count of preview_view events).
- **Niche image plumbing without curated assets**: deterministic per-lead pick from Storage `niche-images/{niche}/` (hash of placeId), embedded as a data URI so previews stay single-file, 300KB cap, gradient fallback per template. Lights up automatically once Stefan uploads image sets.

**Decisions:**
- OG images are rendered by screenshotting a palette-matched HTML card in headless Chromium — reuses the Playwright dependency the analyzer already requires instead of adding satori/node-canvas (SPEC §8 named those as examples of the approach, not requirements).
- Hand-written compact CSS per template rather than a Tailwind build step — same outcome SPEC asks for (self-contained HTML, inlined CSS) with no extra toolchain; DESIGN.md's exact tokens are embedded.
- Curated niche images are embedded as base64 data URIs (self-contained previews, no public Storage paths); files over 300KB fall back to gradients to protect the performance budget.
- PreviewCopy generation is authored as ai-worker code but invoked from the preview pipeline, so one `generate_preview` job covers copy + render (SPEC §4's job types stay closed; no cross-worker handoff to race).
- Regenerate keeps the slug (links in already-sent emails never break) and the view counter.

**Deviations from SPEC:**
- OG generation mechanism (Playwright screenshot instead of satori/node-canvas) and template CSS authored by hand instead of a Tailwind build — outcomes match SPEC/DESIGN; noted for transparency.

**New dependencies:** none.

**Known issues / next up:**
- "Curate niche image sets" stays unchecked: sourcing licensed stock photos needs Stefan (can't be done from this environment). The picker + fallback pipeline is verified with gradients.
- Google Fonts fall back to system stacks in the sandbox (no external network in the test browser); real deployments load them. Lighthouse ≥95 must be measured on the deployed site.
- Next: Phase 5 polish backlog (bulk previews, CSV export, stats, PWA manifest).

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

---

## 2026-07-29 — warm-local preview: real visual substance

**Done:**
- Rebuilt `workers/templates/warm-local.html` after Stefan's "it's still so blank and it doesn't look like a website at all". Screenshotted the actual output first: the page was four thin sections on one flat cream background with no imagery, no colour rhythm and large voids. The problem was structural, not spacing.
- Page is now nav → full-bleed dark hero → accent ticker → services → dark stats band → about → visit → accent CTA band → footer. The scroll alternates cream / deep / accent instead of running one colour top to bottom.
- Hero visual: with a curated niche image it's a photo panel; without one it's a built composition (arch, lettermark, floating rating chip, region tag). Previously the visual was omitted entirely when there was no image, which is what made the hero read as half-empty.
- `iconFor()` / `svgIcon()` in `render.ts`: line-art icons matched against the AI-written service title, 12 keyword groups covering Serbian and English, neutral fallback. Replaces the identical `✦` that sat on every row.
- `renderStats()` — rating, review count, days open, service count. Every value comes from Places or the AI copy; no invented numbers.
- `renderMarquee()` emits four copies of the sequence. Each row translates -100% of its own width, so two copies left a bare gap at the right edge on viewports wider than the content (1326px of content on a 1440px screen).
- `splitAbout()` — the About pull quote is the first sentence of the AI about copy. It was `{{subheadline}}`, which printed the same sentence in the hero and in About on the same page.
- Removed the doubled `section` + `.wrap` vertical padding on the stats and CTA bands (176px and 172px respectively) — the source of the remaining voids. Desktop page height dropped 4311 → 3924 with *more* content.
- Contact card: `.maplink` pushed to the bottom so the shorter card fills its row instead of ending in a void.
- Tap targets: brand, phone link and footer links raised to ≥44px.

**Verified:**
- Typecheck clean. 0 horizontal overflow at 320 / 375 / 414 / 768 / 1024 / 1440 / 1920.
- Regenerated the live preview end to end (job → worker → Storage → servePreview). Deployed HTML confirmed to contain the new markup with no unfilled `{{slots}}`.

**Decisions:**
- WEB-STANDARD §8.1 ("never ship an empty placeholder") was previously read as "ship nothing when there's no image". That produced the blank page. Correct reading: ship something *designed*. §8.1 should be reworded to say so.
- Section eyebrows get their own strings (`eyeServices` / `eyeAbout` / `eyeVisit`) rather than reusing the heading — an eyebrow that repeats the h2 under it is filler.

**Deviations from SPEC:** none.

**New dependencies:** none.

**Known issues / next up:**
- No stock-image host is reachable from the sandbox proxy, so the hero composition is the fallback path in practice. Curated niche imagery in Storage `niche-images/{niche}/` is still the real fix — the code path already exists and switches the hero to `has-visual` the moment an image is there.
- Only `warm-local` has been rebuilt. `minimal-light`, `bold-dark` and `corporate-clean` are still the old thin versions.
- The AI copy prompt is unchanged and still writes generically ("verujemo da svaka kosa ima svoju priču"). WEB-STANDARD §11 wants concrete over poetic; the prompt doesn't enforce it yet.
- `PLAYWRIGHT_CHROMIUM_PATH` must be set for the preview worker's OG-image step wherever the bundled Playwright build doesn't match the installed browser.

---

## 2026-07-29 (2) — booking module + niche-driven page shape

**Done:**
- `nicheProfile()` in `render.ts` routes a niche to one of three primary actions from WEB-STANDARD §10 — `booking` (salons, barbers, clinics, physio, vets, tattoo), `table` (restaurants, cafés, konobe, bakeries), `call` (trades, emergency, towing, auto repair) — and picks the accent within warm-local's warm family. The page shape now changes by business type instead of every lead getting the same page with different words.
- Booking module: service (or party size) → date → time → contact. Day strip covers the next 14 days; slots are generated in the browser from the lead's real Google `openingHours`.
- CTA consolidation: hero button, nav entry and the mobile call bar all point at the module when it exists, so the page carries one CTA idea (WEB-STANDARD §11) instead of "call us" competing with "book".
- WEB-STANDARD §10.1 added: the CTA column is a module the page must carry, not a button label, plus the rules the module has to satisfy.

**Verified** by driving the flow in a real browser, not by inspection: Serbian weekday names via `Intl`, Sunday disabled and labelled `Zatvoreno` from real hours, slots 12:00–19:30 against real 12:00–20:00 hours, empty submit blocked with the error, confirmation panel correct, zero page errors, 0 horizontal overflow at 320–1920.

**Decisions:**
- **A preview must not imply a booking reached the business.** Previews carry a disclaimer and are reachable by real customers; a confirmation that read like a real booking would leave someone waiting on an appointment nobody received. The form confirms the *selection*, states plainly nothing was sent, and hands off to the phone number.
- **No opening hours → no module.** Inventing availability breaches WEB-STANDARD §11. Dropping the section is correct; a booking form with made-up slots is worse than no booking form.
- Same-day slots keep a 60-minute lead time — offering a slot five minutes out advertises that nothing behind the form is real.

**Deviations from SPEC:** SPEC §8 doesn't describe a booking module. WEB-STANDARD §10 (source-of-truth doc #4, authoritative for websites) names "Book / Call" as the primary CTA for salons and "Book appointment" for clinics, so this implements an existing rule rather than inventing a feature. SPEC §8 should gain a line pointing at WEB-STANDARD §10.1.

**New dependencies:** none. The module is vanilla JS inside the template — no date-picker library.

**Known issues / next up:**
- **`loadTemplate()` caches templates for the process lifetime.** A stale preview-worker started before a template edit silently served the old template and produced a preview with no booking section; it took a byte-count check on the deployed file to catch it. Template edits require a worker restart — worth a note in the deploy script, or dropping the cache in dev.
- Slot step is a flat 30 min for every service. Real salons vary by service (a cut is not a balayage); the copy contract has no duration field.
- Booking exists only in `warm-local`. `minimal-light`, `bold-dark` and `corporate-clean` are still the old thin versions.

---

## 2026-07-29 (3) — booking + reviews across all four templates

**Done:**
- Rebuilt `minimal-light`, `bold-dark` and `corporate-clean`. All four templates now share one page structure and one booking implementation, differing only in visual language per DESIGN.md §The 4 variants:
  - `minimal-light` — white, ink `#101318`, accent `#2D5BFF`, dot-grid hero, numbered services on thin dividers.
  - `bold-dark` — `#0A0A0B`, Archivo, uppercase headline, niche accent via `boldAccentForNiche`, diagonal hero divider, bordered cards with big index numbers.
  - `corporate-clean` — navy `#12233D` + teal `#1F8A70`, split hero, bordered service rows, conservative spacing.
- Booking behaviour moved out of `warm-local.html` into `BOOKING_SCRIPT` in `render.ts` — one implementation shipped with the module, templates supply only CSS. Four copies of that script would have drifted the same way the service markup already had.
- `accentFor(templateId, niche)` — only `warm-local` varies accent by niche; the rest carry their DESIGN.md brand colour.
- Reviews: the rating band is now a reviews section — heading, stars, score, "na osnovu N recenzija", and a link to the business's own Google reviews page (`search.google.com/local/reviews?placeid=`). The stat grid no longer repeats the rating and review count stated directly above it; it carries days open, service count, region and category instead.
- Published comparison previews at `/p/demo-{templateId}` for all four, same lead and copy, so only the design differs.

**Verified** per template: renders with no unfilled slots, booking flow driven in a browser (service → day → slot → contact), 14 day buttons built from real opening hours with Sunday disabled, 0 horizontal overflow at 320–1920, no page errors. Storage objects re-read after upload to confirm each carries its own accent, the booking form and the reviews link.

**Bugs found and fixed while rolling out:**
- `renderServices()` emitted per-template markup that had already drifted: `minimal-light`'s CSS targeted `.num` while the markup emitted `.svc-n`, so its service numbers had been invisible. All templates now share one markup shape and differentiate in CSS.
- `corporate-clean` left an empty grey cell with 5 services in a 2-column bordered grid — the odd final card now spans the row.

**Decisions:**
- **Google review *text* is deliberately not embedded.** Two reasons: (1) `places.reviews` sits in a higher Places SKU than the Pro tier the details mask uses (`PLACES_DETAILS_USD` = $0.017), roughly doubling per-lead detail cost, and SPEC §5 mandates strict field masks; (2) it's the same rule family that already put "NEVER use Google Places photos" in SPEC §8 — Places reviews must be shown unmodified with author attribution, and showing only the favourable ones is the specific thing that isn't allowed, plus previews are static Storage files that live indefinitely, past the caching limits. Linking out keeps reviews attributed, unfiltered and current at no extra cost. Flagged to Stefan as his call.

**Deviations from SPEC:** none beyond the booking module already recorded in the previous entry.

**New dependencies:** none.

**Known issues / next up:**
- `/p/demo-*` slugs are throwaway comparison copies not attached to any lead, so `servePreview` won't log views for them (the lead lookup by slug finds nothing). Delete once a direction is picked.
- Preview HTML is static in Storage: editing a template does not regenerate existing previews, they must be re-published. Combined with `loadTemplate()`'s process-lifetime cache, a template change needs both a worker restart and a regeneration.
- Stefan's standing feedback is that the pages still read generic. Booking and the niche-driven page shape address the structural half; the AI copy prompt is still unchanged and remains the open half.

---

## 2026-07-29 (4) — Phase 7: agent foundation + A1 qualifier

Built in the order Stefan asked for: loop, tool framework, run logging and the Agent page before the qualifier itself.

**Done:**
- `agent/loop.ts` — AGENTS.md §2.1. All three bounds checked together before every model turn. Submission is a tool rather than free text, so the final answer arrives already shaped and the model cannot end a run by writing prose. Output zod-validated with one retry carrying the errors back.
- `agent/tools/registry.ts` — the enforcement point. A tool the registry does not hold cannot be called; per-run call caps are counted here, not left to the model; each tool declares `writes`.
- `agent/tools/url-guard.ts` — refuses non-http schemes and private ranges **after** DNS resolution.
- Tools: `read_lead`, `fetch_page`, `screenshot_page`, `places_details`, `web_search`, `run_analyzer`.
- `agent/runs.ts` — opens the run doc immediately and appends steps as they happen, so the feed is readable mid-run. Lead state is never written here.
- `shared`: agent types and schemas, `config/agents` defaults, the three agent budget levels.
- `agent/qualifier.ts` + `handlers/qualify.ts` — A1. Refuse early, run, then write lead state in one transaction only on `done`.
- Sixth pm2 process `wms-agent`. Auto-enqueue `qualify` after `analyze`.
- `/agent` page: run feed, expandable step timeline, kill switch, per-agent toggles, budget field, cost-per-qualified-lead.
- 20 unit tests, all passing.

**Decisions:**
- **Agent spend lands on the anthropic counter as well as the agent counters.** It is the same bill, so the existing guard has to see it. The agent counters sit on top for attribution and cost-per-qualified-lead.
- **The monthly agent limit lives only in `config/agents`**; `config/apiBudget` carries only the spend. One source of truth for the number.
- **Daily agent allowance is derived as monthly / 30.** AGENTS.md §8.4 asks for a daily soft warning at 80% but names no daily limit. It only warns, never blocks.
- **The agent budget blocks at 100%, not the 90% the Places/Anthropic guards use.** Agent spend is discretionary and a refused run costs nothing but a `blocked_budget` job.
- Added `createRawAnthropic` beside the existing single-shot `AnthropicClient` rather than widening it, so the v2 workers are untouched.

**Deviations from SPEC:** none.

**New dependencies:** none. The loop uses the `@anthropic-ai/sdk`, `zod` and `playwright` already present.

**Known issues / next up:**
- **`web_search` has no provider wired.** It needs an API key Stefan has not chosen. The tool returns "not configured" and tells the model to continue and lower its confidence, so runs degrade rather than fail.
- **The qualifier has not been run against a live lead.** Everything is verified by typecheck and unit tests against a fake client; no real Anthropic tool-use round trip has happened yet. The PLAN milestone is not met until it has.
- **`/agent` has not been visually verified at 375px.** It is written to the DESIGN.md tokens and mobile rules and it builds, but CLAUDE.md requires testing both breakpoints, so treat the page as unverified.
- The Leads page `fitScore` column, verdict chip and verdict filter are still unbuilt — that PLAN item is deliberately left unchecked.
- `PREVIEW-SYSTEM.md` is missing from the repo but referenced 21 times by the installed docs. Phase 8 and Phase 10 cannot start without it.
