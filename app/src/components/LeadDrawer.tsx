/**
 * Lead drawer v1 (SPEC §9.3, PLAN Phase 1): details, analysis reasons, notes,
 * manual stage change, manual email field. Slides from the right on desktop
 * (480px), full-screen sheet from the bottom on mobile (DESIGN.md §Layout).
 */

import { useEffect, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import type { LeadStage } from '@wms/shared';
import { leadDoc, type LeadWithId } from '../lib/db';
import { formatRelative } from '../lib/format';
import { useToast } from './Toast';
import {
  Button,
  NewBusinessBadge,
  ScoreBadge,
  STAGE_LABEL,
  STAGES,
  StageChip,
  WebsiteTypeChip,
  inputClass,
  labelClass,
} from './ui';

export default function LeadDrawer({ lead, onClose }: { lead: LeadWithId; onClose: () => void }) {
  const toast = useToast();
  const [notes, setNotes] = useState(lead.notes);
  const [email, setEmail] = useState(lead.email ?? '');

  // Re-sync when the selected lead changes underneath us (live updates).
  useEffect(() => {
    setNotes(lead.notes);
    setEmail(lead.email ?? '');
  }, [lead.id, lead.notes, lead.email]);

  async function saveNotes(): Promise<void> {
    if (notes === lead.notes) return;
    try {
      await updateDoc(leadDoc(lead.id), { notes });
      toast.show('Notes saved.', 'success');
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  async function changeStage(stage: LeadStage): Promise<void> {
    try {
      await updateDoc(leadDoc(lead.id), { stage });
    } catch (err) {
      toast.show(`Stage change failed: ${(err as Error).message}`, 'error');
    }
  }

  async function saveEmail(): Promise<void> {
    const trimmed = email.trim();
    try {
      await updateDoc(leadDoc(lead.id), {
        email: trimmed || null,
        emailSource: trimmed ? 'manual' : null,
      });
      toast.show('Email saved.', 'success');
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  const analysis = lead.analysis;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        className="flex h-full w-full flex-col overflow-y-auto border-l border-border bg-surface sm:max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{lead.name}</h2>
              {lead.isNewBusiness && <NewBusinessBadge />}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-dim">
              {lead.category} · {lead.region}, {lead.country}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 p-4">
          {/* Score + type + stage */}
          <div className="flex flex-wrap items-center gap-3">
            {analysis && (
              <div className="flex items-center gap-1.5">
                <ScoreBadge score={analysis.score} />
                <span className="text-xs text-text-dim">score</span>
              </div>
            )}
            <WebsiteTypeChip type={lead.websiteType} />
            <StageChip stage={lead.stage} />
          </div>

          {/* Contact */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Details</h3>
            <Row label="Address" value={lead.address || '—'} />
            <Row
              label="Phone"
              value={lead.phone ? <a href={`tel:${lead.phone}`} className="text-info">{lead.phone}</a> : '—'}
            />
            <Row
              label="Website"
              value={
                lead.websiteUrl ? (
                  <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="break-all text-info">
                    {lead.websiteUrl}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="Rating"
              value={
                lead.rating != null
                  ? `${lead.rating.toFixed(1)} ★ · ${lead.reviewCount ?? 0} reviews`
                  : 'No rating'
              }
            />
            <Row label="First seen" value={formatRelative(lead.firstSeenAt)} />
          </section>

          {/* Analysis */}
          {analysis && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                Analysis · {analysis.status}
              </h3>

              {analysis.status === 'pending' ? (
                <p className="text-sm text-text-dim">Queued for the analyzer.</p>
              ) : analysis.status === 'failed' ? (
                <p className="text-sm text-danger">
                  {analysis.reasons[0] ?? 'Analysis failed.'}
                </p>
              ) : (
                <>
                  {/* Checks breakdown — only meaningful for analyzed real sites */}
                  {analysis.status === 'done' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Check label="HTTPS" ok={analysis.checks.https} />
                      <Check label="Mobile viewport" ok={analysis.checks.viewportMeta} />
                      <Check label="Responsive" ok={analysis.checks.responsive} />
                      <Check label="Valid SSL" ok={analysis.checks.sslValid} />
                      {analysis.checks.pagespeedMobile != null && (
                        <div className="col-span-2 flex items-center justify-between rounded-md bg-surface-2 px-2 py-1 text-xs">
                          <span className="text-text-dim">PageSpeed mobile</span>
                          <span
                            className={`font-mono ${analysis.checks.pagespeedMobile < 40 ? 'text-danger' : analysis.checks.pagespeedMobile <= 60 ? 'text-warn' : 'text-success'}`}
                          >
                            {analysis.checks.pagespeedMobile}/100
                          </span>
                        </div>
                      )}
                      {analysis.checks.copyrightYear != null && (
                        <div className="col-span-2 flex items-center justify-between rounded-md bg-surface-2 px-2 py-1 text-xs">
                          <span className="text-text-dim">Copyright year</span>
                          <span className="font-mono">{analysis.checks.copyrightYear}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {analysis.checks.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.checks.techStack.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-warn/15 px-1.5 py-0.5 text-[11px] text-warn"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {analysis.reasons.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {analysis.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-dim">No issues found — this site is in good shape.</p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Stage */}
          <section className="space-y-2">
            <label className={labelClass}>Stage</label>
            <select
              className={inputClass}
              value={lead.stage}
              onChange={(e) => void changeStage(e.target.value as LeadStage)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </section>

          {/* Email */}
          <section className="space-y-2">
            <label className={labelClass}>
              Email {lead.emailSource ? `(${lead.emailSource})` : ''}
            </label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@business.com"
              />
              <Button onClick={() => void saveEmail()} disabled={email.trim() === (lead.email ?? '')}>
                Save
              </Button>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              placeholder="Private notes…"
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs">
      <span className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✕'}</span>
      <span className="text-text-dim">{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 shrink-0 text-text-dim">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
    </div>
  );
}
