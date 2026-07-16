/**
 * Niche multi-select: presets (config/niches, fallback to DEFAULT_NICHE_PRESETS)
 * as toggle chips + free-text add (SPEC §9 Sweeps).
 */

import { useMemo, useState } from 'react';
import { DEFAULT_NICHE_PRESETS } from '@wms/shared';
import { nichesDoc } from '../lib/db';
import { useDoc } from '../lib/hooks';
import { inputClass, labelClass } from './ui';

export default function NicheMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (niches: string[]) => void;
}) {
  const ref = useMemo(() => nichesDoc(), []);
  const { data } = useDoc(ref);
  const presets = data?.presets?.length ? data.presets : DEFAULT_NICHE_PRESETS;
  const [freeText, setFreeText] = useState('');

  // Presets plus any custom niches already selected, de-duplicated.
  const all = useMemo(() => {
    const set = new Set<string>([...presets, ...selected]);
    return [...set];
  }, [presets, selected]);

  function toggle(niche: string): void {
    onChange(
      selected.includes(niche) ? selected.filter((n) => n !== niche) : [...selected, niche],
    );
  }

  function addFreeText(): void {
    const niche = freeText.trim().toLowerCase();
    if (niche && !selected.includes(niche)) onChange([...selected, niche]);
    setFreeText('');
  }

  return (
    <div>
      <label className={labelClass}>Niches</label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {all.map((niche) => {
          const on = selected.includes(niche);
          return (
            <button
              key={niche}
              type="button"
              onClick={() => toggle(niche)}
              className={[
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-dim hover:text-text',
              ].join(' ')}
            >
              {niche}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Add a custom niche…"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFreeText();
            }
          }}
        />
        <button
          type="button"
          onClick={addFreeText}
          className="shrink-0 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-dim hover:text-text"
        >
          Add
        </button>
      </div>
    </div>
  );
}
