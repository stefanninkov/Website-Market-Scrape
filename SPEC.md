# Website Market Scrape — Master Specification (v2)

Personal lead generation app for Ninkov FlowDev. Finds European businesses with no website or an outdated one, scores them, generates AI-personalized cold emails and one-page website previews, and manages outreach from a single dashboard.

Owner: Stefan Ninkov (single user, Google sign-in locked to owner email)
Repo: Website-Market-Scrape

Companion docs: PLAN.md (build order), DESIGN.md (UI + preview templates), CLAUDE.md (working rules), PROGRESS.md (living log).

Brand name used in all client-facing surfaces (previews, branding bar, OG marks, email signature): **FlowDev**. A separate FlowDev portfolio website is the final deliverable (PLAN.md Phase 6), built only after the app is complete.

---

## 1. High-level architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: React 19 + Vite + TypeScript + Tailwind v4    │
│  Firebase Hosting. Fully mobile responsive.               │
└──────────────┬───────────────────────────────────────────┘
               │ Firestore SDK + callable functions
┌──────────────▼───────────────────────────────────────────┐
│  Firebase                                                 │
│  - Firestore (all data), Auth, Storage (preview HTML,     │
│    OG images, niche image sets)                            │
│  - Cloud Functions (lightweight only):                     │
│      • px — tracking pixel, logs open events               │
│      • gmailPushHandler — reply detection                  │
│      • enqueueJob — writes job doc                         │
│      • servePreview — Hosting rewrite /p/{slug} →          │
│        streams HTML from Storage                           │
└──────────────┬───────────────────────────────────────────┘
               │ Firestore as job queue (jobs collection)
┌──────────────▼───────────────────────────────────────────┐
│  VPS (Hetzner CX22, Ubuntu, Node 20, pm2)                 │
│  - sweep-worker: Google Places queries, dedupe, upsert     │
│  - analyzer-worker: Playwright site audits, scoring        │
│  - ai-worker: Claude API for email drafts + preview copy   │
│  - preview-worker: renders template + copy → Storage       │
│  - cron: weekly sweeps re-run, Gmail watch renewal         │
└───────────────────────────────────────────────────────────┘
```

Why VPS for workers: Playwright is heavy and unreliable on Cloud Functions. Firestore acts as the queue, workers poll `jobs` with a listener. ai-worker and preview-worker are light and could live in Functions later, but keeping all workers in one place simplifies Phase 1-4.

## 2. External APIs

| API | Purpose | Cost notes |
|---|---|---|
| Google Places API (Text Search + Place Details) | Business discovery | ~$32/1k Text Search, ~$17/1k Details, ~$200/mo free credit. Hard budget guard required. |
| Google PageSpeed Insights API | Performance score | Free, 25k/day |
| Gmail API | Send outreach, detect replies | Free. OAuth, scopes: gmail.send, gmail.readonly, gmail.modify |
| Anthropic API (claude-sonnet-4-6) | Email drafts + preview copy | Pennies per generation. Budget guard shared pattern. |

### Budget guards
- `config/apiBudget`: `{ places: {monthlyLimitUsd, spentUsd}, anthropic: {monthlyLimitUsd, spentUsd}, resetAt }`
- Every metered call increments its counter by known unit price (Anthropic: estimate from token usage in response).
- Workers refuse jobs at 90% of a limit, mark job `blocked_budget`, UI shows warning banner.

## 3. Language rules (global)

- App UI: English only.
- Generated emails and previews: **Serbian (latinica) when lead country == RS, English for everything else.** No German or other translations.
- Tone: professional but warm, never corporate-stiff. A tone guide doc (editable in Settings, stored in `config/toneGuide`) is injected into every generation prompt.

## 4. Data model (Firestore)

### `leads/{placeId}` (doc ID = Google place_id, free dedupe)
```ts
{
  placeId: string,
  name: string,
  category: string,
  country: string,              // ISO 3166-1 alpha-2
  region: string,
  address: string,
  phone: string | null,
  websiteUrl: string | null,
  websiteType: 'none' | 'facebook' | 'instagram' | 'real' | 'unknown',
  rating: number | null,
  reviewCount: number | null,
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp,
  isNewBusiness: boolean,
  analysis: {
    status: 'pending' | 'done' | 'failed' | 'skipped',
    score: number,              // 0-100
    checks: {
      https: boolean,
      responsive: boolean,
      viewportMeta: boolean,
      copyrightYear: number | null,
      techStack: string[],
      pagespeedMobile: number | null,
      sslValid: boolean,
      lastModifiedHeader: string | null,
    },
    reasons: string[],          // plain-English findings, feed email + preview copy
    analyzedAt: Timestamp,
  } | null,
  stage: 'new' | 'qualified' | 'contacted' | 'replied' | 'won' | 'lost' | 'ignored',
  notes: string,
  email: string | null,
  emailSource: 'places' | 'site_scrape' | 'manual' | null,
  outreach: {
    threadId: string | null,
    lastSentAt: Timestamp | null,
    opens: number,
    lastOpenAt: Timestamp | null,
    replied: boolean,
    followUpDue: Timestamp | null,
    draft: { subject: string, body: string, generatedAt: Timestamp } | null,
  },
  preview: {
    status: 'none' | 'generating' | 'ready' | 'failed',
    slug: string | null,        // /p/{slug}
    url: string | null,
    templateId: string | null,  // which variant
    copy: PreviewCopy | null,   // see §8
    generatedAt: Timestamp | null,
    views: number,              // logged by servePreview
    lastViewAt: Timestamp | null,
  }
}
```

### `sweeps/{sweepId}`
```ts
{
  name: string,
  country: string,
  region: string,
  niches: string[],
  schedule: 'weekly' | 'manual',
  lastRunAt: Timestamp | null,
  stats: { totalFound: number, noWebsite: number, newLastRun: number }
}
```

### `jobs/{jobId}`
```ts
{
  type: 'sweep' | 'analyze' | 'generate_email' | 'generate_preview',
  payload: { sweepId?: string, placeId?: string, templateId?: string },
  status: 'queued' | 'running' | 'done' | 'failed' | 'blocked_budget',
  createdAt, startedAt, finishedAt, error: string | null
}
```

### `events/{eventId}` (append-only)
```ts
{ leadId, type: 'open' | 'reply' | 'sent' | 'bounce' | 'preview_view', at: Timestamp, meta: {} }
```

### `config/*`
- `apiBudget` (see §2)
- `toneGuide`: `{ text: string }` (markdown, editable in Settings)
- `niches`: `{ presets: string[] }`
- `gmail`: OAuth tokens (owner-only rules)
- `identity`: `{ businessName, fullName, address, calLink, emailSignature }` used in emails and preview branding bar

## 5. Sweep worker

1. Listens for queued `sweep` jobs.
2. Per niche: Places Text Search `"{niche} in {region}, {country}"`, max 3 pages (60 results) per query.
3. New placeIds get Place Details (strict field mask: name, formatted_address, formatted_phone_number, website, rating, user_ratings_total).
4. Classify `websiteType`:
   - empty → `none`, score 100, analysis.status `skipped`
   - facebook.com/fb.com → `facebook`, score 95
   - instagram.com → `instagram`, score 95
   - else → `real`, enqueue `analyze` job
5. Existing leads: bump `lastSeenAt` only.
6. Scheduled re-runs: brand-new placeIds get `isNewBusiness: true` (UI badge "New business", hot leads).
7. Cron: Sunday 06:00 CET enqueues all `schedule == 'weekly'` sweeps.

## 6. Analyzer worker (Playwright)

Visit `websiteUrl` at 375px and desktop viewports:

| Check | Signal | Points |
|---|---|---|
| No HTTPS / invalid SSL | protocol, cert error | +25 |
| No viewport meta | DOM | +15 |
| Horizontal overflow at 375px | scrollWidth > innerWidth | +15 |
| Copyright year ≤ currentYear − 3 | footer regex | +10 |
| Old tech fingerprint | wp theme paths, generator meta, jQuery <2, table layout, Flash, free-tier Wix/Weebly/Jimdo | +10 each, cap +20 |
| PageSpeed mobile < 40 | PSI | +15 |
| PageSpeed mobile 40-60 | PSI | +8 |
| Unreachable / parked domain | timeout, registrar page | +30 |

Cap 100. Each triggered check appends a plain-English string to `reasons`.

Email scraping: `mailto:` and visible emails on homepage + /kontakt, /contact, /impressum, /o-nama. Politeness: 1 browser, 2s between sites, 20s timeout, honest UA.

## 7. AI email generation (replaces static templates)

- Per-lead button **Generate email** (and bulk "generate drafts" for selected leads, sequential to respect budget).
- ai-worker builds prompt from: lead data, `analysis.reasons`, `preview.url` if ready, `config/toneGuide`, `config/identity`.
- Output contract: strict JSON `{ subject: string, body: string }`. Body plain text, under 120 words, one CTA, includes opt-out line and identity/postal address per compliance, no placeholders left unfilled.
- Language: Serbian (latinica) if `country == 'RS'`, else English.
- Saved to `outreach.draft`, always shown as an editable draft. Stefan approves and sends manually, never auto-send.
- Regenerate button allowed, with optional freetext steering ("mention their Facebook page", "more casual").

### Sending (Gmail)
- OAuth once in Settings, tokens in `config/gmail`.
- Send inserts tracking pixel `https://.../px?l={leadId}`.
- `px` logs `open` event, increments `outreach.opens`. Apple Mail proxy caveat: opens are a weak signal.
- Reply detection: Gmail `users.watch` → Pub/Sub → `gmailPushHandler`, match threadId, set `replied`, stage → `replied`. Fallback: VPS polls threads every 30 min. Cron renews watch (expires every 7 days).
- Follow-up: `followUpDue` (+4 days default), "Due follow-ups" view. Soft warning above 20 sends/day.

## 8. Preview generator (one-page website mockups)

Goal: one click generates a modern, clean one-page site preview for a lead, hosted at `https://{app-domain}/p/{slug}`, sendable as a link in the cold email.

### Approach: hand-built templates + AI copy
- 4 template variants built once, single self-contained HTML files with inlined Tailwind-generated CSS and `{{slots}}`. See DESIGN.md §Preview templates for full visual specs:
  1. `minimal-light` (default: professional services)
  2. `bold-dark` (gyms, auto, trades)
  3. `warm-local` (restaurants, cafes, salons)
  4. `corporate-clean` (lawyers, clinics, accountants)
- Template auto-picked by niche mapping, manual override + regenerate in UI.

### PreviewCopy contract (Claude API, strict JSON)
```ts
{
  headline: string,          // ≤8 words
  subheadline: string,       // ≤20 words
  about: string,             // 50-80 words
  services: { title: string, blurb: string }[],  // 3-6, blurb ≤15 words
  ctaLabel: string,          // e.g. "Pozovite nas" / "Get in touch"
  metaDescription: string,
}
```
Language rule from §3 applies. Prompt includes business name, niche, city, rating/reviewCount, and analysis reasons (so copy can subtly address weaknesses, never insultingly).

### Rendering + hosting
- preview-worker injects copy + business data (name, phone, address, rating stars) into the template, writes final HTML to Storage at `previews/{slug}.html`, generates a simple OG image (1200x630, business name + niche on branded background, via `@vercel/og`-style satori or node-canvas) to `previews/{slug}-og.png`.
- Hosting rewrite `/p/**` → `servePreview` function streams from Storage, logs `preview_view` event, increments `preview.views`. View counts show in the lead drawer (a viewed preview is a warm lead).
- Slug: short random, e.g. `frizerski-salon-ana-x7k2`.

### Images
- NEVER use Google Places photos (ToS prohibits reuse outside Places display).
- Curated stock image sets per niche stored in Storage `niche-images/{niche}/`, picked deterministically per lead. Gradient/pattern fallback when a niche has no set.

### Sales layer
- Fixed bottom branding bar on every preview: "Concept by FlowDev" + "Book a call" CTA button (Cal.com link from `config/identity`). Branding bar is always English, even on Serbian previews.
- Full OG/Twitter meta so links unfurl nicely in Gmail, Viber, WhatsApp.
- `{previewUrl}` automatically available to the email generator.
- Disclaimer line in footer: concept mockup, not the business's official site.

## 9. Frontend pages (all mobile responsive, see DESIGN.md)

1. **Dashboard**: counters (new leads this week, no-website count, due follow-ups, reply rate, preview views), activity feed from `events`.
2. **Sweeps**: saved sweeps list, create/edit (country dropdown, region text, niche multi-select from presets + free text), Run now, per-sweep stats.
3. **Leads**: filterable table (country, niche, websiteType, score range, stage, isNewBusiness), sort by score. Lead drawer: analysis breakdown, reasons, notes, email draft (generate/edit/send), preview section (generate, open, views), event timeline. Bulk: ignore, stage move, generate drafts.
4. **Pipeline**: kanban New → Qualified → Contacted → Replied → Won/Lost, drag and drop (long-press drag on mobile).
5. **Settings**: Gmail connect, budgets, cron toggle, niche presets, tone guide editor, identity (business info, Cal.com link, signature).

## 10. Niche presets (extendable in Settings)

Trades: fencing, construction, roofing, electricians, plumbers, auto repair, car detailing, landscaping
Hospitality: restaurants, cafes, bakeries, hair salons, beauty salons, barbershops, gyms, hotels, guesthouses
Professional: dentists, physiotherapists, lawyers, accountants, notaries, veterinary clinics, private clinics
Other: real estate agencies, driving schools, wedding services, photographers, cleaning services

## 11. Compliance

- B2B cold email to publicly listed addresses: real identity, real postal address, clear opt-out line in every email (email generator enforces this).
- `ignored` stage is permanent, never resurface or email.
- Only publicly listed business data stored.
- Analyzer respects robots.txt beyond homepage; homepage fetch is a normal browser visit.
- Previews carry a "concept mockup" disclaimer and use zero content scraped from the business's existing site.

## 12. Repo layout

```
Website-Market-Scrape/
├── app/                    # React 19 + Vite + TS + Tailwind v4
├── functions/              # px, gmailPushHandler, enqueueJob, servePreview
├── workers/                # VPS: sweep, analyze, ai, preview, cron
│   ├── src/sweep.ts
│   ├── src/analyze.ts
│   ├── src/ai.ts
│   ├── src/preview.ts
│   ├── src/cron.ts
│   ├── templates/          # 4 preview template HTML files
│   └── ecosystem.config.js # pm2
├── shared/                 # types, Firestore helpers, zod schemas
├── firestore.rules
├── storage.rules
├── CLAUDE.md  PLAN.md  DESIGN.md  PROGRESS.md  SPEC.md
```

## 13. Environment variables

```
# workers/.env
GOOGLE_PLACES_API_KEY=
PAGESPEED_API_KEY=
ANTHROPIC_API_KEY=
FIREBASE_SERVICE_ACCOUNT_PATH=
APP_BASE_URL=              # for preview URLs
# functions config
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
PUBSUB_TOPIC=gmail-replies
```
