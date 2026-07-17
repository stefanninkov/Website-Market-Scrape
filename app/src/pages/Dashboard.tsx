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
import { eventsCol, leadsCol } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { formatRelative, startOfWeek } from '../lib/format';
import { EmptyState, ScoreBadge, StageChip } from '../components/ui';

interface Counts {
  total: number;
  noWebsite: number;
  newThisWeek: number;
  contacted: number;
  replied: number;
  previewViews: number;
  won: number;
  lost: number;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const col = leadsCol();
      const [total, noWebsite, newThisWeek, contacted, replied, previewViews, won, lost] =
        await Promise.all([
          getCountFromServer(col),
          getCountFromServer(query(col, where('websiteType', 'in', ['none', 'facebook', 'instagram']))),
          getCountFromServer(query(col, where('firstSeenAt', '>=', Timestamp.fromDate(startOfWeek())))),
          getCountFromServer(query(col, where('outreach.lastSentAt', '!=', null))),
          getCountFromServer(query(col, where('outreach.replied', '==', true))),
          getCountFromServer(query(eventsCol(), where('type', '==', 'preview_view'))),
          getCountFromServer(query(col, where('stage', '==', 'won'))),
          getCountFromServer(query(col, where('stage', '==', 'lost'))),
        ]);
      setCounts({
        total: total.data().count,
        noWebsite: noWebsite.data().count,
        newThisWeek: newThisWeek.data().count,
        contacted: contacted.data().count,
        replied: replied.data().count,
        previewViews: previewViews.data().count,
        won: won.data().count,
        lost: lost.data().count,
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Counter label="Total leads" value={counts?.total} />
          <Counter label="No real website" value={counts?.noWebsite} accent />
          <Counter label="New this week" value={counts?.newThisWeek} />
          <Counter label="Due follow-ups" value={due.length} warn={due.length > 0} />
          <Counter label="Reply rate" value={replyRate} />
          <Counter label="Preview views" value={counts?.previewViews} />
        </div>
      )}

      {counts && (counts.won > 0 || counts.lost > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
          <Counter label="Won" value={counts.won} accent />
          <Counter label="Lost" value={counts.lost} />
        </div>
      )}

      <ReplyRateChart />

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

const CHART_WEEKS = 8;

/** Sent vs replies per ISO week, last 8 weeks — tiny inline SVG, no chart lib. */
function ReplyRateChart() {
  const since = useMemo(() => {
    const d = startOfWeek();
    d.setDate(d.getDate() - (CHART_WEEKS - 1) * 7);
    return d;
  }, []);
  const q = useMemo(
    () =>
      query(
        eventsCol(),
        where('type', 'in', ['sent', 'reply']),
        where('at', '>=', Timestamp.fromDate(since)),
        orderBy('at', 'asc'),
        limit(2000),
      ),
    [since],
  );
  const { data: events } = useQuery(q);

  const weeks = useMemo(() => {
    const buckets = Array.from({ length: CHART_WEEKS }, (_, i) => {
      const start = new Date(since);
      start.setDate(start.getDate() + i * 7);
      return { start, sent: 0, replies: 0 };
    });
    for (const e of events) {
      const idx = Math.floor((e.at.toMillis() - since.getTime()) / (7 * 86400_000));
      const bucket = buckets[idx];
      if (!bucket) continue;
      if (e.type === 'sent') bucket.sent += 1;
      else if (e.type === 'reply') bucket.replies += 1;
    }
    return buckets;
  }, [events, since]);

  const max = Math.max(1, ...weeks.map((w) => w.sent));
  if (events.length === 0) return null;

  const W = 480;
  const H = 120;
  const bw = W / CHART_WEEKS;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-semibold">Sent vs replies · last {CHART_WEEKS} weeks</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface p-4">
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="h-36 w-full min-w-[360px]">
          {weeks.map((w, i) => {
            const sentH = (w.sent / max) * H;
            const repH = (w.replies / max) * H;
            const label = `${w.start.getDate()}.${w.start.getMonth() + 1}.`;
            return (
              <g key={i}>
                <rect
                  x={i * bw + bw * 0.18}
                  y={H - sentH}
                  width={bw * 0.28}
                  height={sentH}
                  rx="2"
                  fill="#5AA9FF"
                />
                <rect
                  x={i * bw + bw * 0.52}
                  y={H - repH}
                  width={bw * 0.28}
                  height={repH}
                  rx="2"
                  fill="#3DDC97"
                />
                <text
                  x={i * bw + bw / 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#8B93A7"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex gap-4 text-xs text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-info" /> sent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-success" /> replies
          </span>
        </div>
      </div>
    </section>
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
