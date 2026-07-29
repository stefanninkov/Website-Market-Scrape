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
  /**
   * Localized opening-hours lines from Places, `"Day|09:00 – 17:00"`.
   * Optional because leads swept before this field existed don't carry it.
   */
  openingHours?: string[] | null;
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
  /**
   * v3 agent layer (SPEC §14). Optional because every lead written before the
   * agent layer existed lacks them; readers must treat absent as null.
   */
  qualification?: Qualification | null;
  research?: Research | null;
  agent?: LeadAgentState | null;
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

export type JobType =
  | 'sweep'
  | 'analyze'
  | 'generate_email'
  | 'generate_preview'
  // v3 agent layer (SPEC §14, AGENTS.md §8.3)
  | 'qualify'
  | 'research'
  | 'agent_outreach'
  | 'classify_reply';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked_budget';

export interface JobPayload {
  sweepId?: string;
  placeId?: string;
  templateId?: TemplateId;
  /** Optional freetext steering for email regeneration (SPEC §7). */
  steering?: string;
  /**
   * generate_preview only. When false the deterministic render path runs, so
   * the pre-agent behaviour stays available as a fallback (AGENTS.md §8.3).
   */
  agentic?: boolean;
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

export type EventType =
  | 'open'
  | 'reply'
  | 'sent'
  | 'bounce'
  | 'preview_view'
  // v3 agent layer (SPEC §14)
  | 'qualified'
  | 'discarded'
  | 'agent_run'
  | 'reply_classified';

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

/** A single UTC day's spend. `key` is YYYY-MM-DD. */
export interface DailyCounter {
  key: string;
  spentUsd: number;
}

/** Doc: config/apiBudget */
export interface ApiBudget {
  places: BudgetCounter;
  anthropic: BudgetCounter;
  resetAt: TimestampLike;
  /**
   * Agent spend (AGENTS.md §8.4). Optional because budget docs written before
   * v3 do not carry them. The monthly *limit* lives in config/agents.
   */
  agent?: BudgetCounter;
  agentDay?: DailyCounter;
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

// ---------------------------------------------------------------------------
// Agent layer (AGENTS.md). Authoritative over SPEC.md for anything agentic.
// ---------------------------------------------------------------------------

export type AgentId = 'qualifier' | 'researcher' | 'outreach' | 'preview';

/**
 * A run never ends by throwing (AGENTS.md §2.1). `capped` means one of the
 * three bounds tripped; `aborted` means the kill switch or lead lock stopped it.
 */
export type AgentRunStatus = 'done' | 'capped' | 'failed' | 'blocked_budget' | 'aborted';

/** Every claim an agent makes carries a source (AGENTS.md §4, CLAUDE.md). */
export interface Evidence {
  claim: string;
  /** url, Storage screenshot path, measured value, or "places:reviews". */
  source: string;
}

export type Verdict = 'qualified' | 'discard' | 'insufficient_data';
export type SiteVerdict = 'none' | 'broken' | 'dated' | 'adequate' | 'good';
export type SizeProxy = 'micro' | 'small' | 'medium' | 'unknown';

export interface QualificationSignals {
  alive: boolean;
  reachable: boolean;
  siteVerdict: SiteVerdict;
  sizeProxy: SizeProxy;
  isChain: boolean;
}

/** A1 output (AGENTS.md §4). */
export interface Qualification {
  verdict: Verdict;
  /** 0-100, how good a prospect. Distinct from analysis.score (site badness). */
  fitScore: number;
  confidence: number; // 0-1
  rationale: string; // 2-4 sentences, plain language
  signals: QualificationSignals;
  disqualifiers: string[]; // empty when qualified
  evidence: Evidence[];
}

export type PainSeverity = 'high' | 'medium' | 'low';

export interface PainPoint {
  claim: string;
  /** Required and non-empty — no evidence, no claim (AGENTS.md §5). */
  evidence: string;
  severity: PainSeverity;
}

export interface SocialRef {
  platform: string;
  url: string;
  lastActiveAt: string | null;
}

/** A2 output (AGENTS.md §5). Types land now; the agent itself is Phase 9. */
export interface Research {
  ownerName: string | null;
  ownerSource: string | null;
  summary: string; // 40-60 words
  services: string[]; // observed, never assumed
  differentiators: string[];
  painPoints: PainPoint[];
  reviewThemes: { praised: string[]; complained: string[] };
  socials: SocialRef[];
  openingHours: Record<string, string> | null;
  competitorNote: string | null;
}

/** Per-lead agent state (AGENTS.md §8.2). */
export interface LeadAgentState {
  lastRunAt: TimestampLike | null;
  lastRunId: string | null;
  /** true after an `interested` reply — blocks every automated action. */
  locked: boolean;
  lockReason: string | null;
}

/** Collection: agentRuns */
export interface AgentRun {
  agentId: AgentId;
  leadId: string;
  status: AgentRunStatus;
  confidence: number;
  rationale: string;
  steps: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  startedAt: TimestampLike;
  finishedAt: TimestampLike | null;
  error: string | null;
  outputRef: string | null;
}

/** Collection: agentRuns/{runId}/steps */
export interface AgentStep {
  role: 'model' | 'tool';
  toolName: string | null;
  inputSummary: string;
  /** Capped at 4KB (AGENTS.md §2.1). Full artefacts go to Storage. */
  outputSummary: string;
  at: TimestampLike;
  tokens: number;
}

/** The loop's return contract (AGENTS.md §2.1). */
export interface AgentRunResult<T> {
  status: AgentRunStatus;
  output: T | null;
  confidence: number;
  rationale: string;
  steps: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

/** Per-agent bounds. All three are enforced at once; first to trip wins. */
export interface AgentCaps {
  maxSteps: number;
  maxTokens: number;
  maxSeconds: number;
}

/** Doc: config/agents (AGENTS.md §8.1) */
export interface AgentsConfig {
  /** Global kill switch — stops new runs within one poll interval. */
  enabled: boolean;
  qualifier: boolean;
  researcher: boolean;
  outreach: boolean;
  preview: boolean;
  /** Analysis only. Enqueues a qualify job; sends nothing. */
  autoQualifyOnAnalyze: boolean;
  highValueNiches: string[];
  monthlyAgentBudgetUsd: number;
  perRun: Record<AgentId, AgentCaps>;
}

/**
 * Collection: suppression/{emailHash}. Permanent. Checked inside sendEmail
 * itself, not only by the agent (AGENTS.md §6, SPEC §15).
 */
export interface Suppression {
  email: string;
  reason: string;
  at: TimestampLike;
  leadId: string | null;
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
