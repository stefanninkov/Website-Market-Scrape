/**
 * Website classification (SPEC §5 step 4). Pure and reusable so the sweep
 * worker and any future UI share one implementation, and so it can be unit
 * tested in isolation (PLAN Phase 2 vitest target).
 */

import type { WebsiteType } from './types.js';

/** Opportunity score assigned directly by websiteType, before analysis. */
export const WEBSITE_TYPE_SCORE: Record<Exclude<WebsiteType, 'unknown'>, number> = {
  none: 100,
  facebook: 95,
  instagram: 95,
  real: 0, // real sites are scored by the analyzer (Phase 2)
};

const FACEBOOK_HOSTS = ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'];
const INSTAGRAM_HOSTS = ['instagram.com', 'instagr.am'];

function hostnameOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostMatches(host: string, needles: string[]): boolean {
  return needles.some((n) => host === n || host.endsWith(`.${n}`));
}

/**
 * Classify a business's website URL (from Places `websiteUri`).
 * - empty / missing → 'none'
 * - facebook / instagram social page → 'facebook' | 'instagram'
 * - a real domain → 'real' (needs the analyzer)
 * - unparseable non-empty value → 'unknown'
 */
export function classifyWebsiteType(url: string | null | undefined): WebsiteType {
  if (url == null || url.trim() === '') return 'none';
  const host = hostnameOf(url);
  if (host === null) return 'unknown';
  if (hostMatches(host, FACEBOOK_HOSTS)) return 'facebook';
  if (hostMatches(host, INSTAGRAM_HOSTS)) return 'instagram';
  return 'real';
}

/** True when this websiteType gets a direct score and skips the analyzer. */
export function isDirectScored(type: WebsiteType): type is 'none' | 'facebook' | 'instagram' {
  return type === 'none' || type === 'facebook' || type === 'instagram';
}
