/**
 * Lead drawer v1 (SPEC §9.3, PLAN Phase 1): details, analysis reasons, notes,
 * manual stage change, manual email field. Slides from the right on desktop
 * (480px), full-screen sheet from the bottom on mobile (DESIGN.md §Layout).
 */

import { useEffect, useMemo, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import { templateForNiche, type AppEvent, type LeadStage, type TemplateId } from '@wms/shared';
import { leadDoc, leadEventsQuery, type LeadWithId } from '../lib/db';
import { useQuery } from '../lib/hooks';
import { enqueueJob, sendEmail } from '../lib/functions';
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

          {/* Preview site */}
          <PreviewSection lead={lead} />

          {/* Outreach: generate → edit → send */}
          <OutreachSection lead={lead} />

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

          {/* Event timeline */}
          <EventTimeline leadId={lead.id} />
        </div>
      </aside>
    </div>
  );
}

const TEMPLATE_IDS: TemplateId[] = ['minimal-light', 'bold-dark', 'warm-local', 'corporate-clean'];

function PreviewSection({ lead }: { lead: LeadWithId }) {
  const toast = useToast();
  const preview = lead.preview;
  const [template, setTemplate] = useState<TemplateId | ''>('');
  const [busy, setBusy] = useState(false);

  const autoTemplate = templateForNiche(lead.category);
  const effective = template || preview.templateId || autoTemplate;

  async function generate(): Promise<void> {
    setBusy(true);
    try {
      await enqueueJob('generate_preview', {
        placeId: lead.id,
        templateId: effective,
      });
      toast.show(preview.status === 'ready' ? 'Regenerating preview…' : 'Generating preview…', 'info');
    } catch (err) {
      toast.show(`Could not queue preview: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
          Preview site · {preview.status}
        </h3>
        {preview.status === 'ready' && (
          <span className="text-[11px] text-text-dim">
            {preview.views} view{preview.views === 1 ? '' : 's'}
            {preview.lastViewAt ? ` · last ${formatRelative(preview.lastViewAt)}` : ''}
          </span>
        )}
      </div>

      {preview.status === 'ready' && preview.url && (
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-info"
        >
          {preview.url}
        </a>
      )}
      {preview.status === 'failed' && (
        <p className="text-sm text-danger">Preview generation failed — try again.</p>
      )}
      {preview.status === 'generating' && (
        <p className="text-sm text-text-dim">Generating…</p>
      )}

      <div className="flex gap-2">
        <select
          className={inputClass}
          value={effective}
          onChange={(e) => setTemplate(e.target.value as TemplateId)}
        >
          {TEMPLATE_IDS.map((t) => (
            <option key={t} value={t}>
              {t}
              {t === autoTemplate ? ' (auto)' : ''}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          onClick={() => void generate()}
          disabled={busy || preview.status === 'generating'}
          className="shrink-0"
        >
          {preview.status === 'ready' ? 'Regenerate' : 'Generate'}
        </Button>
      </div>
    </section>
  );
}

function OutreachSection({ lead }: { lead: LeadWithId }) {
  const toast = useToast();
  const draft = lead.outreach.draft;
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [steering, setSteering] = useState('');
  const [busy, setBusy] = useState<'generate' | 'send' | null>(null);

  // Sync editor when a freshly generated draft arrives.
  useEffect(() => {
    setSubject(draft?.subject ?? '');
    setBody(draft?.body ?? '');
  }, [draft?.subject, draft?.body]);

  async function generate(): Promise<void> {
    setBusy('generate');
    try {
      await enqueueJob('generate_email', {
        placeId: lead.id,
        ...(steering.trim() ? { steering: steering.trim() } : {}),
      });
      toast.show('Generating draft…', 'info');
    } catch (err) {
      toast.show(`Could not queue generation: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits(): Promise<void> {
    if (!draft) return;
    if (subject === draft.subject && body === draft.body) return;
    try {
      await updateDoc(leadDoc(lead.id), {
        'outreach.draft.subject': subject,
        'outreach.draft.body': body,
      });
    } catch (err) {
      toast.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  async function send(): Promise<void> {
    if (!lead.email) {
      toast.show('Add an email address first.', 'error');
      return;
    }
    if (!confirm(`Send this email to ${lead.email}?`)) return;
    setBusy('send');
    try {
      await saveEdits();
      const result = await sendEmail(lead.id);
      if (result.sentToday > result.softLimit) {
        toast.show(
          `Email sent — but that's ${result.sentToday} today (soft limit ${result.softLimit}). Consider slowing down.`,
          'error',
        );
      } else {
        toast.show('Email sent.', 'success');
      }
    } catch (err) {
      toast.show(`Send failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  const sent = lead.outreach.lastSentAt;

  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Cold email</h3>
        {sent && (
          <span className="text-[11px] text-text-dim">
            sent {formatRelative(sent)} · {lead.outreach.opens} opens
            {lead.outreach.replied ? ' · replied' : ''}
          </span>
        )}
      </div>

      <input
        className={inputClass}
        value={steering}
        onChange={(e) => setSteering(e.target.value)}
        placeholder="Optional steering: e.g. mention their Facebook page, more casual…"
      />
      <Button onClick={() => void generate()} disabled={busy !== null} className="w-full">
        {busy === 'generate' ? 'Queuing…' : draft ? 'Regenerate draft' : 'Generate email'}
      </Button>

      {draft && (
        <div className="space-y-2 pt-1">
          <input
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => void saveEdits()}
            placeholder="Subject"
          />
          <textarea
            className={`${inputClass} min-h-40 resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => void saveEdits()}
            placeholder="Body"
          />
          <Button
            variant="primary"
            onClick={() => void send()}
            disabled={busy !== null}
            className="w-full"
          >
            {busy === 'send' ? 'Sending…' : 'Send via Gmail'}
          </Button>
        </div>
      )}
    </section>
  );
}

const EVENT_LABEL: Record<AppEvent['type'], string> = {
  sent: 'Email sent',
  open: 'Email opened',
  reply: 'Reply received',
  bounce: 'Bounced',
  preview_view: 'Preview viewed',
  qualified: 'Qualified by agent',
  discarded: 'Discarded by agent',
  agent_run: 'Agent run',
  reply_classified: 'Reply classified',
};

function EventTimeline({ leadId }: { leadId: string }) {
  const q = useMemo(() => leadEventsQuery(leadId), [leadId]);
  const { data: events } = useQuery(q);

  if (events.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Activity</h3>
      <ul className="space-y-1">
        {events.map((e) => (
          <li key={e.id} className="flex items-center justify-between text-xs">
            <span>{EVENT_LABEL[e.type]}</span>
            <span className="text-text-dim">{formatRelative(e.at)}</span>
          </li>
        ))}
      </ul>
    </section>
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
