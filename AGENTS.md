# AGENTS.md, the agent layer for Website Market Scrape

Authoritative for everything agentic. Where this conflicts with SPEC.md, this
file wins for agent behaviour. SPEC.md stays authoritative for the deterministic
pipeline (sweep, analyze, render, send). WEB-STANDARD.md wins for anything the
agent produces that is a website. PREVIEW-SYSTEM.md wins for preview composition.

---

## 0. Why this exists

v2 shipped a **pipeline**: sweep, analyze, generate, send, each step triggered by
Stefan and each step a fixed function. The AI was used as a text generator, not
as a decision maker.

The problem that creates in practice: a sweep of one city and three niches
returns 400 leads, the analyzer scores them mechanically (copyright year, viewport
tag, PSI number), and Stefan still has to open dozens of them to find out which
are worth an email. Volume without judgement. The bottleneck moved from finding
businesses to triaging them.

v3 adds four agents on top of the existing pipeline. Nothing built in Phases 0 to
5 is thrown away. The agents call the existing workers as tools.

**Non-goal:** replacing Stefan's judgement on sending. **Nothing leaves this
system without his explicit per-message approval.** Not a first email, not a
follow-up, not a reply. The agents remove the reading work, never the decision.
There is no configuration flag that changes this, because a flag is a thing you
can flip at 1am and regret at 9am.

---

## 1. What makes these agents and not more pipeline

Three properties, all required:

1. **Goal, not instruction.** The qualifier is given "decide whether this lead is
   worth Stefan's time", not "check the copyright year".
2. **Tools and a loop.** It chooses which tool to call next based on what it just
   learned, and it can stop early when it has enough.
3. **Self-assessed output.** It returns a verdict with a confidence and a written
   rationale that a human can audit, and it can say "not enough information"
   instead of guessing.

If a step does not need all three, it stays a plain worker function. Do not
agentify the sweep. Fetching pages from Google Places is deterministic I/O and an
agent there is pure cost.

---

## 2. Architecture

```
                    Firestore (state, queue, audit log)
                              ▲
                              │
  ┌───────────────────────────┴────────────────────────────┐
  │  agent-worker (VPS, pm2, 6th process)                  │
  │                                                        │
  │   runAgent(agentId, leadId, budget)                    │
  │     └─ bounded tool-use loop, Anthropic API            │
  │          tools ──▶ existing workers + new primitives   │
  └────────────────────────────────────────────────────────┘
              │            │            │            │
        A1 Qualifier  A2 Research  A3 Outreach  A4 Preview
```

- One new pm2 process: `wms-agent`. It consumes jobs of type `agent_run` from the
  existing Firestore queue, so no new queue mechanism.
- Concurrency 1 by default on a CX22. Playwright is already competing for RAM
  with the analyzer and preview workers. Raise only after measuring.
- The loop is bounded on three axes at once: max steps, max tokens, wall clock.
  Whichever trips first ends the run with `status: 'capped'`, never an exception.

### 2.1 The loop contract

```ts
interface AgentRunResult<T> {
  status: 'done' | 'capped' | 'failed' | 'blocked_budget' | 'aborted';
  output: T | null;          // zod-validated against the agent's output schema
  confidence: number;        // 0-1, self-reported, calibrated by the prompt
  rationale: string;         // 2-4 sentences, human readable, always present
  steps: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}
```

Rules:

- Output is always zod-validated. On validation failure, retry once with the
  errors appended to the message, then fail the run. Same discipline as the
  existing `lib/parse.ts` and email generation.
- A `failed` or `capped` run never corrupts lead state. Write results in one
  transaction at the end, not incrementally as the agent thinks.
- Every step (model message, tool call, tool result summary) is appended to
  `agentRuns/{runId}/steps`. Truncate tool results to 4KB in the log. The full
  artefact goes to Storage if it matters (screenshots, HTML).

---

## 3. Tool catalogue

Tools are typed functions in `workers/src/agent/tools/`. Each has a zod input
schema, a description written for the model, and a hard cost profile.

| Tool | Used by | Notes |
|---|---|---|
| `read_lead` | all | Lead doc plus analysis. Free. |
| `fetch_page(url)` | A1, A2 | Reuses `lib/robots.ts`. Honours robots.txt, blocks private IP ranges, 10s timeout, 2MB cap, returns extracted text plus meta. |
| `screenshot_page(url, viewport)` | A1, A2, A4 | Playwright. Returns a Storage path and passes the image to the model as an image block. 375 and 1440 only. |
| `places_details(placeId, fields)` | A1, A2 | Budget-guarded, strict field mask, same client as the sweep worker. |
| `places_reviews(placeId)` | A2 | Up to 5 reviews. Text plus rating plus relative time. |
| `web_search(query)` | A1, A2 | Capped at 3 calls per run. For owner name, company registry, chain detection. |
| `run_analyzer(placeId)` | A1 | Enqueues the existing analyze job and waits, max 90s. |
| `read_research(leadId)` | A3, A4 | Output of A2. |
| `read_config(key)` | A3 | `identity`, `toneGuide`, `niches` only. Read only, never write. |
| `draft_email(...)` | A3 | Writes `outreach.draft`. Never sends. |
| `queue_followup(leadId, at, angle)` | A3 | Sets `followUpDue` and prepares an unsent draft for the approval queue. Sends nothing. |
| `render_preview(spec)` | A4 | PREVIEW-SYSTEM.md composition spec in, HTML out. |
| `critique_preview(slug)` | A4 | Screenshots at 375 and 1440, returns them plus the WEB-STANDARD hard-rule checklist for the model to judge against. |
| `fetch_images(niche, count)` | A4 | Curated licensed sets only. No Places photos, no scraping the lead's site. PREVIEW-SYSTEM.md §5. |

**No tool sends email. No tool writes to `config/*`. No tool deletes anything.**
That is enforced in code, not in the prompt.

One more code-enforced rule: no tool caches or stores Google Places content
beyond the place ID. Hours and details used at render time are fetched live and
discarded. Places photos are not available to any agent. PREVIEW-SYSTEM.md §5.1
has the reasoning.

---

## 4. A1, Qualifier

**Trigger:** automatically after `analyze` completes, if `agents.qualifier` is on.
**Budget:** 20 steps, 60k tokens, 90s wall clock. Target cost under 2 cents a lead.

**Goal given to the model:** decide whether this business is worth a personalised
cold email from a one-person web studio, and say why.

**What it weighs** (the prompt names these explicitly, in this order):

1. **Alive.** Reviews in the last 6 months, hours published, recent photos. A
   business with 4 reviews and nothing since 2021 is dead. Discard.
2. **Reachable.** Is there an email, a contact form, or a named owner? No route
   to a human is a discard regardless of how bad the site is.
3. **Actually bad.** The analyzer score is mechanical. The agent takes a 375px
   screenshot and judges it as a visitor would. A site that scores 72 on checks
   but looks fine and works on a phone is not a prospect. A site that scores 45
   but is a well-maintained Wix is a weak prospect. Trust the screenshot over the
   score when they disagree, and say so in the rationale.
4. **Can pay.** Proxies only, no invention: review volume, price level, niche
   norms, multiple locations, staff or team mentions, published price lists.
   A 3-person salon in a village is a different conversation than a 12-chair
   salon in Novi Sad.
5. **Buys from a freelancer.** Chains, franchises, and anything with a corporate
   parent are discards. They have a procurement process, not a decision maker.
6. **Not already covered.** Recently rebuilt site (copyright year current, modern
   stack detected) means someone already got this job.

**Output:**

```ts
interface Qualification {
  verdict: 'qualified' | 'discard' | 'insufficient_data';
  fitScore: number;              // 0-100, how good a prospect, not how bad the site
  confidence: number;            // 0-1
  rationale: string;             // 2-4 sentences, plain language
  signals: {
    alive: boolean;
    reachable: boolean;
    siteVerdict: 'none' | 'broken' | 'dated' | 'adequate' | 'good';
    sizeProxy: 'micro' | 'small' | 'medium' | 'unknown';
    isChain: boolean;
  };
  disqualifiers: string[];       // empty when qualified
  evidence: Array<{ claim: string; source: string }>;  // url, screenshot path, or "places:reviews"
}
```

**Hard rules:**

- `insufficient_data` is a legitimate and encouraged answer. It is better than a
  confident guess. Those leads land in a "needs a look" bucket for Stefan.
- Every entry in `evidence` needs a real source string. A claim with no source is
  a validation failure, not a warning.
- `fitScore` measures prospect quality. The existing `analysis.score` measures
  site badness. They are different numbers and both stay. Leads page sorts on
  `fitScore` once qualification exists, falls back to `score` otherwise.

**Expected effect:** a 400-lead sweep becomes roughly 40 qualified, 30 needs-a-look,
330 discarded, with a readable reason on every one. This is the single highest
value agent in the system. Build it first.

---

## 5. A2, Researcher

**Trigger:** on `verdict === 'qualified'` and `fitScore >= 60`.
**Budget:** 25 steps, 100k tokens, 150s. Target cost under 5 cents a lead.

**Goal:** collect specific, evidenced material that makes a cold email sound like
a person looked at their business, and give the preview agent real content to
work with.

**Output:**

```ts
interface Research {
  ownerName: string | null;
  ownerSource: string | null;      // where it was found, or null
  summary: string;                 // 40-60 words, what this business actually does
  services: string[];              // observed, never assumed
  differentiators: string[];       // "only certified BMW specialist in the area"
  painPoints: Array<{
    claim: string;                 // "the site is unusable on a phone"
    evidence: string;              // screenshot path, measured value, or url
    severity: 'high' | 'medium' | 'low';
  }>;
  reviewThemes: { praised: string[]; complained: string[] };
  socials: Array<{ platform: string; url: string; lastActiveAt: string | null }>;
  openingHours: Record<string, string> | null;
  competitorNote: string | null;   // one sentence, only if a competitor has a clearly better site
}
```

**Hard rules:**

- **No evidence, no claim.** This is the same rule as WEB-STANDARD H11 and it is
  enforced by schema. `painPoints[].evidence` is required and non-empty.
- Owner name is nullable and stays null unless found on the site, a registry, or
  a review response. Guessing a name and getting it wrong kills the email.
- `openingHours` must be fetched here (add to the Places field mask). The preview
  system needs it for the booking module and cannot invent it.
- Never scrape LinkedIn or anything behind a login. Public web only, robots.txt
  honoured.

---

## 6. A3, Outreach

**Trigger:** manual per lead, bulk from the Leads page, or automatic on a
scheduled follow-up. Also runs on every inbound reply.

**Budget:** 12 steps, 40k tokens for a draft. Reply classification is a single
call, no loop.

### 6.1 Drafting

Decides, rather than being told:

- **Angle.** Which one pain point leads the email. Highest severity that is also
  easy to say in a sentence. Never more than one problem per email.
- **Language.** RS to Serbian latinica, everyone else English. Unchanged rule.
- **Preview or call.** If a preview is ready, the link is the CTA. If not, a call
  is the CTA. Never both.
- **Length.** Under 120 words, one CTA. Unchanged.

The existing prompt in `handlers/ai-email.ts` stays as the writing instruction.
The agent wraps it with the angle decision and the research context.

### 6.2 Reply handling

Every inbound reply is classified in one call:

| Class | Action |
|---|---|
| `interested` | Stage to `replied`, notify Stefan, **stop all automation on this lead permanently**, draft nothing. |
| `question` | Stage to `replied`, notify, draft a suggested answer for Stefan to approve. |
| `not_now` | Stage stays `contacted`, queue one re-touch draft at +4 months with a different angle, note the reason. Draft waits for approval like everything else. |
| `not_interested` | Stage to `lost`. No further contact ever. |
| `unsubscribe` | Stage to `lost`, add to `suppression/{emailHash}`, permanent, checked before every send. |
| `wrong_person` | Draft one reply asking for the right contact, for approval. If no answer after it is sent, `lost`. |
| `auto_reply` | Ignore, do not count as a reply, do not change stage, do not clear `followUpDue`. |
| `bounce` | Mark email invalid, stage to `lost`, do not retry. |

**Hard rules:**

- **Human approval on every single outbound message.** First emails, follow-ups,
  and replies alike. The agent drafts, the app shows it, Stefan sends. There is
  no `autoSendFollowUps` flag and no equivalent. Do not add one.
- Agents produce drafts and schedules. `sendEmail` is the only code path that
  transmits anything, it is callable only from a user action in the app, and it
  rejects any request that does not carry a fresh user auth token. A worker or a
  cron job calling it is a bug, and the auth gate makes it a failing bug rather
  than a silent one.
- Nothing else reaches a lead by any channel. No SMS, no contact form
  submissions, no social messages, no automated calls. The system has one
  outbound channel and it is manual.
- A scheduled follow-up means a draft appears in the review queue on that date.
  It does not mean an email goes out on that date.
- Max 2 follow-up drafts per lead. Beyond that the agent stops proposing.
- The suppression list is checked in `sendEmail` itself, not only in the agent.
  Belt and braces.
- An `interested` classification is a hard stop: the lead is locked and the agent
  drafts nothing further without Stefan asking for it explicitly.

---

## 7. A4, Preview

**Trigger conditions.** Not every qualified lead. Generating previews for
everyone is the expensive mistake.

Generate when any of:
- reply classified `interested` or `question`
- 2 or more opens on a sent email
- `fitScore >= 85` and niche is in `config/agents.highValueNiches`
- Stefan clicks Generate manually (always allowed, no conditions)

**Budget:** 30 steps, 150k tokens, 300s. Higher because of the critique loop.

**The loop:**

1. Read research. Decide the **composition spec** (PREVIEW-SYSTEM.md §3): art
   direction preset, section list, primary module, image plan.
2. Generate copy against the PreviewCopy contract, extended per PREVIEW-SYSTEM.md.
3. `fetch_images`, then `render_preview`.
4. `critique_preview`: screenshots at 375 and 1440 come back as image blocks with
   the WEB-STANDARD hard-rule table. The model judges its own output against H1
   to H12 plus the four questions in §7.1.
5. If it fails anything, revise the spec and re-render. **Max 2 revisions**, then
   ship the best version and log the remaining failures on the preview doc.

### 7.1 The four critique questions

Asked verbatim, with the screenshots attached:

1. Is there any region larger than a quarter of the viewport that carries no
   information? (WEB-STANDARD 1.4)
2. Would this beat the site the business currently has, for a customer deciding in
   five seconds? (1.7)
3. Does anything on this page state a fact that was not in the research data?
   (H11)
4. At 375px, can the visitor complete the primary action without scrolling more
   than twice? (§10.1)

A "no" on 2 or a "yes" on 3 is a mandatory revision. 3 is a mandatory revision
even if it means deleting the section.

Note that the booking module on a preview transmits nothing either. It confirms
the visitor's selection, states plainly that the business was not notified, and
hands off to the phone number (PREVIEW-SYSTEM.md §4.2). The same principle as
everything else here: the system never speaks on anyone's behalf.

---

## 8. State, config, and audit

### 8.1 New Firestore

```
agentRuns/{runId}
  agentId: 'qualifier' | 'researcher' | 'outreach' | 'preview'
  leadId, status, confidence, rationale
  steps, tokensIn, tokensOut, costUsd
  startedAt, finishedAt, error
  outputRef: string | null

agentRuns/{runId}/steps/{n}
  role: 'model' | 'tool'
  toolName?, inputSummary, outputSummary (4KB cap), at, tokens

suppression/{emailHash}
  email, reason, at, leadId

config/agents
  enabled: boolean                    // global kill switch
  qualifier / researcher / outreach / preview: boolean
  autoQualifyOnAnalyze: boolean       // default true (analysis only, sends nothing)
  highValueNiches: string[]
  monthlyAgentBudgetUsd: number
  perRun: { maxSteps, maxTokens, maxSeconds } per agent
```

### 8.2 Lead doc additions

```ts
interface Lead {
  // ... everything from SPEC §4 unchanged
  qualification: Qualification | null;
  research: Research | null;
  agent: {
    lastRunAt: TimestampLike | null;
    lastRunId: string | null;
    locked: boolean;        // true after `interested`, blocks all automation
    lockReason: string | null;
  };
}
```

### 8.3 New job types

`JobType` gains: `qualify` | `research` | `agent_outreach` | `classify_reply`.
`generate_preview` keeps its name and gains an `agentic: boolean` payload flag,
so the deterministic path stays available as a fallback.

### 8.4 Budget

Extend the existing `budget.ts` with an `agent` counter, tracked in real token
usage exactly as the email generation already does. Three levels:

- Per run: hard cap, run ends `capped`.
- Per day: soft warning in the UI at 80 percent.
- Per month: hard stop, jobs go `blocked_budget`, banner in the app.

Cost target on a normal week (one 400-lead sweep): under 15 USD. If a week costs
more than 30, something is looping and the kill switch exists for that reason.

---

## 9. Supervision UI

New page, `/agent`, in the app sidebar and bottom nav.

- **Run feed.** Newest first: agent, lead, verdict, confidence, cost, duration.
  Tap opens the step timeline with every tool call and its summary.
- **Review queue.** Two lists: drafts awaiting approval, and `insufficient_data`
  leads awaiting a human look. This is the page Stefan actually works from.
- **Controls.** Global kill switch, per agent toggles, monthly budget, per-run
  caps. Note what is absent: there is no send automation control, because there
  is no send automation.
- **Cost meter.** Spend this month by agent, and cost per qualified lead. That
  second number is the one that tells you whether this is working.

Mobile is first class here like everywhere else. The review queue must be usable
one-handed, because that is where the approvals happen.

---

## 10. Safety rails, restated in one place

Enforced in code, not prompts:

1. No agent, worker, cron job, or scheduled task sends an email or contacts a
   lead by any channel. `sendEmail` is the only transmitting code path, it is a
   callable requiring a fresh user auth token, and it checks suppression and
   `agent.locked` before doing anything. Everything upstream of it produces
   drafts. This is rail zero: if a change would weaken it, the change is wrong.
2. No agent writes to `config/*`.
3. No agent deletes a lead, a run, or a preview.
4. `agent.locked === true` blocks every automated action on that lead.
5. `fetch_page` and `screenshot_page` refuse private IP ranges, non-http schemes,
   and anything robots.txt disallows.
6. Every run is capped on steps, tokens, and wall clock.
7. Every run is fully logged and auditable after the fact.
8. Global kill switch stops new runs within one poll interval (5s).

---

## 11. Build order

Ship each one usable before starting the next.

1. **A1 Qualifier.** Alone it changes the product. Do not skip ahead.
2. **Agent page** with the run feed. You cannot tune an agent you cannot read.
3. **A2 Researcher.**
4. **A3 Outreach**, drafting first, reply classification second.
5. **A4 Preview**, only after PREVIEW-SYSTEM.md is implemented. An agent
   composing bad sections produces bad pages faster.

PLAN.md Phase 7 carries this as checkboxes.
