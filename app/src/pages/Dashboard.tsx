/**
 * Dashboard (SPEC §9.1, PLAN Phase 1+3): counters (total leads, no-website,
 * new this week, due follow-ups, reply rate) and the due-follow-ups list.
 *
 * Counters are derived from live listeners rather than getCountFromServer.
 * Aggregation queries are one-shot: they cannot tell you a lead was deleted or
 * ignored, so the numbers went stale the moment anything changed. Listening
 * costs the same documents the Leads page already streams.
 *
 * `ignored` leads are excluded from every counter. SPEC §11 makes ignored
 * permanent — a lead you have decided never to contact is not part of your
 * pipeline and should not inflate its size.
 */

import { useMemo } from 'react';
import { limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
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
  // Every non-ignored lead. Live, so deletes and stage changes land immediately.
  const leadsQuery = useMemo(() => query(leadsCol(), where('stage', '!=', 'ignored')), []);
  const { data: leads, loading, error } = useQuery(leadsQuery);

  const viewsQuery = useMemo(
    () => query(eventsCol(), where('type', '==', 'preview_view')),
    [],
  );
  const { data: viewEvents } = useQuery(viewsQuery);

  const counts: Counts = useMemo(() => {
    const weekStart = startOfWeek();
    return {
      total: leads.length,
      noWebsite: leads.filter((l) =>
        ['none', 'facebook', 'instagram'].includes(l.websiteType),
      ).length,
      newThisWeek: leads.filter((l) => l.firstSeenAt.toDate() >= weekStart).length,
      contacted: leads.filter((l) => l.outreach.lastSentAt !== null).length,
      replied: leads.filter((l) => l.outreach.replied).length,
      previewViews: viewEvents.length,
      won: leads.filter((l) => l.stage === 'won').length,
      lost: leads.filter((l) => l.stage === 'lost').length,
    };
  }, [leads, viewEvents]);

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
    counts.contacted > 0 ? `${Math.round((counts.replied / counts.contacted) * 100)}%` : '—';

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        {loading && <span className="text-xs text-text-dim">Loading…</span>}
      </div>

      {error ? (
        <p className="text-sm text-danger">Failed to load counters: {error.message}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Counter label="Total leads" value={counts.total} />
          <Counter label="No real website" value={counts.noWebsite} accent />
          <Counter label="New this week" value={counts.newThisWeek} />
          <Counter label="Due follow-ups" value={due.length} warn={due.length > 0} />
          <Counter label="Reply rate" value={replyRate} />
          <Counter label="Preview views" value={counts.previewViews} />
        </div>
      )}

      {(counts.won > 0 || counts.lost > 0) && (
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
