/**
 * Dashboard v1 (PLAN Phase 1): counters — total leads, no-website count,
 * this week's new. Uses server-side count aggregation (cheap, no full reads).
 */

import { useCallback, useEffect, useState } from 'react';
import { getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { leadsCol } from '../lib/db';
import { startOfWeek } from '../lib/format';

interface Counts {
  total: number;
  noWebsite: number;
  newThisWeek: number;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const col = leadsCol();
      const [total, noWebsite, newThisWeek] = await Promise.all([
        getCountFromServer(col),
        getCountFromServer(query(col, where('websiteType', 'in', ['none', 'facebook', 'instagram']))),
        getCountFromServer(
          query(col, where('firstSeenAt', '>=', Timestamp.fromDate(startOfWeek()))),
        ),
      ]);
      setCounts({
        total: total.data().count,
        noWebsite: noWebsite.data().count,
        newThisWeek: newThisWeek.data().count,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-dim hover:text-text"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-danger">Failed to load counters: {error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Counter label="Total leads" value={counts?.total} />
          <Counter label="No real website" value={counts?.noWebsite} accent />
          <Counter label="New this week" value={counts?.newThisWeek} />
        </div>
      )}
    </div>
  );
}

function Counter({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`font-mono text-3xl font-semibold tabular-nums ${accent ? 'text-accent' : ''}`}>
        {value ?? '—'}
      </div>
      <div className="mt-1 text-sm text-text-dim">{label}</div>
    </div>
  );
}
