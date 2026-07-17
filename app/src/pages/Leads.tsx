/**
 * Leads page (SPEC §9.3, PLAN Phase 1): filterable, score-sorted list.
 * Desktop = dense table; mobile = card list (DESIGN.md). Row/card opens the
 * lead drawer. Filters live in a panel (always shown on desktop, toggled on
 * mobile). Ignored leads are hidden unless explicitly filtered for (SPEC §11).
 *
 * Phase 1 fetches the top 1000 leads by score and filters client-side — one
 * automatic index, no composite indexes. Virtualization is a later refinement.
 */

import { useMemo, useState } from 'react';
import { limit, orderBy, query, updateDoc } from 'firebase/firestore';
import type { LeadStage, WebsiteType } from '@wms/shared';
import { leadDoc, leadsCol, type LeadWithId } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { enqueueJob } from '../lib/functions';
import { EUROPEAN_COUNTRIES, countryName } from '../lib/countries';
import LeadDrawer from '../components/LeadDrawer';
import { useToast } from '../components/Toast';
import {
  Button,
  EmptyState,
  NewBusinessBadge,
  ScoreBadge,
  STAGE_LABEL,
  STAGES,
  StageChip,
  WebsiteTypeChip,
  inputClass,
} from '../components/ui';

interface Filters {
  country: string;
  niche: string;
  websiteType: WebsiteType | 'all';
  minScore: number;
  stage: LeadStage | 'all';
  newOnly: boolean;
}

const BLANK_FILTERS: Filters = {
  country: 'all',
  niche: '',
  websiteType: 'all',
  minScore: 0,
  stage: 'all',
  newOnly: false,
};

const MAX_LEADS = 1000;

function scoreOf(lead: LeadWithId): number {
  return lead.analysis?.score ?? 0;
}

export default function Leads() {
  const q = useMemo(
    () => query(leadsCol(), orderBy('analysis.score', 'desc'), limit(MAX_LEADS)),
    [],
  );
  const { data: leads, loading, error } = useQuery(q);

  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(BLANK_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleChecked(id: string): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkGenerate(): Promise<void> {
    setBulkBusy(true);
    try {
      // Sequential enqueue; the single ai-worker also processes one at a time,
      // which is what "sequential to respect budget" (SPEC §7) needs.
      for (const id of checked) {
        await enqueueJob('generate_email', { placeId: id });
      }
      toast.show(`Queued ${checked.size} draft${checked.size === 1 ? '' : 's'}.`, 'info');
      setChecked(new Set());
    } catch (err) {
      toast.show(`Bulk generate failed: ${(err as Error).message}`, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkStage(stage: LeadStage): Promise<void> {
    if (stage === 'ignored' && !confirm(`Ignore ${checked.size} lead(s)? Ignored is permanent.`)) {
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of checked) {
        await updateDoc(leadDoc(id), { stage });
      }
      toast.show(`Moved ${checked.size} lead(s) to ${STAGE_LABEL[stage]}.`, 'success');
      setChecked(new Set());
    } catch (err) {
      toast.show(`Bulk update failed: ${(err as Error).message}`, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filters.stage === 'all' && l.stage === 'ignored') return false;
      if (filters.country !== 'all' && l.country !== filters.country) return false;
      if (filters.niche && !l.category.toLowerCase().includes(filters.niche.toLowerCase()))
        return false;
      if (filters.websiteType !== 'all' && l.websiteType !== filters.websiteType) return false;
      if (scoreOf(l) < filters.minScore) return false;
      if (filters.stage !== 'all' && l.stage !== filters.stage) return false;
      if (filters.newOnly && !l.isNewBusiness) return false;
      return true;
    });
  }, [leads, filters]);

  const nicheOptions = useMemo(
    () => [...new Set(leads.map((l) => l.category))].sort(),
    [leads],
  );

  const selectedLead = selected ? (leads.find((l) => l.id === selected) ?? null) : null;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Leads{' '}
          <span className="font-mono text-sm font-normal text-text-dim">({filtered.length})</span>
        </h1>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-dim md:hidden"
        >
          Filters
        </button>
      </div>

      <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
        <FilterBar
          filters={filters}
          nicheOptions={nicheOptions}
          onChange={setFilters}
          onReset={() => setFilters(BLANK_FILTERS)}
        />
      </div>

      {checked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-surface p-2 pl-3">
          <span className="font-mono text-sm text-accent">{checked.size} selected</span>
          <Button
            variant="primary"
            className="px-2 py-1.5 text-xs"
            disabled={bulkBusy}
            onClick={() => void bulkGenerate()}
          >
            Generate drafts
          </Button>
          <select
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-text"
            value=""
            disabled={bulkBusy}
            onChange={(e) => {
              if (e.target.value) void bulkStage(e.target.value as LeadStage);
            }}
          >
            <option value="">Move to stage…</option>
            {STAGES.filter((s) => s !== 'ignored').map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <Button
            variant="danger"
            className="px-2 py-1.5 text-xs"
            disabled={bulkBusy}
            onClick={() => void bulkStage('ignored')}
          >
            Ignore
          </Button>
          <button
            onClick={() => setChecked(new Set())}
            className="ml-auto px-2 text-xs text-text-dim hover:text-text"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-sm text-text-dim">loading…</p>
      ) : error ? (
        <p className="text-sm text-danger">Failed to load leads: {error.message}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={leads.length === 0 ? 'No leads yet. Run a sweep to find some.' : 'No leads match these filters.'} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs text-text-dim">
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={filtered.length > 0 && checked.size === filtered.length}
                      onChange={(e) =>
                        setChecked(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Niche</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Website</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l.id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={checked.has(l.id)}
                        onChange={() => toggleChecked(l.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={scoreOf(l)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.name}</span>
                        {l.isNewBusiness && <NewBusinessBadge />}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-dim">{l.category}</td>
                    <td className="px-3 py-2 text-text-dim">
                      {l.region}, {l.country}
                    </td>
                    <td className="px-3 py-2">
                      <WebsiteTypeChip type={l.websiteType} />
                    </td>
                    <td className="px-3 py-2">
                      <StageChip stage={l.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                className="block w-full rounded-xl border border-border bg-surface p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{l.name}</span>
                  <ScoreBadge score={scoreOf(l)} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-dim">
                  <span className="truncate">
                    {l.category} · {l.region}
                  </span>
                  <WebsiteTypeChip type={l.websiteType} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StageChip stage={l.stage} />
                  {l.isNewBusiness && <NewBusinessBadge />}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterBar({
  filters,
  nicheOptions,
  onChange,
  onReset,
}: {
  filters: Filters;
  nicheOptions: string[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
      <select
        className={inputClass}
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value })}
      >
        <option value="all">All countries</option>
        {EUROPEAN_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {countryName(c.code)}
          </option>
        ))}
      </select>

      <select
        className={inputClass}
        value={filters.niche}
        onChange={(e) => onChange({ ...filters, niche: e.target.value })}
      >
        <option value="">All niches</option>
        {nicheOptions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <select
        className={inputClass}
        value={filters.websiteType}
        onChange={(e) => onChange({ ...filters, websiteType: e.target.value as Filters['websiteType'] })}
      >
        <option value="all">Any website</option>
        <option value="none">No website</option>
        <option value="facebook">Facebook</option>
        <option value="instagram">Instagram</option>
        <option value="real">Has site</option>
      </select>

      <select
        className={inputClass}
        value={filters.stage}
        onChange={(e) => onChange({ ...filters, stage: e.target.value as Filters['stage'] })}
      >
        <option value="all">Any stage</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-dim">
        <span className="shrink-0">Min</span>
        <input
          type="number"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) || 0 })}
          className="w-full bg-transparent py-2 font-mono outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-dim">
          <input
            type="checkbox"
            checked={filters.newOnly}
            onChange={(e) => onChange({ ...filters, newOnly: e.target.checked })}
            className="accent-accent"
          />
          New only
        </label>
        <button
          onClick={onReset}
          className="shrink-0 rounded-lg border border-border bg-surface-2 px-2 py-2 text-xs text-text-dim hover:text-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
