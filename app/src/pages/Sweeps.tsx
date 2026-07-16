/**
 * Sweeps page (SPEC §9.2): saved sweeps list, create/edit (country dropdown,
 * region, niche multi-select + free text, schedule), Run now, per-sweep stats.
 */

import { useMemo, useState } from 'react';
import { addDoc, deleteDoc, orderBy, query, updateDoc } from 'firebase/firestore';
import type { Sweep, SweepSchedule } from '@wms/shared';
import { sweepsCol, sweepDoc, type SweepWithId } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { enqueueJob } from '../lib/functions';
import { EUROPEAN_COUNTRIES, countryName } from '../lib/countries';
import { formatRelative } from '../lib/format';
import { useToast } from '../components/Toast';
import NicheMultiSelect from '../components/NicheMultiSelect';
import { Button, EmptyState, inputClass, labelClass } from '../components/ui';

interface FormState {
  name: string;
  country: string;
  region: string;
  niches: string[];
  schedule: SweepSchedule;
}

const BLANK_FORM: FormState = {
  name: '',
  country: 'RS',
  region: '',
  niches: [],
  schedule: 'manual',
};

export default function Sweeps() {
  const q = useMemo(() => query(sweepsCol(), orderBy('name')), []);
  const { data: sweeps, loading } = useQuery(q);
  const toast = useToast();

  const [editing, setEditing] = useState<SweepWithId | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(s: SweepWithId): void {
    setEditing(s);
    setShowForm(true);
  }

  async function runNow(s: SweepWithId): Promise<void> {
    setRunning(s.id);
    try {
      await enqueueJob('sweep', { sweepId: s.id });
      toast.show(`Sweep "${s.name}" started.`, 'info');
    } catch (err) {
      toast.show(`Could not start sweep: ${(err as Error).message}`, 'error');
    } finally {
      setRunning(null);
    }
  }

  async function remove(s: SweepWithId): Promise<void> {
    if (!confirm(`Delete sweep "${s.name}"? Leads it found are kept.`)) return;
    try {
      await deleteDoc(sweepDoc(s.id));
      toast.show(`Deleted "${s.name}".`, 'info');
    } catch (err) {
      toast.show(`Delete failed: ${(err as Error).message}`, 'error');
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sweeps</h1>
        <Button variant="primary" onClick={openCreate}>
          + New sweep
        </Button>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-text-dim">loading…</p>
      ) : sweeps.length === 0 ? (
        <EmptyState
          title="No sweeps yet. Create one to start finding leads."
          action={
            <Button variant="primary" onClick={openCreate}>
              + New sweep
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sweeps.map((s) => (
            <SweepCard
              key={s.id}
              sweep={s}
              running={running === s.id}
              onRun={() => void runNow(s)}
              onEdit={() => openEdit(s)}
              onDelete={() => void remove(s)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SweepFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={(name) => {
            setShowForm(false);
            toast.show(`Saved "${name}".`, 'success');
          }}
        />
      )}
    </div>
  );
}

function SweepCard({
  sweep,
  running,
  onRun,
  onEdit,
  onDelete,
}: {
  sweep: SweepWithId;
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{sweep.name}</h2>
          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-dim">
            {sweep.schedule}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-dim">
          {countryName(sweep.country)} · {sweep.region || '—'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {sweep.niches.map((n) => (
          <span key={n} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-dim">
            {n}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-2 text-center">
        <Stat label="Found" value={sweep.stats.totalFound} />
        <Stat label="No site" value={sweep.stats.noWebsite} />
        <Stat label="New" value={sweep.stats.newLastRun} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-dim">
          {sweep.lastRunAt ? `ran ${formatRelative(sweep.lastRunAt)}` : 'never run'}
        </span>
        <div className="flex gap-1.5">
          <Button onClick={onEdit} className="px-2 py-1.5 text-xs">
            Edit
          </Button>
          <Button variant="danger" onClick={onDelete} className="px-2 py-1.5 text-xs">
            Delete
          </Button>
          <Button variant="primary" onClick={onRun} disabled={running} className="px-2 py-1.5 text-xs">
            {running ? 'Starting…' : 'Run now'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-dim">{label}</div>
    </div>
  );
}

function SweepFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: SweepWithId | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          country: editing.country,
          region: editing.region,
          niches: editing.niches,
          schedule: editing.schedule,
        }
      : BLANK_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = form.name.trim() && form.region.trim() && form.niches.length > 0;

  async function save(): Promise<void> {
    if (!valid) {
      setError('Name, region and at least one niche are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateDoc(sweepDoc(editing.id), {
          name: form.name.trim(),
          country: form.country,
          region: form.region.trim(),
          niches: form.niches,
          schedule: form.schedule,
        });
      } else {
        const newSweep: Sweep = {
          name: form.name.trim(),
          country: form.country,
          region: form.region.trim(),
          niches: form.niches,
          schedule: form.schedule,
          lastRunAt: null,
          stats: { totalFound: 0, noWebsite: 0, newLastRun: 0 },
        };
        await addDoc(sweepsCol(), newSweep);
      }
      onSaved(form.name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface p-5 sm:rounded-xl">
        <h2 className="mb-4 text-base font-semibold">{editing ? 'Edit sweep' : 'New sweep'}</h2>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Novi Sad dentists"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Country</label>
              <select
                className={inputClass}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                {EUROPEAN_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Region / city</label>
              <input
                className={inputClass}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="e.g. Novi Sad"
              />
            </div>
          </div>

          <NicheMultiSelect
            selected={form.niches}
            onChange={(niches) => setForm({ ...form, niches })}
          />

          <div>
            <label className={labelClass}>Schedule</label>
            <select
              className={inputClass}
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value as SweepSchedule })}
            >
              <option value="manual">Manual (run on demand)</option>
              <option value="weekly">Weekly (Sunday 06:00 CET)</option>
            </select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !valid}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
