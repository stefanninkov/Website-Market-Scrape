# PLAN.md, Website Market Scrape

Build order. Work top to bottom, phase by phase.

Phases 0 to 5 are the v2 system and are complete except for the items in
"Blocked on Stefan" at the bottom. Phases 7 to 10 are v3 (AGENTS.md and
PREVIEW-SYSTEM.md). Phase 6 (portfolio) stays last. Check tasks off as they're completed and verified running. Each phase ends in a usable state.

## Phase 0: Scaffolding

- [x] Monorepo structure per SPEC §12 (app/, functions/, workers/, shared/)
- [x] Firebase project init: Firestore, Auth (Google, locked to owner email via security rules), Hosting, Storage, Functions
- [x] firestore.rules + storage.rules: owner-only everything, `previews/` publicly readable via servePreview only
- [x] /shared: types.ts from SPEC §4, zod schemas, Firestore helpers, budget.ts guard helpers
- [x] Vite app skeleton: Tailwind v4 setup with DESIGN.md tokens, router, auth gate, app shell (sidebar desktop / bottom nav mobile)
- [x] Workers skeleton: Firestore job-queue listener loop, pm2 ecosystem config, .env.example
- [x] VPS setup notes in README (Node 20, pm2, deploy script)

## Phase 1: Sweeps + Leads (first usable version)

- [x] Places client with budget guard + strict field masks
- [x] sweep-worker: text search per niche, pagination (max 3 pages), dedupe on placeId, Details fetch for new leads, websiteType classification (none/facebook/instagram/real)
- [x] enqueueJob callable function + jobs collection statuses
- [x] Sweeps page: create/edit sweep (country dropdown, region, niche multi-select from config presets + free text), Run now, last run stats
- [x] Leads page: table with filters (country, niche, websiteType, score, stage, isNewBusiness), sort by score, mobile card layout
- [x] Lead drawer v1: details, notes, manual stage change, manual email field
- [x] Dashboard v1: counters (total leads, no-website count, this week's new)
- [x] Budget warning banner at 90%

**Milestone: can sweep a city/niche and get a sorted list of no-website leads. Cold emails can be sent manually from Gmail using this data.**

## Phase 2: Analyzer + scoring

- [x] analyzer-worker: Playwright audit per SPEC §6 checks, scoring math, reasons[] strings
- [x] PSI API integration (free tier, graceful skip on quota errors)
- [x] Email scraping (homepage + /kontakt, /contact, /impressum, /o-nama)
- [x] Analysis section in lead drawer: score breakdown, checks, reasons
- [x] Weekly cron (Sunday 06:00 CET): re-run weekly sweeps, isNewBusiness flagging, "New business" badge in UI
- [x] Unit tests (vitest): scoring math, websiteType classifier, copyright-year regex

**Milestone: leads ranked by real opportunity score, outdated-site leads surfaced.**

## Phase 3: Outreach (AI emails + Gmail)

- [x] Settings: identity config (business name, address, Cal.com link, signature), tone guide editor
- [x] ai-worker: email draft generation per SPEC §7 (JSON contract, zod validation, retry once, budget tracking, RS→Serbian rule)
- [x] Lead drawer: Generate email → editable draft → Send
- [ ] Gmail OAuth flow in Settings, token storage in config/gmail
- [ ] Send via Gmail API with tracking pixel injection
- [x] px function: log open events, increment opens
- [ ] Reply detection: Gmail watch + Pub/Sub + gmailPushHandler, threadId matching, auto-stage to replied; VPS 30-min polling fallback; cron watch renewal
- [x] Follow-ups: followUpDue on send (+4 days default), Due follow-ups view on Dashboard
- [x] Pipeline page: kanban with drag and drop (long-press on mobile)
- [x] Bulk generate drafts (sequential), daily send soft warning (20/day)
- [x] Events timeline in lead drawer

**Milestone: full outreach loop inside the app, personalized emails, opens and replies tracked.**

## Phase 4: Preview generator

- [x] Build 4 preview templates per DESIGN.md §Preview templates (minimal-light, bold-dark, warm-local, corporate-clean), self-contained HTML with {{slots}}
- [ ] Curate niche image sets into Storage niche-images/ + gradient fallbacks
- [x] ai-worker: PreviewCopy generation per SPEC §8 contract (language rule applies)
- [x] preview-worker: render template + copy + business data, upload previews/{slug}.html, generate OG image previews/{slug}-og.png
- [x] servePreview function + Hosting rewrite /p/**, preview_view events, view counter
- [x] Branding bar + concept disclaimer + full OG/Twitter meta in all templates
- [x] Lead drawer preview section: generate (auto template by niche, manual override), open link, regenerate, view count
- [x] {previewUrl} wired into email generation prompt
- [x] Dashboard: preview views counter

**Milestone: one click produces a shareable modern one-pager, link goes into the cold email, views tracked.**

## Phase 5: Polish backlog (only after 1-4)

- [x] Bulk preview generation for selected leads
- [x] CSV export of leads
- [x] Won/Lost stats, reply-rate over time chart
- [x] PWA manifest so the app installs to Stefan's phone home screen

## Phase 6: FlowDev portfolio website (separate deliverable, last)

A clean personal portfolio site for Stefan's freelance work (FlowDev brand), the destination behind the "Book a call" CTA on previews and the sender identity in cold emails. Scope stays small and premium.

- [ ] Gather content from Stefan: selected projects (screenshots, links, one-line results), services list, short bio, Cal.com link, contact email
- [ ] Design direction: clean, modern, minimal, fast. Visual language may borrow from the minimal-light preview template but with its own identity. Dark or light decided with Stefan at the time.
- [ ] One-page (or few-section) portfolio: hero, selected work grid with case highlights, services, about, contact/CTA
- [ ] Flawless mobile, Lighthouse ≥ 95, full OG meta
- [ ] Deploy (Firebase Hosting or Stefan's preferred host/domain)
- [ ] Wire the live URL into config/identity so previews and email signatures point to it


---

# v3

Phase 7 and Phase 8 are independent of each other. 7 changes how the tool feels
to use every day, 8 changes what the leads actually receive. Build 7 first unless
previews are going out this week, in which case swap them.

## Phase 7: Agent foundation + qualifier

Spec: AGENTS.md §1 to §4, §8, §10.

- [x] `workers/src/agent/loop.ts`: bounded tool-use loop (max steps, max tokens, max seconds), zod-validated output, one retry on validation failure, structured `AgentRunResult`
- [x] Tool framework in `workers/src/agent/tools/`: typed schema, model-facing description, cost profile per tool
- [x] Tools: `read_lead`, `fetch_page` (reuses `lib/robots.ts`, blocks private IPs, 10s / 2MB caps), `screenshot_page` (375 and 1440), `places_details`, `web_search`, `run_analyzer`
- [x] `web_search` limits: max 1 call per qualifier run and only for chain or franchise detection, max 3 per researcher run. Results cached per query string for 30 days so repeat sweeps of the same region cost nothing
- [x] Log server-side search calls into `agentRuns/{runId}/steps` like any other tool, so the audit trail stays complete
- [x] `agentRuns/{runId}` + `steps` subcollection, every model turn and tool call logged with 4KB summaries
- [x] Extend `lib/budget.ts` with an `agent` counter, real token usage, per-run / per-day / per-month levels
- [x] `config/agents` doc with the global kill switch, per-agent toggles, per-run caps
- [x] Sixth pm2 process `wms-agent`, concurrency 1, consumes `qualify` jobs
- [x] **A1 Qualifier** per AGENTS.md §4: the six weighted signals, `Qualification` output schema, `insufficient_data` as a first-class verdict, evidence required on every claim
- [x] Auto-enqueue `qualify` after `analyze` when `agents.autoQualifyOnAnalyze` is on
- [ ] Leads page: `fitScore` column and sort, verdict chip (qualified / discard / needs a look), rationale in the drawer, filter by verdict
- [ ] `/agent` page: run feed, step timeline, kill switch, per-agent toggles, cost meter with cost-per-qualified-lead
- [x] Safety rails as code, not prompt: no tool sends email, writes config, or deletes anything (AGENTS.md §10)
- [x] Unit tests: cap enforcement on all three axes, schema rejection of evidence-free claims, kill switch stops new runs within one poll

**Milestone: a 400-lead sweep becomes roughly 40 qualified leads with a readable reason on each, and every run is auditable.**

## Phase 8: Preview system v2

Spec: PREVIEW-SYSTEM.md. Craft rules: WEB-STANDARD.md.

- [ ] `preview/art-directions.ts`: the 10 presets from §3 as complete token blocks, max 2 families and 3 weights each, one accent each
- [ ] `config/previewArtDirection`: weighted niche map, `hash(placeId)` tiebreak, per-lead pin that survives regeneration
- [ ] Section library `preview/sections/`: the 12 section types from §4 with their listed variants, each a pure `(data, tokens, lang) => string`
- [ ] Composer: `CompositionSpec` resolution against available data, sections omitted when required data is missing (never placeholder content)
- [ ] Hero decision logic from §4.1, including `type-led` as a real design. Delete the gradient-behind-headline path entirely
- [ ] Primary module (`book` / `reserve` / `call`) per WEB-STANDARD §10.1: slots from real opening hours, closed days disabled and labelled, no hours means no module, preview submit confirms the selection and states plainly that nothing was sent
- [ ] **Port, do not rewrite.** The booking module and `book`/`reserve`/`call` routing already built in the v1 templates is this item. Move the working logic into the section library as `primaryModule` variants, keep its behaviour, and only restyle it against the art direction tokens. Diff the ported version against the original before deleting the templates
- [ ] Live Places Details call for opening hours at generation time, used in the render and not warehoused (PREVIEW-SYSTEM.md §5.5)
- [ ] Imagery pipeline §5: Pexels first, then Openverse, then generated texture, then no image with a `type-led` hero. No Places photos and no scraping the lead's own site (§5.1). Per-image licence record required or the image is not used
- [ ] Curate 20 to 40 reviewed images per niche into `niche-images/{niche}/` using the rejection criteria in §5.3
- [ ] Image processing: max 1600px, WebP with JPEG fallback, EXIF stripped, 300KB data-URI cap, cached to `niche-images/` and `lead-images/`, deterministic pick by `hash(placeId + sectionIndex)`
- [ ] Extended `PreviewCopy` (§6) with `proofFacts`, optional `faq`, and required `altTexts`
- [ ] Copy validator: reject any digit in rendered copy that is absent from source data, ban unevidenced superlatives
- [ ] `preview/gates.ts`: G1 to G8 and G11 blocking, G9 and G10 warning, run headless on every render before `preview: ready`
- [ ] Migration §8: compose `minimal-light` from sections as the proof, record the honest gate baseline for current v1 output, map `TemplateId` to `ArtDirectionId` keeping old slugs resolvable, then delete `workers/templates/*.html` **only after** every behaviour they carry (including the primary module) exists in the section library and has been diffed
- [ ] Slugs and view counters unchanged across the migration

**Milestone: two leads in the same niche and city receive visibly different pages, with real photography, no placeholder hero, and no page ships that fails a blocking gate.**

## Phase 9: Researcher + outreach agents

Spec: AGENTS.md §5 and §6.

- [ ] Tools: `places_reviews`, `read_research`, `read_config` (read only), `draft_email`, `schedule_followup`
- [ ] **A2 Researcher**: `Research` output schema, evidence required on every pain point, owner name nullable and never guessed, opening hours captured
- [ ] Trigger A2 on `qualified` and `fitScore >= 60`
- [ ] **A3 Outreach drafting**: angle selection (one pain point per email), preview-or-call CTA decision, wraps the existing `ai-email` prompt rather than replacing it
- [ ] **A3 reply classification**: the eight classes and their actions from §6.2, one call each, no loop
- [ ] `suppression/{emailHash}` collection, checked inside `sendEmail` and again by the agent, permanent
- [ ] `agent.locked` on `interested`, blocking every automated action on that lead
- [ ] Approval gate: `sendEmail` stays the only transmitting path, requires a fresh user auth token, and rejects worker or cron callers. No `autoSend` flag exists anywhere in config or code
- [ ] Scheduled follow-ups place an unsent draft in the review queue on their due date, max 2 per lead, never transmit on their own
- [ ] `/agent` review queue: drafts awaiting approval and `insufficient_data` leads, usable one-handed on mobile
- [ ] Tests: suppression blocks a send, `interested` blocks a follow-up draft, `auto_reply` does not clear `followUpDue` or change stage, and a worker-context call to `sendEmail` is rejected

**Milestone: replies are triaged automatically and follow-up drafts arrive in the queue with a fresh angle, while every outbound message still waits for Stefan's tap.**

## Phase 10: Preview agent

Spec: AGENTS.md §7. Requires Phase 8.

- [ ] Tools: `fetch_images`, `render_preview`, `critique_preview` (screenshots at 375 and 1440 returned as image blocks with the H1 to H12 table)
- [ ] **A4** composes the `CompositionSpec` from research rather than picking a template
- [ ] Critique loop: max 2 revisions, the four questions from §7.1 asked verbatim, a "no" on Q2 or a "yes" on Q3 forces a revision
- [ ] Trigger conditions from §7: `interested` or `question` reply, 2+ opens, or `fitScore >= 85` in a high-value niche. Manual generation always allowed with no conditions
- [ ] Remaining gate failures logged on the preview doc when the revision budget is spent, never silently shipped
- [ ] Deterministic render path kept as a fallback via `agentic: false`

**Milestone: previews are generated only when they are warranted, and each one has been critiqued against the standard before it reaches a lead.**

---

## Blocked on Stefan (carried from PROGRESS.md)

Not build work, but nothing runs live until these exist:

- [x] Firebase project (Blaze, EU region), `.firebaserc`, `app/.env` (live)
- [x] Places API (New) key and PageSpeed Insights key (live)
- [x] Anthropic API key (live)
- [x] Phase 0 "Firebase project init" (closed, the project is live)
- [ ] Gmail OAuth client, `gcloud pubsub topics create gmail-replies`, then live-verify the three Phase 3 Gmail tasks
- [ ] Hetzner CX22 provisioned per README, workers running under pm2
- [ ] Pexels API key (Phase 8)

Note: the old "curate niche image sets" task is closed rather than done. Phase 8
replaces manual curation with the API pipeline.
