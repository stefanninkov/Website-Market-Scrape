/**
 * Budget warning banner at 90% (PLAN Phase 1, SPEC §2). Reads config/apiBudget
 * live; shows a banner when Places or Anthropic spend hits the block threshold.
 */

import { useMemo } from 'react';
import { budgetUsedFraction, BUDGET_BLOCK_THRESHOLD } from '@wms/shared';
import { apiBudgetDoc } from '../lib/db';
import { useDoc } from '../lib/hooks';

export default function BudgetBanner() {
  const ref = useMemo(() => apiBudgetDoc(), []);
  const { data: budget } = useDoc(ref);

  if (!budget) return null;

  const warnings: string[] = [];
  for (const api of ['places', 'anthropic'] as const) {
    const frac = budgetUsedFraction(budget[api]);
    if (frac >= BUDGET_BLOCK_THRESHOLD) {
      warnings.push(
        `${api === 'places' ? 'Google Places' : 'Anthropic'} budget at ${Math.round(frac * 100)}% ($${budget[api].spentUsd.toFixed(2)} / $${budget[api].monthlyLimitUsd.toFixed(0)}) — jobs are blocked.`,
      );
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger md:px-6">
      {warnings.map((w) => (
        <div key={w}>⚠ {w}</div>
      ))}
    </div>
  );
}
