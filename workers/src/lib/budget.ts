/**
 * Firestore-backed budget guard for workers (SPEC §2, CLAUDE.md cost
 * discipline). Wraps the pure helpers in @wms/shared with transactions and
 * monthly-reset handling. Every metered Places/Anthropic call goes:
 *   assertBudget(db, api)  →  make the call  →  recordSpend(db, api, usd)
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  applySpend,
  configPath,
  isBudgetBlocked,
  isResetDue,
  nextResetDate,
  resetCounters,
  type ApiBudget,
  type MeteredApi,
} from '@wms/shared';
import { BudgetBlockedError } from './queue.js';

// Defaults when config/apiBudget doesn't exist yet. Places has ~$200/mo free
// credit (SPEC §2); Anthropic generations are pennies. Editable in Settings.
const DEFAULT_PLACES_LIMIT_USD = 200;
const DEFAULT_ANTHROPIC_LIMIT_USD = 20;

function budgetRef(db: Firestore) {
  return db.doc(configPath('apiBudget'));
}

/**
 * Reads config/apiBudget, creating it with defaults if missing and resetting
 * counters when the monthly reset point has passed. Returns the live budget.
 */
export async function ensureBudget(db: Firestore): Promise<ApiBudget> {
  const ref = budgetRef(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const fresh: ApiBudget = {
        places: { monthlyLimitUsd: DEFAULT_PLACES_LIMIT_USD, spentUsd: 0 },
        anthropic: { monthlyLimitUsd: DEFAULT_ANTHROPIC_LIMIT_USD, spentUsd: 0 },
        resetAt: Timestamp.fromDate(nextResetDate()),
      };
      tx.set(ref, fresh);
      return fresh;
    }
    const budget = snap.data() as ApiBudget;
    if (isResetDue(budget)) {
      const reset = resetCounters(budget);
      const next: ApiBudget = {
        places: reset.places,
        anthropic: reset.anthropic,
        resetAt: Timestamp.fromDate(reset.resetAtDate),
      };
      tx.set(ref, next);
      return next;
    }
    return budget;
  });
}

/** Throws BudgetBlockedError if the api is at/above 90% of its monthly limit. */
export async function assertBudget(db: Firestore, api: MeteredApi): Promise<void> {
  const budget = await ensureBudget(db);
  if (isBudgetBlocked(budget, api)) {
    throw new BudgetBlockedError(api);
  }
}

/** Atomically add `usd` to the api's spend counter. */
export async function recordSpend(db: Firestore, api: MeteredApi, usd: number): Promise<void> {
  const ref = budgetRef(db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return; // ensureBudget runs before any spend
    const updated = applySpend(snap.data() as ApiBudget, api, usd);
    tx.update(ref, { [api]: updated[api] });
  });
}
