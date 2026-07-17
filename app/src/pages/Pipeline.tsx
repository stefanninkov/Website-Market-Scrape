/**
 * Pipeline page (SPEC §9.4, PLAN Phase 3): kanban New → Qualified → Contacted →
 * Replied → Won/Lost. Columns horizontal-scroll on mobile (DESIGN.md). Desktop
 * uses native drag-and-drop; mobile uses a per-card stage picker (a pragmatic
 * stand-in for long-press drag). Stage changes are optimistic via Firestore.
 */

import { useMemo, useState } from 'react';
import { limit, orderBy, query, updateDoc } from 'firebase/firestore';
import type { LeadStage } from '@wms/shared';
import { leadDoc, leadsCol, type LeadWithId } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { ScoreBadge, STAGE_LABEL } from '../components/ui';

const COLUMNS: LeadStage[] = ['new', 'qualified', 'contacted', 'replied', 'won', 'lost'];

export default function Pipeline() {
  const q = useMemo(() => query(leadsCol(), orderBy('analysis.score', 'desc'), limit(1000)), []);
  const { data: leads, loading } = useQuery(q);
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map: Record<LeadStage, LeadWithId[]> = {
      new: [],
      qualified: [],
      contacted: [],
      replied: [],
      won: [],
      lost: [],
      ignored: [],
    };
    for (const l of leads) map[l.stage]?.push(l);
    return map;
  }, [leads]);

  async function moveTo(leadId: string, stage: LeadStage): Promise<void> {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage) return;
    try {
      await updateDoc(leadDoc(leadId), { stage });
    } catch (err) {
      toast.show(`Move failed: ${(err as Error).message}`, 'error');
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col p-4 md:h-dvh md:p-6">
      <h1 className="mb-4 text-lg font-semibold">Pipeline</h1>
      {loading ? (
        <p className="font-mono text-sm text-text-dim">loading…</p>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) void moveTo(dragId, stage);
                setDragId(null);
              }}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-surface"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium">{STAGE_LABEL[stage]}</span>
                <span className="font-mono text-xs text-text-dim">{byStage[stage].length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {byStage[stage].map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    className="cursor-grab rounded-lg border border-border bg-surface-2 p-2 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{lead.name}</span>
                      <ScoreBadge score={lead.analysis?.score ?? 0} />
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-text-dim">
                      {lead.category} · {lead.region}
                    </div>
                    {/* Mobile stage picker (drag isn't practical on touch) */}
                    <select
                      value={lead.stage}
                      onChange={(e) => void moveTo(lead.id, e.target.value as LeadStage)}
                      className="mt-1.5 w-full rounded bg-surface px-1.5 py-1 text-[11px] text-text-dim md:hidden"
                    >
                      {COLUMNS.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
