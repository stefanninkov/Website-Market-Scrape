# CLAUDE.md, Website Market Scrape

Working rules for Claude Code in this repo. Read this first, every session.

## Project

Personal lead generation app for Stefan (Ninkov FlowDev). Single user. Finds European businesses with no/outdated websites, scores them, generates AI-personalized cold emails and one-page preview sites, manages outreach.

Source of truth documents, in priority order:
1. **SPEC.md**, what to build (architecture, data model, features). Never contradict it. If something is ambiguous or seems wrong, ask Stefan before improvising.
2. **PLAN.md**, build order. Work strictly phase by phase, top to bottom. Do not start a later phase task while an earlier phase task is unchecked, unless Stefan says so.
3. **AGENTS.md**, the agent layer. Authoritative over SPEC.md for anything an agent does: loop, tools, budgets, safety rails, verdict schemas.
4. **PREVIEW-SYSTEM.md**, how a `/p/{slug}` page is composed, styled and filled. Authoritative over SPEC §8 and DESIGN.md Part 2.
5. **WEB-STANDARD.md**, the craft standard for every website we build (previews, portfolio, client work). Authoritative over DESIGN.md for websites; DESIGN.md still rules the internal app UI.
6. **DESIGN.md**, internal app UI. Do not invent visual styles.
7. **PROGRESS.md**, living log. Update it every session (see Workflow).

Quick precedence check when two docs disagree: agent behaviour goes to AGENTS.md,
anything rendered at `/p/` goes to PREVIEW-SYSTEM.md then WEB-STANDARD.md, the
internal app goes to DESIGN.md, everything else goes to SPEC.md.

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

## Agent rules (agent-worker)

- Every agent run is bounded on all three axes at once: max steps, max tokens, max wall clock. Whichever trips first ends the run with `status: 'capped'`. A run must never end by throwing.
- Output is zod-validated against the agent's schema. One retry with the validation errors appended, then fail. Same discipline as email generation.
- Write results in a single transaction at the end of a run. A capped or failed run must leave lead state untouched.
- Log every model turn and tool call to `agentRuns/{runId}/steps` with 4KB summaries. An agent you cannot read is an agent you cannot tune.
- Confidence and rationale are required on every agent output. `insufficient_data` is a first-class answer and is always preferable to a confident guess.
- Any claim an agent makes carries an evidence string (url, screenshot path, or measured value). Enforce it in the schema, not the prompt.
- Safety rails live in code: no tool sends email, writes to `config/*`, deletes anything, or caches Places content beyond the place ID. Do not rely on the prompt to hold these.
- `agent.locked === true` blocks every automated action on that lead. Check it before enqueuing, not only before acting.
- Agents draft and schedule. They never transmit. If a tool's implementation would put bytes on a wire toward a lead, it is the wrong tool.
- Do not agentify deterministic I/O. If a step does not need a goal, a tool loop, and a self-assessed output, it stays a plain worker function.

## Preview rules (v2)

- A page is a `CompositionSpec` resolved against available data, not a filled template. Rendering is pure: same spec plus same data always produces the same bytes.
- A section never renders with placeholder content. Missing required data means the section is not in the spec.
- A gradient behind a headline is not a hero. Use `type-led` when there is no usable image.
- Blocking gates G1 to G8 and G11 (PREVIEW-SYSTEM.md §7) run on every render before `preview: ready`, whether or not the agent is enabled. A page that fails one does not ship.
- Nothing on a generated page states a fact absent from the source data. The copy validator rejects digits that do not appear in the data.
- Slugs and view counters never change across regeneration. Links already sent must keep working and keep looking the same.

## Cost discipline

- Every Places and Anthropic call goes through the budget guard helpers in `/shared/budget.ts`. Never call these APIs directly without it.
- Places Details: strict field masks only (SPEC §5).
- Never re-query a placeId that exists in `leads`.

## What NOT to do

- **No automated outbound, ever, by anything.** No auto-sent first emails, follow-ups, or replies. No SMS, form submissions, or social messages. Every outbound message needs Stefan's explicit per-message approval in the app. A scheduled follow-up means a draft appears in the review queue, not that an email goes out.
- `sendEmail` is the only transmitting code path. It requires a fresh user auth token, so a worker or cron calling it fails loudly. Never add a service-account path around it, and never add an `autoSend` flag of any kind. If a task seems to require one, stop and ask Stefan.
- No Google Places photos in previews (ToS).
- No scraping content from a lead's existing website into their preview.
- No new npm dependencies without a one-line justification in the PROGRESS.md entry.
- No contacting a suppressed address or a lead locked after an `interested` reply. Checked inside `sendEmail`, not only in the agent.
- No feature invention. If it's not in SPEC.md, AGENTS.md, or PREVIEW-SYSTEM.md, propose it to Stefan first.
