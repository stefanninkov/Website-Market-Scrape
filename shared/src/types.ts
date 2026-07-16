/**
 * Single source of types for the whole project (SPEC §4).
 * Imported by app (web SDK), functions and workers (admin SDK).
 *
 * Firestore Timestamp classes differ between the web and admin SDKs, so
 * everything here is typed against the structural TimestampLike interface
 * that both satisfy.
 */

export interface TimestampLike {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export type WebsiteType = 'none' | 'facebook' | 'instagram' | 'real' | 'unknown';

export type LeadStage =
  | 'new'
  | 'qualified'
  | 'contacted'
  | 'replied'
  | 'won'
  | 'lost'
  | 'ignored';

export type AnalysisStatus = 'pending' | 'done' | 'failed' | 'skipped';

export interface AnalysisChecks {
  https: boolean;
  responsive: boolean;
  viewportMeta: boolean;
  copyrightYear: number | null;
  techStack: string[];
  pagespeedMobile: number | null;
  sslValid: boolean;
  lastModifiedHeader: string | null;
}

export interface LeadAnalysis {
  status: AnalysisStatus;
  score: number; // 0-100
  checks: AnalysisChecks;
  reasons: string[]; // plain-English findings, feed email + preview copy
  analyzedAt: TimestampLike;
}

export type EmailSource = 'places' | 'site_scrape' | 'manual';

export interface OutreachDraft {
  subject: string;
  body: string;
  generatedAt: TimestampLike;
}

export interface LeadOutreach {
  threadId: string | null;
  lastSentAt: TimestampLike | null;
  opens: number;
  lastOpenAt: TimestampLike | null;
  replied: boolean;
  followUpDue: TimestampLike | null;
  draft: OutreachDraft | null;
}

export type PreviewStatus = 'none' | 'generating' | 'ready' | 'failed';

export interface LeadPreview {
  status: PreviewStatus;
  slug: string | null; // /p/{slug}
  url: string | null;
  templateId: TemplateId | null;
  copy: PreviewCopy | null;
  generatedAt: TimestampLike | null;
  views: number; // logged by servePreview
  lastViewAt: TimestampLike | null;
}

/** Doc ID = Google place_id (free dedupe). Collection: leads */
export interface Lead {
  placeId: string;
  name: string;
  category: string;
  country: string; // ISO 3166-1 alpha-2
  region: string;
  address: string;
  phone: string | null;
  websiteUrl: string | null;
  websiteType: WebsiteType;
  rating: number | null;
  reviewCount: number | null;
  firstSeenAt: TimestampLike;
  lastSeenAt: TimestampLike;
  isNewBusiness: boolean;
  analysis: LeadAnalysis | null;
  stage: LeadStage;
  notes: string;
  email: string | null;
  emailSource: EmailSource | null;
  outreach: LeadOutreach;
  preview: LeadPreview;
}

// ---------------------------------------------------------------------------
// Sweeps
// ---------------------------------------------------------------------------

export type SweepSchedule = 'weekly' | 'manual';

export interface SweepStats {
  totalFound: number;
  noWebsite: number;
  newLastRun: number;
}

/** Collection: sweeps */
export interface Sweep {
  name: string;
  country: string;
  region: string;
  niches: string[];
  schedule: SweepSchedule;
  lastRunAt: TimestampLike | null;
  stats: SweepStats;
}

// ---------------------------------------------------------------------------
// Jobs (Firestore as job queue)
// ---------------------------------------------------------------------------

export type JobType = 'sweep' | 'analyze' | 'generate_email' | 'generate_preview';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked_budget';

export interface JobPayload {
  sweepId?: string;
  placeId?: string;
  templateId?: TemplateId;
  /** Optional freetext steering for email regeneration (SPEC §7). */
  steering?: string;
}

/** Collection: jobs */
export interface Job {
  type: JobType;
  payload: JobPayload;
  status: JobStatus;
  createdAt: TimestampLike;
  startedAt: TimestampLike | null;
  finishedAt: TimestampLike | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Events (append-only)
// ---------------------------------------------------------------------------

export type EventType = 'open' | 'reply' | 'sent' | 'bounce' | 'preview_view';

/** Collection: events */
export interface AppEvent {
  leadId: string;
  type: EventType;
  at: TimestampLike;
  meta: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Preview templates + copy contract (SPEC §8)
// ---------------------------------------------------------------------------

export type TemplateId = 'minimal-light' | 'bold-dark' | 'warm-local' | 'corporate-clean';

export interface PreviewService {
  title: string;
  blurb: string; // ≤15 words
}

export interface PreviewCopy {
  headline: string; // ≤8 words
  subheadline: string; // ≤20 words
  about: string; // 50-80 words
  services: PreviewService[]; // 3-6
  ctaLabel: string; // e.g. "Pozovite nas" / "Get in touch"
  metaDescription: string;
}

// ---------------------------------------------------------------------------
// AI email contract (SPEC §7)
// ---------------------------------------------------------------------------

export interface EmailDraftOutput {
  subject: string;
  body: string;
}

// ---------------------------------------------------------------------------
// config/* docs (SPEC §2, §4)
// ---------------------------------------------------------------------------

export type MeteredApi = 'places' | 'anthropic';

export interface BudgetCounter {
  monthlyLimitUsd: number;
  spentUsd: number;
}

/** Doc: config/apiBudget */
export interface ApiBudget {
  places: BudgetCounter;
  anthropic: BudgetCounter;
  resetAt: TimestampLike;
}

/** Doc: config/toneGuide */
export interface ToneGuide {
  text: string; // markdown, editable in Settings
}

/** Doc: config/niches */
export interface NichesConfig {
  presets: string[];
}

/** Doc: config/identity */
export interface Identity {
  businessName: string;
  fullName: string;
  address: string;
  calLink: string;
  emailSignature: string;
}

/** Doc: config/gmail (owner-only; tokens written by OAuth flow in Phase 3) */
export interface GmailConfig {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null; // epoch ms
  watchExpiration: number | null; // epoch ms, Gmail watch expires every 7 days
  historyId: string | null;
  emailAddress: string | null;
}
