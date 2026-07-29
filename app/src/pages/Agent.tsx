/**
 * /agent — supervision UI (AGENTS.md §9).
 *
 * "You cannot tune an agent you cannot read", so the run feed and the step
 * timeline are the point of this page, not decoration. Controls are the kill
 * switch, the per-agent toggles and the caps.
 *
 * Note what is deliberately absent: there is no send-automation control,
 * because there is no send automation (AGENTS.md §9, §10.1).
 */

import { useMemo, useState } from 'react';
import { setDoc } from 'firebase/firestore';
import type { AgentId, AgentRun, AgentRunStatus, AgentsConfig } from '@wms/shared';
import {
  agentStepsQuery,
  agentsConfigDoc,
  apiBudgetDoc,
  recentAgentRunsQuery,
} from '../lib/db';
import { useDoc, useQuery } from '../lib/hooks';
import { Button, EmptyState } from '../components/ui';

const AGENT_IDS: AgentId[] = ['qualifier', 'researcher', 'outreach', 'preview'];

const AGENT_LABEL: Record<AgentId, string> = {
  qualifier: 'Qualifier',
  researcher: 'Researcher',
  outreach: 'Outreach',
  preview: 'Preview',
};

const STATUS_CLASS: Record<AgentRunStatus, string> = {
  done: 'text-success',
  capped: 'text-warn',
  failed: 'text-danger',
  blocked_budget: 'text-warn',
  aborted: 'text-text-dim',
};

function usd(n: number): string {
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`;
}

function duration(run: AgentRun): string {
  if (!run.finishedAt) return '…';
  const ms = run.finishedAt.toMillis() - run.startedAt.toMillis();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Step timeline
// ---------------------------------------------------------------------------

function StepTimeline({ runId }: { runId: string }) {
  const q = useMemo(() => agentStepsQuery(runId), [runId]);
  const { data: steps, loading } = useQuery(q);

  if (loading) return <p className="p-4 text-sm text-text-dim">Loading steps…</p>;
  if (steps.length === 0) return <p className="p-4 text-sm text-text-dim">No steps logged.</p>;

  return (
    <ol className="divide-y divide-border border-t border-border">
      {steps.map((s, i) => (
        <li key={s.id} className="px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-text-dim">{String(i).padStart(2, '0')}</span>
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                s.role === 'tool' ? 'text-info' : 'text-accent'
              }`}
            >
              {s.role === 'tool' ? (s.toolName ?? 'tool') : 'model'}
            </span>
            {s.tokens > 0 && (
              <span className="font-mono text-xs text-text-dim">{s.tokens} tok</span>
            )}
          </div>
          {s.inputSummary && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 font-mono text-[11px] leading-relaxed text-text-dim">
              {s.inputSummary}
            </pre>
          )}
          {s.outputSummary && (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 font-mono text-[11px] leading-relaxed text-text">
              {s.outputSummary}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Run feed
// ---------------------------------------------------------------------------

function RunFeed() {
  const q = useMemo(() => recentAgentRunsQuery(50), []);
  const { data: runs, loading } = useQuery(q);
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-text-dim">Loading runs…</p>;
  if (runs.length === 0) {
    return <EmptyState title="No agent runs yet. Qualify a lead to see one here." />;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {runs.map((run) => {
        const open = openId === run.id;
        return (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : run.id)}
              aria-expanded={open}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="min-w-24 text-sm font-medium">{AGENT_LABEL[run.agentId]}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-dim">
                {run.leadId}
              </span>
              <span className={`text-xs font-semibold ${STATUS_CLASS[run.status]}`}>
                {run.status}
              </span>
              <span className="font-mono text-xs text-text-dim">
                {(run.confidence * 100).toFixed(0)}%
              </span>
              <span className="font-mono text-xs text-text-dim">{run.steps} steps</span>
              <span className="font-mono text-xs text-text-dim">{duration(run)}</span>
              <span className="font-mono text-xs text-text-dim">{usd(run.costUsd)}</span>
            </button>
            {run.rationale && !open && (
              <p className="px-4 pb-3 text-sm text-text-dim">{run.rationale}</p>
            )}
            {open && (
              <div className="bg-bg">
                {run.rationale && <p className="px-4 py-3 text-sm">{run.rationale}</p>}
                {run.error && (
                  <p className="px-4 pb-3 text-sm text-danger">{run.error}</p>
                )}
                <StepTimeline runId={run.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-text-dim">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-accent"
      />
    </label>
  );
}

function Controls({ cfg }: { cfg: AgentsConfig | null }) {
  const [saving, setSaving] = useState(false);
  if (!cfg) return <p className="text-sm text-text-dim">Loading config…</p>;

  const save = async (patch: Partial<AgentsConfig>) => {
    setSaving(true);
    try {
      await setDoc(agentsConfigDoc(), { ...cfg, ...patch }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Kill switch</h3>
          <p className="text-xs text-text-dim">
            Off stops new runs within one poll (5s). Runs in flight abort at their next step.
          </p>
        </div>
        <Button
          variant={cfg.enabled ? 'ghost' : 'primary'}
          disabled={saving}
          onClick={() => void save({ enabled: !cfg.enabled })}
        >
          {cfg.enabled ? 'Stop all agents' : 'Enable agents'}
        </Button>
      </div>

      <div className="mt-4 divide-y divide-border border-t border-border">
        {AGENT_IDS.map((id) => (
          <Toggle
            key={id}
            label={AGENT_LABEL[id]}
            checked={cfg[id]}
            onChange={(v) => void save({ [id]: v } as Partial<AgentsConfig>)}
          />
        ))}
        <Toggle
          label="Qualify automatically after analyze"
          hint="Analysis only. Enqueues a qualify job and sends nothing."
          checked={cfg.autoQualifyOnAnalyze}
          onChange={(v) => void save({ autoQualifyOnAnalyze: v })}
        />
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-text-dim">
          Monthly agent budget (USD)
        </span>
        <input
          type="number"
          min={0}
          defaultValue={cfg.monthlyAgentBudgetUsd}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v !== cfg.monthlyAgentBudgetUsd) {
              void save({ monthlyAgentBudgetUsd: v });
            }
          }}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
        />
      </label>

      <p className="mt-4 text-xs text-text-dim">
        There is no send-automation control here because there is no send automation. Every
        outbound message waits for your approval.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost meter
// ---------------------------------------------------------------------------

function CostMeter({ cfg }: { cfg: AgentsConfig | null }) {
  const { data: budget } = useDoc(useMemo(() => apiBudgetDoc(), []));
  const runsQ = useMemo(() => recentAgentRunsQuery(200), []);
  const { data: runs } = useQuery(runsQ);

  const spent = budget?.agent?.spentUsd ?? 0;
  const limit = cfg?.monthlyAgentBudgetUsd ?? 0;
  const today = budget?.agentDay?.spentUsd ?? 0;

  // Cost per qualified lead is the number that says whether this is earning its
  // keep (AGENTS.md §9). Computed from the loaded run window, not all time.
  const qualifierRuns = runs.filter((r) => r.agentId === 'qualifier');
  const qualifierCost = qualifierRuns.reduce((sum, r) => sum + r.costUsd, 0);
  const qualifiedCount = qualifierRuns.filter((r) => r.status === 'done').length;
  const perQualified = qualifiedCount > 0 ? qualifierCost / qualifiedCount : null;

  const cells: Array<{ label: string; value: string }> = [
    { label: 'This month', value: limit > 0 ? `${usd(spent)} / ${usd(limit)}` : usd(spent) },
    { label: 'Today', value: usd(today) },
    { label: 'Runs loaded', value: String(runs.length) },
    {
      label: 'Cost per qualified lead',
      value: perQualified === null ? '—' : usd(perQualified),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface p-4">
          <div className="font-mono text-lg">{c.value}</div>
          <div className="mt-1 text-xs text-text-dim">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Agent() {
  const { data: cfg } = useDoc(useMemo(() => agentsConfigDoc(), []));

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-xl font-semibold">Agent</h1>
        <p className="mt-1 text-sm text-text-dim">
          Every run, every tool call, and what it cost.
        </p>
      </header>

      <CostMeter cfg={cfg} />
      <Controls cfg={cfg} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-dim">
          Run feed
        </h2>
        <RunFeed />
      </section>
    </div>
  );
}
