/**
 * App UI primitives per DESIGN.md §Part 1 (dark, dense, mono for numbers).
 * Colors come only from the @theme palette — no new colors.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LeadStage, WebsiteType } from '@wms/shared';

// --- Score badge (mono; 80-100 accent, 60-79 warn, <60 dim) ---------------

export function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? 'text-accent'
      : score >= 60
        ? 'text-warn'
        : 'text-text-dim';
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${cls}`} title="Opportunity score">
      {score}
    </span>
  );
}

// --- websiteType chip (none danger, fb/ig warn, real dim) ------------------

const WEBSITE_TYPE_LABEL: Record<WebsiteType, string> = {
  none: 'No website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  real: 'Has site',
  unknown: 'Unknown',
};

export function WebsiteTypeChip({ type }: { type: WebsiteType }) {
  const cls =
    type === 'none'
      ? 'bg-danger/15 text-danger'
      : type === 'facebook' || type === 'instagram'
        ? 'bg-warn/15 text-warn'
        : 'bg-surface-2 text-text-dim';
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {WEBSITE_TYPE_LABEL[type]}
    </span>
  );
}

// --- Stage chip ------------------------------------------------------------

const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  contacted: 'Contacted',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
  ignored: 'Ignored',
};

const STAGE_CLASS: Record<LeadStage, string> = {
  new: 'bg-info/15 text-info',
  qualified: 'bg-accent/15 text-accent',
  contacted: 'bg-warn/15 text-warn',
  replied: 'bg-success/15 text-success',
  won: 'bg-success text-accent-ink',
  lost: 'bg-surface-2 text-text-dim',
  ignored: 'bg-surface-2 text-text-dim',
};

export function StageChip({ stage }: { stage: LeadStage }) {
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STAGE_CLASS[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export const STAGES: LeadStage[] = [
  'new',
  'qualified',
  'contacted',
  'replied',
  'won',
  'lost',
  'ignored',
];
export { STAGE_LABEL };

// --- New business badge (accent dot + label) -------------------------------

export function NewBusinessBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent" title="First seen in a recent re-run">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      New
    </span>
  );
}

// --- Buttons ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  ghost: 'border border-border bg-surface-2 text-text hover:bg-border',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};

export function Button({ variant = 'ghost', className = '', ...rest }: ButtonProps) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`} {...rest} />;
}

// --- Inputs ----------------------------------------------------------------

export const inputClass =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-dim focus:border-accent';

export const labelClass = 'mb-1 block text-xs font-medium text-text-dim';

// --- Empty state -----------------------------------------------------------

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-sm text-text-dim">{title}</p>
      {action}
    </div>
  );
}
