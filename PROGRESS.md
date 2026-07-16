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
