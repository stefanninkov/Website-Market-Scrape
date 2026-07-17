/**
 * Dashboard (SPEC §9.1, PLAN Phase 1+3): counters (total leads, no-website,
 * new this week, due follow-ups, reply rate) and the due-follow-ups list.
 * Counters use server-side count aggregation; the follow-ups list is a live
 * query (followUpDue <= now).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCountFromServer,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { leadsCol } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { formatRelative, startOfWeek } from '../lib/format';
import { EmptyState, ScoreBadge, StageChip } from '../components/ui';

interface Counts {
  total: number;
  noWebsite: number;
  newThisWeek: number;
  contacted: number;
  replied: number;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const col = leadsCol();
      const [total, noWebsite, newThisWeek, contacted, replied] = await Promise.all([
        getCountFromServer(col),
        getCountFromServer(query(col, where('websiteType', 'in', ['none', 'facebook', 'instagram']))),
        getCountFromServer(query(col, where('firstSeenAt', '>=', Timestamp.fromDate(startOfWeek())))),
        getCountFromServer(query(col, where('outreach.lastSentAt', '!=', null))),
        getCountFromServer(query(col, where('outreach.replied', '==', true))),
      ]);
      setCounts({
        total: total.data().count,
        noWebsite: noWebsite.data().count,
        newThisWeek: newThisWeek.data().count,
        contacted: contacted.data().count,
        replied: replied.data().count,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Due follow-ups: followUpDue in the past, still unanswered.
  const dueQuery = useMemo(
    () =>
      query(
        leadsCol(),
        where('outreach.followUpDue', '<=', Timestamp.now()),
        orderBy('outreach.followUpDue', 'asc'),
        limit(25),
      ),
    [],
  );
  const { data: dueLeads } = useQuery(dueQuery);
  const due = dueLeads.filter((l) => !l.outreach.replied && l.stage !== 'ignored');

  const replyRate =
    counts && counts.contacted > 0
      ? `${Math.round((counts.replied / counts.contacted) * 100)}%`
      : '—';

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Counter label="Total leads" value={counts?.total} />
          <Counter label="No real website" value={counts?.noWebsite} accent />
          <Counter label="New this week" value={counts?.newThisWeek} />
          <Counter label="Due follow-ups" value={due.length} warn={due.length > 0} />
          <Counter label="Reply rate" value={replyRate} />
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">Due follow-ups</h2>
        {due.length === 0 ? (
          <EmptyState title="Nothing due — inbox zero for follow-ups." />
        ) : (
          <div className="space-y-2">
            {due.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{l.name}</span>
                    <ScoreBadge score={l.analysis?.score ?? 0} />
                  </div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    {l.category} · sent {formatRelative(l.outreach.lastSentAt)} · due{' '}
                    {formatRelative(l.outreach.followUpDue)}
                  </div>
                </div>
                <StageChip stage={l.stage} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value?: number | string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div
        className={`font-mono text-3xl font-semibold tabular-nums ${accent ? 'text-accent' : warn ? 'text-warn' : ''}`}
      >
        {value ?? '—'}
      </div>
      <div className="mt-1 text-sm text-text-dim">{label}</div>
    </div>
  );
}
