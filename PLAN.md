# PLAN.md — Website Market Scrape

Build order. Work top to bottom, phase by phase. Check tasks off as they're completed and verified running. Each phase ends in a usable state.

## Phase 0 — Scaffolding

- [x] Monorepo structure per SPEC §12 (app/, functions/, workers/, shared/)
- [ ] Firebase project init: Firestore, Auth (Google, locked to owner email via security rules), Hosting, Storage, Functions
- [x] firestore.rules + storage.rules: owner-only everything, `previews/` publicly readable via servePreview only
- [x] /shared: types.ts from SPEC §4, zod schemas, Firestore helpers, budget.ts guard helpers
- [x] Vite app skeleton: Tailwind v4 setup with DESIGN.md tokens, router, auth gate, app shell (sidebar desktop / bottom nav mobile)
- [x] Workers skeleton: Firestore job-queue listener loop, pm2 ecosystem config, .env.example
- [x] VPS setup notes in README (Node 20, pm2, deploy script)

## Phase 1 — Sweeps + Leads (first usable version)

- [ ] Places client with budget guard + strict field masks
- [ ] sweep-worker: text search per niche, pagination (max 3 pages), dedupe on placeId, Details fetch for new leads, websiteType classification (none/facebook/instagram/real)
- [ ] enqueueJob callable function + jobs collection statuses
- [ ] Sweeps page: create/edit sweep (country dropdown, region, niche multi-select from config presets + free text), Run now, last run stats
- [ ] Leads page: table with filters (country, niche, websiteType, score, stage, isNewBusiness), sort by score, mobile card layout
- [ ] Lead drawer v1: details, notes, manual stage change, manual email field
- [ ] Dashboard v1: counters (total leads, no-website count, this week's new)
- [ ] Budget warning banner at 90%

**Milestone: can sweep a city/niche and get a sorted list of no-website leads. Cold emails can be sent manually from Gmail using this data.**

## Phase 2 — Analyzer + scoring

- [ ] analyzer-worker: Playwright audit per SPEC §6 checks, scoring math, reasons[] strings
- [ ] PSI API integration (free tier, graceful skip on quota errors)
- [ ] Email scraping (homepage + /kontakt, /contact, /impressum, /o-nama)
- [ ] Analysis section in lead drawer: score breakdown, checks, reasons
- [ ] Weekly cron (Sunday 06:00 CET): re-run weekly sweeps, isNewBusiness flagging, "New business" badge in UI
- [ ] Unit tests (vitest): scoring math, websiteType classifier, copyright-year regex

**Milestone: leads ranked by real opportunity score, outdated-site leads surfaced.**

## Phase 3 — Outreach (AI emails + Gmail)

- [ ] Settings: identity config (business name, address, Cal.com link, signature), tone guide editor
- [ ] ai-worker: email draft generation per SPEC §7 (JSON contract, zod validation, retry once, budget tracking, RS→Serbian rule)
- [ ] Lead drawer: Generate email → editable draft → Send
- [ ] Gmail OAuth flow in Settings, token storage in config/gmail
- [ ] Send via Gmail API with tracking pixel injection
- [ ] px function: log open events, increment opens
- [ ] Reply detection: Gmail watch + Pub/Sub + gmailPushHandler, threadId matching, auto-stage to replied; VPS 30-min polling fallback; cron watch renewal
- [ ] Follow-ups: followUpDue on send (+4 days default), Due follow-ups view on Dashboard
- [ ] Pipeline page: kanban with drag and drop (long-press on mobile)
- [ ] Bulk generate drafts (sequential), daily send soft warning (20/day)
- [ ] Events timeline in lead drawer

**Milestone: full outreach loop inside the app, personalized emails, opens and replies tracked.**

## Phase 4 — Preview generator

- [ ] Build 4 preview templates per DESIGN.md §Preview templates (minimal-light, bold-dark, warm-local, corporate-clean), self-contained HTML with {{slots}}
- [ ] Curate niche image sets into Storage niche-images/ + gradient fallbacks
- [ ] ai-worker: PreviewCopy generation per SPEC §8 contract (language rule applies)
- [ ] preview-worker: render template + copy + business data, upload previews/{slug}.html, generate OG image previews/{slug}-og.png
- [ ] servePreview function + Hosting rewrite /p/**, preview_view events, view counter
- [ ] Branding bar + concept disclaimer + full OG/Twitter meta in all templates
- [ ] Lead drawer preview section: generate (auto template by niche, manual override), open link, regenerate, view count
- [ ] {previewUrl} wired into email generation prompt
- [ ] Dashboard: preview views counter

**Milestone: one click produces a shareable modern one-pager, link goes into the cold email, views tracked.**

## Phase 5 — Polish backlog (only after 1-4)

- [ ] Bulk preview generation for selected leads
- [ ] CSV export of leads
- [ ] Won/Lost stats, reply-rate over time chart
- [ ] PWA manifest so the app installs to Stefan's phone home screen

## Phase 6 — FlowDev portfolio website (separate deliverable, last)

A clean personal portfolio site for Stefan's freelance work (FlowDev brand), the destination behind the "Book a call" CTA on previews and the sender identity in cold emails. Scope stays small and premium.

- [ ] Gather content from Stefan: selected projects (screenshots, links, one-line results), services list, short bio, Cal.com link, contact email
- [ ] Design direction: clean, modern, minimal, fast. Visual language may borrow from the minimal-light preview template but with its own identity. Dark or light decided with Stefan at the time.
- [ ] One-page (or few-section) portfolio: hero, selected work grid with case highlights, services, about, contact/CTA
- [ ] Flawless mobile, Lighthouse ≥ 95, full OG meta
- [ ] Deploy (Firebase Hosting or Stefan's preferred host/domain)
- [ ] Wire the live URL into config/identity so previews and email signatures point to it
