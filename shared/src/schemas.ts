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
export const jobTypeSchema = z.enum([
  'sweep',
  'analyze',
  'generate_email',
  'generate_preview',
  'qualify',
  'research',
  'agent_outreach',
  'classify_reply',
]);
export const jobStatusSchema = z.enum(['queued', 'running', 'done', 'failed', 'blocked_budget']);
export const eventTypeSchema = z.enum([
  'open',
  'reply',
  'sent',
  'bounce',
  'preview_view',
  'qualified',
  'discarded',
  'agent_run',
  'reply_classified',
]);
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
  // nullish + transform so leads written before this field existed still parse.
  openingHours: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? null),
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
  agentic: z.boolean().optional(),
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

export const dailyCounterSchema = z.object({
  key: z.string(),
  spentUsd: z.number().min(0),
});

export const apiBudgetSchema = z.object({
  places: budgetCounterSchema,
  anthropic: budgetCounterSchema,
  resetAt: timestampSchema,
  // Absent on budget docs written before v3.
  agent: budgetCounterSchema.optional(),
  agentDay: dailyCounterSchema.optional(),
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

// ---------------------------------------------------------------------------
// Agent layer (AGENTS.md). These schemas are the enforcement point for the
// rules CLAUDE.md says must live in code rather than in a prompt.
// ---------------------------------------------------------------------------

export const agentIdSchema = z.enum(['qualifier', 'researcher', 'outreach', 'preview']);
export const agentRunStatusSchema = z.enum([
  'done',
  'capped',
  'failed',
  'blocked_budget',
  'aborted',
]);
export const verdictSchema = z.enum(['qualified', 'discard', 'insufficient_data']);
export const siteVerdictSchema = z.enum(['none', 'broken', 'dated', 'adequate', 'good']);
export const sizeProxySchema = z.enum(['micro', 'small', 'medium', 'unknown']);

/**
 * AGENTS.md §4: "A claim with no source is a validation failure, not a
 * warning." Both fields are non-empty after trimming, so whitespace does not
 * satisfy the rule.
 */
export const evidenceSchema = z.object({
  claim: z.string().trim().min(1, 'evidence.claim must not be empty'),
  source: z.string().trim().min(1, 'every claim needs a source (url, screenshot path, or measured value)'),
});

export const qualificationSignalsSchema = z.object({
  alive: z.boolean(),
  reachable: z.boolean(),
  siteVerdict: siteVerdictSchema,
  sizeProxy: sizeProxySchema,
  isChain: z.boolean(),
});

export const qualificationSchema = z
  .object({
    verdict: verdictSchema,
    fitScore: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1),
    signals: qualificationSignalsSchema,
    disqualifiers: z.array(z.string().trim().min(1)),
    evidence: z.array(evidenceSchema).min(1, 'at least one piece of evidence is required'),
  })
  .superRefine((q, ctx) => {
    // "disqualifiers: empty when qualified" (AGENTS.md §4).
    if (q.verdict === 'qualified' && q.disqualifiers.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['disqualifiers'],
        message: 'disqualifiers must be empty when verdict is qualified',
      });
    }
    if (q.verdict === 'discard' && q.disqualifiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['disqualifiers'],
        message: 'a discard must name at least one disqualifier',
      });
    }
  });

export const painSeveritySchema = z.enum(['high', 'medium', 'low']);

export const painPointSchema = z.object({
  claim: z.string().trim().min(1),
  // AGENTS.md §5 / WEB-STANDARD H11: no evidence, no claim.
  evidence: z.string().trim().min(1, 'painPoints[].evidence is required and non-empty'),
  severity: painSeveritySchema,
});

export const researchSchema = z.object({
  ownerName: z.string().nullable(),
  ownerSource: z.string().nullable(),
  summary: z.string().trim().min(1),
  services: z.array(z.string()),
  differentiators: z.array(z.string()),
  painPoints: z.array(painPointSchema),
  reviewThemes: z.object({
    praised: z.array(z.string()),
    complained: z.array(z.string()),
  }),
  socials: z.array(
    z.object({
      platform: z.string(),
      url: z.string(),
      lastActiveAt: z.string().nullable(),
    }),
  ),
  openingHours: z.record(z.string()).nullable(),
  competitorNote: z.string().nullable(),
}).superRefine((r, ctx) => {
  // "Owner name is nullable and stays null unless found" — a name without a
  // source is a guess, and a wrong guess kills the email (AGENTS.md §5).
  if (r.ownerName !== null && (r.ownerSource === null || r.ownerSource.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ownerSource'],
      message: 'ownerName requires ownerSource',
    });
  }
});

export const leadAgentStateSchema = z.object({
  lastRunAt: timestampSchema.nullable(),
  lastRunId: z.string().nullable(),
  locked: z.boolean(),
  lockReason: z.string().nullable(),
});

export const agentRunSchema = z.object({
  agentId: agentIdSchema,
  leadId: z.string().min(1),
  status: agentRunStatusSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  steps: z.number().int().min(0),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
  costUsd: z.number().min(0),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  error: z.string().nullable(),
  outputRef: z.string().nullable(),
});

export const agentStepSchema = z.object({
  role: z.enum(['model', 'tool']),
  toolName: z.string().nullable(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  at: timestampSchema,
  tokens: z.number().int().min(0),
});

export const agentCapsSchema = z.object({
  maxSteps: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxSeconds: z.number().int().positive(),
});

export const agentsConfigSchema = z.object({
  enabled: z.boolean(),
  qualifier: z.boolean(),
  researcher: z.boolean(),
  outreach: z.boolean(),
  preview: z.boolean(),
  autoQualifyOnAnalyze: z.boolean(),
  highValueNiches: z.array(z.string()),
  monthlyAgentBudgetUsd: z.number().min(0),
  perRun: z.object({
    qualifier: agentCapsSchema,
    researcher: agentCapsSchema,
    outreach: agentCapsSchema,
    preview: agentCapsSchema,
  }),
});

export const suppressionSchema = z.object({
  email: z.string().min(1),
  reason: z.string(),
  at: timestampSchema,
  leadId: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Preview composition engine (PREVIEW-SYSTEM.md §2, §3, §5.4, §7)
// ---------------------------------------------------------------------------

export const artDirectionIdSchema = z.enum([
  'editorial-warm',
  'clinical-calm',
  'industrial-bold',
  'luxe-dark',
  'fresh-utility',
  'gallery-mono',
  'heritage-serif',
  'soft-rounded',
  'corporate-navy',
  'neon-night',
]);

export const sectionTypeSchema = z.enum([
  'hero',
  'proofstrip',
  'services',
  'gallery',
  'about',
  'reviews',
  'hours',
  'location',
  'primaryModule',
  'faq',
  'ctaBand',
  'footer',
]);

export const primaryModuleSchema = z.enum(['book', 'reserve', 'call']);

export const sectionInstanceSchema = z.object({
  type: sectionTypeSchema,
  variant: z.string().min(1),
  data: z.record(z.unknown()),
});

/** §5.4: if a licence cannot be recorded, the image is not used. */
export const imageLicenceSchema = z.object({
  source: z.string().min(1),
  url: z.string().min(1),
  licence: z.string().min(1),
  attribution: z.string(),
});

export const imagePlanSchema = z.object({
  entries: z.array(imageLicenceSchema.extend({ sectionIndex: z.number().int().min(0) })),
});

export const compositionSpecSchema = z.object({
  artDirection: artDirectionIdSchema,
  sections: z.array(sectionInstanceSchema),
  primaryModule: primaryModuleSchema,
  imagePlan: imagePlanSchema,
  language: z.enum(['sr', 'en']),
});

export const gateResultsSchema = z.object({
  passed: z.array(z.string()),
  failed: z.array(z.string()),
  warned: z.array(z.string()),
});
