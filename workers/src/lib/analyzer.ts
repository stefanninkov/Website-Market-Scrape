/**
 * Playwright site analyzer (SPEC §6). One shared browser, honest UA, 375px
 * viewport, 20s navigation timeout, 2s spacing between sites (CLAUDE.md
 * politeness). Gathers raw observations for the pure scorer plus scraped
 * emails. Errors never throw past analyze() — they map to unreachable.
 */

import { chromium, type Browser } from 'playwright';
import {
  detectTechStack,
  extractCopyrightYear,
  type SiteObservations,
} from '@wms/shared';
import { fetchRobots } from './robots.js';

// Honest identification (CLAUDE.md). Includes a normal browser token so sites
// render as they would for a visitor, plus our name for transparency.
const USER_AGENT =
  'Mozilla/5.0 (compatible; FlowDev-WebsiteMarketScrape/0.1; +https://flowdev.example)';

const NAV_TIMEOUT_MS = 20_000;
const POLITE_DELAY_MS = 2_000;
const EMAIL_SUBPAGES = ['/kontakt', '/contact', '/impressum', '/o-nama'];
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PARKED_MARKERS = [
  'domain is for sale',
  'buy this domain',
  'this domain is parked',
  'domain parking',
  'sedoparking',
  'godaddy.com/domainsearch',
];

/** PSI is added by the handler; the analyzer returns everything else. */
export type RawObservations = Omit<SiteObservations, 'pagespeedMobile'>;

export interface AnalysisResult {
  observations: RawObservations;
  emails: string[];
}

export interface SiteAnalyzer {
  analyze(rawUrl: string): Promise<AnalysisResult>;
  close(): Promise<void>;
}

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function createPlaywrightAnalyzer(): SiteAnalyzer {
  let browserPromise: Promise<Browser> | null = null;

  function getBrowser(): Promise<Browser> {
    if (!browserPromise) {
      // Optional pinned binary (e.g. a VPS image with a specific Chromium).
      // Defaults to Playwright's bundled browser.
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
      browserPromise = chromium.launch({ headless: true, executablePath });
    }
    return browserPromise;
  }

  async function analyze(rawUrl: string): Promise<AnalysisResult> {
    const url = normalizeUrl(rawUrl);
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 375, height: 800 },
      ignoreHTTPSErrors: true, // load anyway; SSL validity checked separately
    });

    const emails = new Set<string>();
    let obs: RawObservations = {
      isHttps: url.startsWith('https://'),
      sslValid: false,
      unreachable: true,
      parked: false,
      hasViewportMeta: false,
      hasHorizontalOverflow: false,
      copyrightYear: null,
      techStack: [],
      lastModifiedHeader: null,
    };

    try {
      const page = await context.newPage();
      const response = await page
        .goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
        .catch(() => null);

      if (response) {
        const finalUrl = page.url();
        obs.isHttps = finalUrl.startsWith('https://');
        obs.unreachable = false;
        obs.lastModifiedHeader = response.headers()['last-modified'] ?? null;

        // SSL validity: securityDetails present on a good https handshake.
        if (obs.isHttps) {
          const sec = await response.securityDetails().catch(() => null);
          obs.sslValid = sec !== null;
        }

        const html = await page.content();
        const bodyText = (await page.evaluate(() => document.body?.innerText ?? '')) || '';
        const lower = (bodyText + ' ' + html).toLowerCase();
        obs.parked = PARKED_MARKERS.some((m) => lower.includes(m));

        obs.hasViewportMeta = (await page.$('meta[name="viewport"]')) !== null;
        obs.hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 4,
        );
        const generatorMeta = await page
          .$eval('meta[name="generator"]', (el) => el.getAttribute('content'))
          .catch(() => null);
        obs.techStack = detectTechStack({ html, generatorMeta });
        obs.copyrightYear = extractCopyrightYear(bodyText, new Date().getFullYear());

        collectEmails(html, bodyText, emails);

        // Secondary pages for email scraping, robots-permitting (SPEC §11).
        if (!obs.parked) {
          const origin = new URL(finalUrl).origin;
          const robots = await fetchRobots(origin, USER_AGENT);
          for (const sub of EMAIL_SUBPAGES) {
            if (emails.size > 0) break; // one good address is enough
            if (!robots.isAllowed(sub)) continue;
            await delay(POLITE_DELAY_MS);
            const subResp = await page
              .goto(origin + sub, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
              .catch(() => null);
            if (subResp && subResp.ok()) {
              const subHtml = await page.content();
              const subText = (await page.evaluate(() => document.body?.innerText ?? '')) || '';
              collectEmails(subHtml, subText, emails);
            }
          }
        }
      }
    } finally {
      await context.close();
    }

    // Space out consecutive sites (politeness).
    await delay(POLITE_DELAY_MS);
    return { observations: obs, emails: [...emails] };
  }

  async function close(): Promise<void> {
    if (browserPromise) {
      const b = await browserPromise;
      await b.close();
      browserPromise = null;
    }
  }

  return { analyze, close };
}

function collectEmails(html: string, text: string, into: Set<string>): void {
  for (const src of [html, text]) {
    const matches = src.match(EMAIL_RE);
    if (!matches) continue;
    for (const raw of matches) {
      const email = raw.toLowerCase();
      // Skip obvious asset filenames caught by the regex.
      if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i.test(email)) continue;
      into.add(email);
    }
  }
}
