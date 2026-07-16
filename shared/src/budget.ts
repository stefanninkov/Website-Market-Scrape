/**
 * Budget guard helpers (SPEC §2). Pure logic — the caller (worker) reads
 * config/apiBudget, runs these checks inside a Firestore transaction, and
 * writes the updated counters back. Every metered Places/Anthropic call MUST
 * go through these helpers (CLAUDE.md cost discipline).
 */

import type { ApiBudget, BudgetCounter, MeteredApi } from './types.js';

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
  resetAtDate: Date;
} {
  return {
    places: { ...budget.places, spentUsd: 0 },
    anthropic: { ...budget.anthropic, spentUsd: 0 },
    resetAtDate: nextResetDate(),
  };
}
