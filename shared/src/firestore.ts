/**
 * SDK-agnostic Firestore helpers: collection names, doc paths, and validated
 * parsing of snapshot data. Both the web SDK (app) and admin SDK (functions,
 * workers) call these with their own snapshot objects; the helpers only rely
 * on structure shared by both SDKs.
 *
 * CLAUDE.md rule: all Firestore access goes through typed helpers here.
 */

import type { z } from 'zod';
import {
  apiBudgetSchema,
  appEventSchema,
  gmailConfigSchema,
  identitySchema,
  jobSchema,
  leadSchema,
  nichesConfigSchema,
  sweepSchema,
  toneGuideSchema,
} from './schemas.js';
import type {
  ApiBudget,
  AppEvent,
  GmailConfig,
  Identity,
  Job,
  Lead,
  NichesConfig,
  Sweep,
  ToneGuide,
} from './types.js';

// ---------------------------------------------------------------------------
// Collection + doc paths
// ---------------------------------------------------------------------------

export const COLLECTIONS = {
  leads: 'leads',
  sweeps: 'sweeps',
  jobs: 'jobs',
  events: 'events',
  config: 'config',
} as const;

export const CONFIG_DOCS = {
  apiBudget: 'apiBudget',
  toneGuide: 'toneGuide',
  niches: 'niches',
  gmail: 'gmail',
  identity: 'identity',
} as const;

export const leadPath = (placeId: string): string => `${COLLECTIONS.leads}/${placeId}`;
export const sweepPath = (sweepId: string): string => `${COLLECTIONS.sweeps}/${sweepId}`;
export const jobPath = (jobId: string): string => `${COLLECTIONS.jobs}/${jobId}`;
export const eventPath = (eventId: string): string => `${COLLECTIONS.events}/${eventId}`;
export const configPath = (doc: keyof typeof CONFIG_DOCS): string =>
  `${COLLECTIONS.config}/${CONFIG_DOCS[doc]}`;

// ---------------------------------------------------------------------------
// Validated parsing
// ---------------------------------------------------------------------------

/** Minimal structural view of a DocumentSnapshot common to both SDKs. */
export interface SnapshotLike {
  readonly id: string;
  data(): unknown;
}

export class FirestoreParseError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: string,
  ) {
    super(`Invalid Firestore document at ${path}: ${issues}`);
    this.name = 'FirestoreParseError';
  }
}

function parseWith<T>(schema: z.ZodType<T>, snap: SnapshotLike, kind: string): T {
  const data = snap.data();
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new FirestoreParseError(`${kind}/${snap.id}`, result.error.message);
  }
  return result.data;
}

export const parseLead = (snap: SnapshotLike): Lead =>
  parseWith(leadSchema, snap, COLLECTIONS.leads);
export const parseSweep = (snap: SnapshotLike): Sweep =>
  parseWith(sweepSchema, snap, COLLECTIONS.sweeps);
export const parseJob = (snap: SnapshotLike): Job => parseWith(jobSchema, snap, COLLECTIONS.jobs);
export const parseEvent = (snap: SnapshotLike): AppEvent =>
  parseWith(appEventSchema, snap, COLLECTIONS.events);
export const parseApiBudget = (snap: SnapshotLike): ApiBudget =>
  parseWith(apiBudgetSchema, snap, COLLECTIONS.config);
export const parseToneGuide = (snap: SnapshotLike): ToneGuide =>
  parseWith(toneGuideSchema, snap, COLLECTIONS.config);
export const parseNichesConfig = (snap: SnapshotLike): NichesConfig =>
  parseWith(nichesConfigSchema, snap, COLLECTIONS.config);
export const parseIdentity = (snap: SnapshotLike): Identity =>
  parseWith(identitySchema, snap, COLLECTIONS.config);
export const parseGmailConfig = (snap: SnapshotLike): GmailConfig =>
  parseWith(gmailConfigSchema, snap, COLLECTIONS.config);

// ---------------------------------------------------------------------------
// Defaults for new docs
// ---------------------------------------------------------------------------

export const DEFAULT_NICHE_PRESETS: string[] = [
  // Trades
  'fencing',
  'construction',
  'roofing',
  'electricians',
  'plumbers',
  'auto repair',
  'car detailing',
  'landscaping',
  // Hospitality
  'restaurants',
  'cafes',
  'bakeries',
  'hair salons',
  'beauty salons',
  'barbershops',
  'gyms',
  'hotels',
  'guesthouses',
  // Professional
  'dentists',
  'physiotherapists',
  'lawyers',
  'accountants',
  'notaries',
  'veterinary clinics',
  'private clinics',
  // Other
  'real estate agencies',
  'driving schools',
  'wedding services',
  'photographers',
  'cleaning services',
];

/** Fresh outreach subobject for a new lead. */
export const emptyOutreach = (): Lead['outreach'] => ({
  threadId: null,
  lastSentAt: null,
  opens: 0,
  lastOpenAt: null,
  replied: false,
  followUpDue: null,
  draft: null,
});

/** Fresh preview subobject for a new lead. */
export const emptyPreview = (): Lead['preview'] => ({
  status: 'none',
  slug: null,
  url: null,
  templateId: null,
  copy: null,
  generatedAt: null,
  views: 0,
  lastViewAt: null,
});
