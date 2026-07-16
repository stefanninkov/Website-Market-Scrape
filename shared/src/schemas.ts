/**
 * Zod schemas for everything that crosses a trust boundary (CLAUDE.md rule:
 * all external data — Places responses, Claude JSON outputs, scraped values —
 * is validated before touching Firestore).
 *
 * Also includes schemas for our own Firestore docs so reads can be validated
 * defensively where it matters (workers).
 */

import { z } from 'zod';
import type { TimestampLike } from './types.js';

/** Structural check that works for both web and admin SDK Timestamps. */
export const timestampSchema = z.custom<TimestampLike>(
  (v): v is TimestampLike =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as TimestampLike).seconds === 'number' &&
    typeof (v as TimestampLike).nanoseconds === 'number' &&
    typeof (v as TimestampLike).toDate === 'function',
  { message: 'Expected a Firestore Timestamp' },
);

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const websiteTypeSchema = z.enum(['none', 'facebook', 'instagram', 'real', 'unknown']);
export const leadStageSchema = z.enum([
  'new',
  'qualified',
  'contacted',
  'replied',
  'won',
  'lost',
  'ignored',
]);
export const analysisStatusSchema = z.enum(['pending', 'done', 'failed', 'skipped']);
export const emailSourceSchema = z.enum(['places', 'site_scrape', 'manual']);
export const previewStatusSchema = z.enum(['none', 'generating', 'ready', 'failed']);
export const jobTypeSchema = z.enum(['sweep', 'analyze', 'generate_email', 'generate_preview']);
export const jobStatusSchema = z.enum(['queued', 'running', 'done', 'failed', 'blocked_budget']);
export const eventTypeSchema = z.enum(['open', 'reply', 'sent', 'bounce', 'preview_view']);
export const templateIdSchema = z.enum([
  'minimal-light',
  'bold-dark',
  'warm-local',
  'corporate-clean',
]);
export const meteredApiSchema = z.enum(['places', 'anthropic']);

// ---------------------------------------------------------------------------
// Lead + subobjects
// ---------------------------------------------------------------------------

export const analysisChecksSchema = z.object({
  https: z.boolean(),
  responsive: z.boolean(),
  viewportMeta: z.boolean(),
  copyrightYear: z.number().int().nullable(),
  techStack: z.array(z.string()),
  pagespeedMobile: z.number().nullable(),
  sslValid: z.boolean(),
  lastModifiedHeader: z.string().nullable(),
});

export const leadAnalysisSchema = z.object({
  status: analysisStatusSchema,
  score: z.number().min(0).max(100),
  checks: analysisChecksSchema,
  reasons: z.array(z.string()),
  analyzedAt: timestampSchema,
});

export const outreachDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  generatedAt: timestampSchema,
});

export const leadOutreachSchema = z.object({
  threadId: z.string().nullable(),
  lastSentAt: timestampSchema.nullable(),
  opens: z.number().int().min(0),
  lastOpenAt: timestampSchema.nullable(),
  replied: z.boolean(),
  followUpDue: timestampSchema.nullable(),
  draft: outreachDraftSchema.nullable(),
});

export const previewServiceSchema = z.object({
  title: z.string().min(1),
  blurb: z.string().min(1),
});

export const previewCopySchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  about: z.string().min(1),
  services: z.array(previewServiceSchema).min(3).max(6),
  ctaLabel: z.string().min(1),
  metaDescription: z.string().min(1),
});

export const leadPreviewSchema = z.object({
  status: previewStatusSchema,
  slug: z.string().nullable(),
  url: z.string().nullable(),
  templateId: templateIdSchema.nullable(),
  copy: previewCopySchema.nullable(),
  generatedAt: timestampSchema.nullable(),
  views: z.number().int().min(0),
  lastViewAt: timestampSchema.nullable(),
});

export const leadSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  country: z.string().length(2),
  region: z.string(),
  address: z.string(),
  phone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  websiteType: websiteTypeSchema,
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  firstSeenAt: timestampSchema,
  lastSeenAt: timestampSchema,
  isNewBusiness: z.boolean(),
  analysis: leadAnalysisSchema.nullable(),
  stage: leadStageSchema,
  notes: z.string(),
  email: z.string().nullable(),
  emailSource: emailSourceSchema.nullable(),
  outreach: leadOutreachSchema,
  preview: leadPreviewSchema,
});

// ---------------------------------------------------------------------------
// Sweep / Job / Event
// ---------------------------------------------------------------------------

export const sweepSchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2),
  region: z.string().min(1),
  niches: z.array(z.string().min(1)).min(1),
  schedule: z.enum(['weekly', 'manual']),
  lastRunAt: timestampSchema.nullable(),
  stats: z.object({
    totalFound: z.number().int().min(0),
    noWebsite: z.number().int().min(0),
    newLastRun: z.number().int().min(0),
  }),
});

export const jobPayloadSchema = z.object({
  sweepId: z.string().optional(),
  placeId: z.string().optional(),
  templateId: templateIdSchema.optional(),
  steering: z.string().optional(),
});

export const jobSchema = z.object({
  type: jobTypeSchema,
  payload: jobPayloadSchema,
  status: jobStatusSchema,
  createdAt: timestampSchema,
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
  error: z.string().nullable(),
});

export const appEventSchema = z.object({
  leadId: z.string().min(1),
  type: eventTypeSchema,
  at: timestampSchema,
  meta: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

// ---------------------------------------------------------------------------
// config/* docs
// ---------------------------------------------------------------------------

export const budgetCounterSchema = z.object({
  monthlyLimitUsd: z.number().min(0),
  spentUsd: z.number().min(0),
});

export const apiBudgetSchema = z.object({
  places: budgetCounterSchema,
  anthropic: budgetCounterSchema,
  resetAt: timestampSchema,
});

export const toneGuideSchema = z.object({ text: z.string() });

export const nichesConfigSchema = z.object({ presets: z.array(z.string()) });

export const identitySchema = z.object({
  businessName: z.string(),
  fullName: z.string(),
  address: z.string(),
  calLink: z.string(),
  emailSignature: z.string(),
});

export const gmailConfigSchema = z.object({
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenExpiry: z.number().nullable(),
  watchExpiration: z.number().nullable(),
  historyId: z.string().nullable(),
  emailAddress: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// AI output contracts (SPEC §7/§8) — used to validate Claude JSON defensively
// ---------------------------------------------------------------------------

export const emailDraftOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});
