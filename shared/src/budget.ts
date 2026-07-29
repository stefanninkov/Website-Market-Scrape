/**
 * Budget guard helpers (SPEC §2). Pure logic — the caller (worker) reads
 * config/apiBudget, runs these checks inside a Firestore transaction, and
 * writes the updated counters back. Every metered Places/Anthropic call MUST
 * go through these helpers (CLAUDE.md cost discipline).
 */

import type { ApiBudget, BudgetCounter, DailyCounter, MeteredApi } from './types.js';

/** Workers refuse jobs at 90% of a limit → job status 'blocked_budget'. */
export const BUDGET_BLOCK_THRESHOLD = 0.9;

// Known unit prices (USD). SPEC §2: Text Search ~$32/1k, Details ~$17/1k.
export const PLACES_TEXT_SEARCH_USD = 0.032;
export const PLACES_DETAILS_USD = 0.017;

// claude-sonnet-4-6 per-token pricing (USD per million tokens).
export const ANTHROPIC_INPUT_USD_PER_MTOK = 3;
export const ANTHROPIC_OUTPUT_USD_PER_MTOK = 15;

/** Estimate cost of an Anthropic call from usage reported in the response. */
export function anthropicCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * ANTHROPIC_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_USD_PER_MTOK
  );
}

/** Fraction of the monthly limit already spent (0 when no limit is set). */
export function budgetUsedFraction(counter: BudgetCounter): number {
  if (counter.monthlyLimitUsd <= 0) return 0;
  return counter.spentUsd / counter.monthlyLimitUsd;
}

/** True once spend reaches 90% of the limit — workers must refuse the job. */
export function isBudgetBlocked(budget: ApiBudget, api: MeteredApi): boolean {
  return budgetUsedFraction(budget[api]) >= BUDGET_BLOCK_THRESHOLD;
}

/** True at/above 90% — UI shows the warning banner. Same threshold as blocking. */
export function isBudgetWarning(budget: ApiBudget, api: MeteredApi): boolean {
  return isBudgetBlocked(budget, api);
}

/**
 * Returns a new ApiBudget with `usd` added to the given api's counter.
 * Never mutates the input (callers write the result back in a transaction).
 */
export function applySpend(budget: ApiBudget, api: MeteredApi, usd: number): ApiBudget {
  return {
    ...budget,
    [api]: {
      ...budget[api],
      spentUsd: budget[api].spentUsd + usd,
    },
  };
}

/** True when the monthly reset point has passed. */
export function isResetDue(budget: ApiBudget, now: Date = new Date()): boolean {
  return now.getTime() >= budget.resetAt.toMillis();
}

/** First day of the month after `from`, at 00:00 UTC — the next reset point. */
export function nextResetDate(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

/**
 * Returns counters zeroed for a new month. The caller converts `resetAtDate`
 * to its SDK's Timestamp before writing.
 */
export function resetCounters(budget: ApiBudget): {
  places: BudgetCounter;
  anthropic: BudgetCounter;
  agent: BudgetCounter;
  resetAtDate: Date;
} {
  return {
    places: { ...budget.places, spentUsd: 0 },
    anthropic: { ...budget.anthropic, spentUsd: 0 },
    agent: { ...agentCounter(budget), spentUsd: 0 },
    resetAtDate: nextResetDate(),
  };
}

// ---------------------------------------------------------------------------
// Agent budget (AGENTS.md §8.4). Three levels, all enforced here:
//   per run   — the loop's own caps, see workers/src/agent/loop.ts
//   per day   — soft warning in the UI, never blocks
//   per month — hard stop, jobs go blocked_budget
//
// The monthly limit lives in config/agents.monthlyAgentBudgetUsd and is passed
// in, so there is exactly one source of truth for it. config/apiBudget only
// carries the *spend*.
// ---------------------------------------------------------------------------

/** UTC day key, YYYY-MM-DD. Day boundaries follow the monthly reset (UTC). */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * There is no separate daily limit in AGENTS.md, so the daily allowance is
 * derived from the monthly one. 30 rather than the real month length keeps the
 * number stable across months; it only drives a warning, never a block.
 */
export const AGENT_DAILY_ALLOWANCE_DIVISOR = 30;
export const AGENT_DAY_WARN_THRESHOLD = 0.8;

/** Agent counters are absent on budget docs written before v3. */
export function agentCounter(budget: ApiBudget): BudgetCounter {
  return budget.agent ?? { monthlyLimitUsd: 0, spentUsd: 0 };
}

export function agentDayCounter(budget: ApiBudget, now: Date = new Date()): DailyCounter {
  const today = dayKey(now);
  const d = budget.agentDay;
  // A stale key means the stored total belongs to a previous day.
  return d && d.key === today ? d : { key: today, spentUsd: 0 };
}

/**
 * Hard stop. Unlike the Places/Anthropic guards this blocks at 100% rather than
 * 90%: the agent layer is the discretionary spend, and a run that is refused
 * costs nothing but a `blocked_budget` job Stefan can re-run after raising the
 * cap.
 */
export function isAgentBudgetBlocked(budget: ApiBudget, monthlyLimitUsd: number): boolean {
  if (monthlyLimitUsd <= 0) return false;
  return agentCounter(budget).spentUsd >= monthlyLimitUsd;
}

/** Soft, UI-only. True at 80% of the derived daily allowance. */
export function isAgentDayWarning(
  budget: ApiBudget,
  monthlyLimitUsd: number,
  now: Date = new Date(),
): boolean {
  if (monthlyLimitUsd <= 0) return false;
  const allowance = monthlyLimitUsd / AGENT_DAILY_ALLOWANCE_DIVISOR;
  return agentDayCounter(budget, now).spentUsd >= allowance * AGENT_DAY_WARN_THRESHOLD;
}

/**
 * Adds agent spend to the monthly and daily agent counters *and* to the
 * anthropic counter. Agent tokens are literally the Anthropic bill, so the
 * existing guard has to see them; the agent counters exist on top of that to
 * attribute the spend and drive cost-per-qualified-lead.
 */
export function applyAgentSpend(
  budget: ApiBudget,
  usd: number,
  now: Date = new Date(),
): ApiBudget {
  const day = agentDayCounter(budget, now);
  return {
    ...applySpend(budget, 'anthropic', usd),
    agent: { ...agentCounter(budget), spentUsd: agentCounter(budget).spentUsd + usd },
    agentDay: { key: day.key, spentUsd: day.spentUsd + usd },
  };
}
