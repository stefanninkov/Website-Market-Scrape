/**
 * Pure site-analysis scoring (SPEC §6). The Playwright worker gathers raw
 * observations from the page; these pure functions turn them into a 0-100
 * opportunity score, plain-English reasons, and the checks object (SPEC §4).
 *
 * Kept pure and dependency-free so the scoring math, tech fingerprinting and
 * copyright-year regex are unit tested in isolation (PLAN Phase 2 vitest).
 */

import type { AnalysisChecks } from './types.js';

/** How stale a copyright year must be to count against a site (SPEC §6). */
export const COPYRIGHT_STALE_YEARS = 3;

/** Point values from the SPEC §6 checks table. */
export const POINTS = {
  noHttps: 25,
  noViewport: 15,
  horizontalOverflow: 15,
  staleCopyright: 10,
  techFingerprint: 10, // per fingerprint
  techFingerprintCap: 20,
  pagespeedVeryLow: 15, // < 40
  pagespeedLow: 8, // 40-60
  unreachable: 30,
} as const;

export const MAX_SCORE = 100;

/** Raw observations gathered by the analyzer worker for one site. */
export interface SiteObservations {
  /** Final URL used a secure scheme. */
  isHttps: boolean;
  /** TLS certificate validated (false on cert errors). */
  sslValid: boolean;
  /** Navigation failed/timed out or the domain is parked. */
  unreachable: boolean;
  parked: boolean;
  /** DOM had a <meta name="viewport">. */
  hasViewportMeta: boolean;
  /** scrollWidth > innerWidth at a 375px viewport. */
  hasHorizontalOverflow: boolean;
  /** Newest year found in footer/copyright text, or null. */
  copyrightYear: number | null;
  /** Human-readable old-tech fingerprints (see detectTechStack). */
  techStack: string[];
  /** PageSpeed mobile score (0-100) or null when skipped. */
  pagespeedMobile: number | null;
  /** Last-Modified response header, or null. */
  lastModifiedHeader: string | null;
}

export interface ScoredAnalysis {
  score: number;
  reasons: string[];
  checks: AnalysisChecks;
}

/**
 * Extract the newest 4-digit year from copyright/footer text.
 * Handles "© 2015", "Copyright 2014-2018", "2019.". Returns the max plausible
 * year (1990..currentYear+1) or null.
 */
export function extractCopyrightYear(text: string, currentYear: number): number | null {
  const years: number[] = [];
  const re = /\b(19[9]\d|20\d\d)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const y = Number(m[1]);
    if (y >= 1990 && y <= currentYear + 1) years.push(y);
  }
  if (years.length === 0) return null;
  return Math.max(...years);
}

interface TechInput {
  html: string;
  generatorMeta: string | null;
}

/**
 * Detect old/free-tier tech fingerprints (SPEC §6). Returns human-readable
 * labels; the caller caps their point contribution.
 */
export function detectTechStack({ html, generatorMeta }: TechInput): string[] {
  const found: string[] = [];
  const h = html.toLowerCase();
  const gen = (generatorMeta ?? '').toLowerCase();

  if (h.includes('/wp-content/') || h.includes('/wp-includes/') || gen.includes('wordpress')) {
    found.push('WordPress (likely an aging theme)');
  }
  // jQuery < 2 (1.x)
  if (/jquery[-/.]1\.\d/.test(h) || /jquery\/1\./.test(h)) {
    found.push('jQuery 1.x (very outdated)');
  }
  // Classic layout tables
  if (h.includes('<table') && (h.includes('cellpadding') || h.includes('cellspacing'))) {
    found.push('Table-based layout (pre-2010 technique)');
  }
  // Flash
  if (h.includes('application/x-shockwave-flash') || h.includes('.swf')) {
    found.push('Adobe Flash (dead technology)');
  }
  // Free-tier site builders
  if (h.includes('parastorage.com') || h.includes('wixstatic') || gen.includes('wix')) {
    found.push('Wix free tier');
  }
  if (h.includes('weebly.com') || gen.includes('weebly')) {
    found.push('Weebly free tier');
  }
  if (h.includes('jimstatic') || h.includes('jimdo') || gen.includes('jimdo')) {
    found.push('Jimdo free tier');
  }
  return found;
}

/** Turn raw observations into score + reasons + checks (SPEC §6 scoring). */
export function scoreSite(obs: SiteObservations, currentYear: number): ScoredAnalysis {
  const reasons: string[] = [];
  let score = 0;

  if (obs.unreachable || obs.parked) {
    score += POINTS.unreachable;
    reasons.push(
      obs.parked
        ? 'Domain is parked — no real website behind it.'
        : 'Website is unreachable — the domain does not load.',
    );
    // When the page never loaded, DOM-based checks are meaningless; return early
    // with just this signal (still capped below).
    return {
      score: Math.min(score, MAX_SCORE),
      reasons,
      checks: buildChecks(obs),
    };
  }

  if (!obs.isHttps || !obs.sslValid) {
    score += POINTS.noHttps;
    reasons.push(
      !obs.isHttps
        ? 'No HTTPS — the site is served over an insecure connection.'
        : 'Invalid SSL certificate — browsers will warn visitors.',
    );
  }

  if (!obs.hasViewportMeta) {
    score += POINTS.noViewport;
    reasons.push('No mobile viewport tag — the page will not scale on phones.');
  }

  if (obs.hasHorizontalOverflow) {
    score += POINTS.horizontalOverflow;
    reasons.push('Content overflows sideways on a phone screen (375px).');
  }

  if (obs.copyrightYear !== null && obs.copyrightYear <= currentYear - COPYRIGHT_STALE_YEARS) {
    score += POINTS.staleCopyright;
    reasons.push(`Copyright footer says ${obs.copyrightYear} — likely unmaintained.`);
  }

  if (obs.techStack.length > 0) {
    const techPoints = Math.min(
      obs.techStack.length * POINTS.techFingerprint,
      POINTS.techFingerprintCap,
    );
    score += techPoints;
    for (const t of obs.techStack) reasons.push(t + '.');
  }

  if (obs.pagespeedMobile !== null) {
    if (obs.pagespeedMobile < 40) {
      score += POINTS.pagespeedVeryLow;
      reasons.push(`PageSpeed mobile ${obs.pagespeedMobile}/100 — very slow on phones.`);
    } else if (obs.pagespeedMobile <= 60) {
      score += POINTS.pagespeedLow;
      reasons.push(`PageSpeed mobile ${obs.pagespeedMobile}/100 — sluggish on phones.`);
    }
  }

  return {
    score: Math.min(score, MAX_SCORE),
    reasons,
    checks: buildChecks(obs),
  };
}

function buildChecks(obs: SiteObservations): AnalysisChecks {
  return {
    https: obs.isHttps && obs.sslValid,
    responsive: obs.hasViewportMeta && !obs.hasHorizontalOverflow,
    viewportMeta: obs.hasViewportMeta,
    copyrightYear: obs.copyrightYear,
    techStack: obs.techStack,
    pagespeedMobile: obs.pagespeedMobile,
    sslValid: obs.sslValid,
    lastModifiedHeader: obs.lastModifiedHeader,
  };
}
