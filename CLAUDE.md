# CLAUDE.md — Website Market Scrape

Working rules for Claude Code in this repo. Read this first, every session.

## Project

Personal lead generation app for Stefan (Ninkov FlowDev). Single user. Finds European businesses with no/outdated websites, scores them, generates AI-personalized cold emails and one-page preview sites, manages outreach.

Source of truth documents, in priority order:
1. **SPEC.md** — what to build (architecture, data model, features). Never contradict it. If something is ambiguous or seems wrong, ask Stefan before improvising.
2. **PLAN.md** — build order. Work strictly phase by phase, top to bottom. Do not start a later phase task while an earlier phase task is unchecked, unless Stefan says so.
3. **DESIGN.md** — all UI and preview template decisions. Do not invent visual styles.
4. **PROGRESS.md** — living log. Update it every session (see Workflow).

## Workflow

1. At session start: read PROGRESS.md (last entry) and PLAN.md (next unchecked tasks).
2. Announce the plan for the session in one short list, then build.
3. After completing a task: check it off in PLAN.md.
4. At session end (or after any significant milestone): append an entry to PROGRESS.md using its template. Include decisions made, deviations from SPEC (with reason), and known issues.
5. Never mark a task done if it doesn't run. "Compiles" is not "done". Done = runs locally and does the thing.
6. Commit style: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), small and frequent, message describes the change not the file.

## Stack rules

- **Frontend**: React 19 functional components, Vite, TypeScript strict mode, Tailwind v4 (CSS-first config via `@theme` in index.css, no tailwind.config.js unless unavoidable). React Router. TanStack Query optional, plain Firestore listeners are fine.
- **State**: Firestore realtime listeners as the source of truth. No Redux/Zustand unless a concrete need appears.
- **Workers**: Node 20, TypeScript, tsx for dev, compiled for pm2 in prod. One process per worker as defined in SPEC §1.
- **Shared code**: all Firestore access through typed helpers in `/shared`. All external data (Places responses, Claude JSON outputs, scraped values) validated with zod before touching Firestore. Never write unvalidated external data.
- **Types**: single source of types in `/shared/types.ts`, imported by app, functions, and workers. No duplicated interfaces.

## Coding conventions

- Always provide complete files when writing or rewriting code, never partial snippets.
- Error handling on every external call (Places, PSI, Gmail, Anthropic, Playwright navigation). Failures write `status: 'failed'` + `error` on the job doc, never crash the worker loop.
- All secrets from env vars, `.env` in .gitignore, `.env.example` kept current.
- No `any`. Prefer discriminated unions matching the Firestore model in SPEC §4.
- Comments only where logic is non-obvious (scoring math, Gmail watch renewal, ToS-related choices).
- Playwright: 1 concurrent browser, 2s delay between sites, 20s timeout, honest UA. Never bypass robots.txt beyond the homepage visit.

## AI generation rules (ai-worker)

- Model: `claude-sonnet-4-6` via Anthropic API.
- Always request strict JSON output, parse defensively (strip code fences, try/catch, zod-validate against the contract in SPEC §7/§8). On invalid JSON: one retry with a "return only valid JSON" reminder, then fail the job.
- Emails: ≤120 words, one CTA, must include identity + postal address + opt-out line from `config/identity`. Serbian (latinica) when lead country is RS, English otherwise. Never send automatically, output is always a draft.
- Track token usage from API responses into the Anthropic budget counter.

## UI rules

- Mobile responsive is not optional. Every page must work at 375px. Tables collapse to cards on mobile per DESIGN.md. Test both breakpoints before checking off any UI task.
- Dark theme only, tokens from DESIGN.md. No new colors outside the palette.
- Internal tool density: prefer tables, compact spacing, keyboard-friendly on desktop.

## Cost discipline

- Every Places and Anthropic call goes through the budget guard helpers in `/shared/budget.ts`. Never call these APIs directly without it.
- Places Details: strict field masks only (SPEC §5).
- Never re-query a placeId that exists in `leads`.

## What NOT to do

- No auto-sending of emails, ever.
- No Google Places photos in previews (ToS).
- No scraping content from a lead's existing website into their preview.
- No new npm dependencies without a one-line justification in the PROGRESS.md entry.
- No feature invention. If it's not in SPEC.md, propose it to Stefan first.
