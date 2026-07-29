/**
 * The Phase 7 tool catalogue (AGENTS.md §3).
 *
 * Every tool here is read-only (`writes: 'none'`) except `screenshot_page`,
 * which writes an image to Storage. None of them can send anything, write to
 * `config/*`, or delete. That is a property of this file and is asserted by a
 * unit test, so weakening it fails the build rather than passing silently.
 */

import { z } from 'zod';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  PLACES_DETAILS_USD,
  jobPath,
  leadPath,
  type Lead,
} from '@wms/shared';
import { fetchRobots } from '../../lib/robots.js';
import type { PlacesClient } from '../../lib/places.js';
import type { Bucket } from '../../lib/firebase.js';
import { assertBudget, recordSpend } from '../../lib/budget.js';
import { checkUrl } from './url-guard.js';
import type { AgentTool, AnyAgentTool, ToolContext, ToolOutcome } from './registry.js';

/** Honest UA, same posture as the analyzer (CLAUDE.md). */
export const AGENT_USER_AGENT =
  'Mozilla/5.0 (compatible; FlowDevBot/1.0; +https://flowdev.rs/bot)';

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// read_lead
// ---------------------------------------------------------------------------

const readLeadInput = z.object({});

function summariseLead(lead: Lead): string {
  const a = lead.analysis;
  return JSON.stringify(
    {
      name: lead.name,
      category: lead.category,
      country: lead.country,
      region: lead.region,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      websiteUrl: lead.websiteUrl,
      websiteType: lead.websiteType,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      openingHours: lead.openingHours ?? null,
      isNewBusiness: lead.isNewBusiness,
      stage: lead.stage,
      analysis: a
        ? { status: a.status, score: a.score, checks: a.checks, reasons: a.reasons }
        : null,
    },
    null,
    1,
  );
}

export function makeReadLeadTool(): AgentTool<z.infer<typeof readLeadInput>> {
  return {
    name: 'read_lead',
    description:
      'Read the lead record: business name, niche, city, address, phone, email, website URL and type, Google rating and review count, opening hours, and the deterministic analyzer result (score, checks, reasons). Free. Call this first.',
    schema: readLeadInput,
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    writes: 'none',
    cost: { usdPerCall: 0 },
    async run(_input, ctx) {
      const snap = await ctx.db.doc(leadPath(ctx.leadId)).get();
      if (!snap.exists) return { ok: false, text: `Lead ${ctx.leadId} not found.` };
      return { ok: true, text: summariseLead(snap.data() as Lead) };
    },
  };
}

// ---------------------------------------------------------------------------
// fetch_page
// ---------------------------------------------------------------------------

const fetchPageInput = z.object({
  url: z.string().min(1).describe('Absolute http(s) URL'),
});

/** Crude tag strip. Good enough to judge whether a page says anything. */
function extractText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaOf(html: string): Record<string, string> {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
  const generator =
    html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html) ? 'present' : 'absent';
  return { title, description: desc, generator, viewport };
}

export function makeFetchPageTool(): AgentTool<z.infer<typeof fetchPageInput>> {
  return {
    name: 'fetch_page',
    description:
      'Fetch a public web page and return its title, meta description, generator meta, whether a viewport meta exists, and the first few thousand characters of visible text. Honours robots.txt, refuses private addresses, 10s timeout, 2MB cap. Use it to read the lead\'s own site or a public registry page.',
    schema: fetchPageInput,
    jsonSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Absolute http(s) URL' } },
      required: ['url'],
      additionalProperties: false,
    },
    writes: 'none',
    cost: { usdPerCall: 0, maxCallsPerRun: 8 },
    async run(input): Promise<ToolOutcome> {
      const checked = await checkUrl(input.url);
      if (!checked.ok) return { ok: false, text: checked.reason };
      const { url } = checked;

      const robots = await fetchRobots(url.origin, AGENT_USER_AGENT);
      if (!robots.isAllowed(url.pathname)) {
        return { ok: false, text: `robots.txt disallows ${url.pathname} on ${url.origin}.` };
      }

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          headers: { 'User-Agent': AGENT_USER_AGENT },
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (err) {
        return { ok: false, text: `Fetch failed: ${String(err)}` };
      }
      if (!res.ok) return { ok: false, text: `HTTP ${res.status} for ${url.toString()}` };

      const buf = await res.arrayBuffer();
      if (buf.byteLength > FETCH_MAX_BYTES) {
        return { ok: false, text: `Response exceeds the 2MB cap (${buf.byteLength} bytes).` };
      }
      const html = new TextDecoder('utf-8').decode(buf);
      const meta = metaOf(html);
      const text = extractText(html).slice(0, 6000);
      return {
        ok: true,
        text: JSON.stringify({ url: url.toString(), status: res.status, meta, text }, null, 1),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// screenshot_page
// ---------------------------------------------------------------------------

const screenshotInput = z.object({
  url: z.string().min(1),
  viewport: z.union([z.literal(375), z.literal(1440)]),
});

export interface Screenshotter {
  capture(url: string, width: number): Promise<Buffer>;
}

export function makeScreenshotTool(
  shooter: Screenshotter,
  bucket: Bucket,
): AgentTool<z.infer<typeof screenshotInput>> {
  return {
    name: 'screenshot_page',
    description:
      'Screenshot a public page at 375px (phone) or 1440px (desktop) and return the image so you can judge it visually. Use this before deciding a site is bad: the analyzer score is mechanical and a page that scores badly can still look and work fine. Honours robots.txt and refuses private addresses.',
    schema: screenshotInput,
    jsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute http(s) URL' },
        viewport: { type: 'number', enum: [375, 1440], description: '375 for phone, 1440 for desktop' },
      },
      required: ['url', 'viewport'],
      additionalProperties: false,
    },
    writes: 'storage',
    cost: { usdPerCall: 0, maxCallsPerRun: 4 },
    async run(input, ctx): Promise<ToolOutcome> {
      const checked = await checkUrl(input.url);
      if (!checked.ok) return { ok: false, text: checked.reason };
      const { url } = checked;

      const robots = await fetchRobots(url.origin, AGENT_USER_AGENT);
      if (!robots.isAllowed(url.pathname)) {
        return { ok: false, text: `robots.txt disallows ${url.pathname} on ${url.origin}.` };
      }

      let png: Buffer;
      try {
        png = await shooter.capture(url.toString(), input.viewport);
      } catch (err) {
        return { ok: false, text: `Screenshot failed: ${String(err)}` };
      }

      const path = `agent-shots/${ctx.runId}/${input.viewport}-${Date.now()}.png`;
      try {
        await bucket.file(path).save(png, { contentType: 'image/png' });
      } catch (err) {
        return { ok: false, text: `Could not store screenshot: ${String(err)}` };
      }

      return {
        ok: true,
        text: `Screenshot stored at ${path} (${input.viewport}px). Use this path as the source when you cite what you saw.`,
        images: [{ mediaType: 'image/png', base64: png.toString('base64') }],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// places_details
// ---------------------------------------------------------------------------

const placesDetailsInput = z.object({});

export function makePlacesDetailsTool(
  places: PlacesClient,
  lang: 'sr' | 'en',
): AgentTool<z.infer<typeof placesDetailsInput>> {
  return {
    name: 'places_details',
    description:
      'Fetch fresh Google Places details for this business: name, address, phone, website, rating, review count and opening hours. Costs money, so call it only if the lead record is missing something you need.',
    schema: placesDetailsInput,
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    writes: 'none',
    cost: { usdPerCall: PLACES_DETAILS_USD, maxCallsPerRun: 1 },
    async run(_input, ctx): Promise<ToolOutcome> {
      try {
        await assertBudget(ctx.db, 'places');
      } catch (err) {
        return { ok: false, text: `Places budget guard refused the call: ${String(err)}` };
      }
      try {
        const details = await places.placeDetails(ctx.leadId, lang);
        await recordSpend(ctx.db, 'places', PLACES_DETAILS_USD);
        // AGENTS.md §3: Places content is used live and not warehoused. This
        // returns it to the model for this run only; nothing is written back.
        return { ok: true, text: JSON.stringify(details, null, 1) };
      } catch (err) {
        return { ok: false, text: `Places details failed: ${String(err)}` };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// web_search
// ---------------------------------------------------------------------------

const webSearchInput = z.object({ query: z.string().min(1) });

export interface WebSearchProvider {
  search(query: string): Promise<Array<{ title: string; url: string; snippet: string }>>;
}

export function makeWebSearchTool(
  provider: WebSearchProvider | null,
): AgentTool<z.infer<typeof webSearchInput>> {
  return {
    name: 'web_search',
    description:
      'Search the public web. Use it for an owner name, a company registry entry, or to check whether the business is part of a chain. Capped at 3 calls per run.',
    schema: webSearchInput,
    jsonSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
    writes: 'none',
    cost: { usdPerCall: 0.005, maxCallsPerRun: 3 },
    async run(input): Promise<ToolOutcome> {
      // No provider configured is a normal, non-fatal state: the agent should
      // qualify from the site and Places data and lower its confidence, not
      // fail the run.
      if (!provider) {
        return {
          ok: false,
          text: 'web_search is not configured in this deployment. Continue without it and reflect the missing information in your confidence.',
        };
      }
      try {
        const results = await provider.search(input.query);
        if (results.length === 0) return { ok: true, text: 'No results.' };
        return { ok: true, text: JSON.stringify(results.slice(0, 5), null, 1) };
      } catch (err) {
        return { ok: false, text: `Search failed: ${String(err)}` };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// run_analyzer
// ---------------------------------------------------------------------------

const runAnalyzerInput = z.object({});

const ANALYZER_WAIT_MS = 90_000;
const ANALYZER_POLL_MS = 2_000;

export function makeRunAnalyzerTool(): AgentTool<z.infer<typeof runAnalyzerInput>> {
  return {
    name: 'run_analyzer',
    description:
      "Enqueue the deterministic site analyzer for this lead and wait for it (up to 90 seconds). Only useful when the lead has a website but no analysis yet, or the analysis failed. Returns the score, checks and reasons.",
    schema: runAnalyzerInput,
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    writes: 'none',
    cost: { usdPerCall: 0, maxCallsPerRun: 1 },
    async run(_input, ctx): Promise<ToolOutcome> {
      const ref = await ctx.db.collection(COLLECTIONS.jobs).add({
        type: 'analyze',
        payload: { placeId: ctx.leadId },
        status: 'queued',
        createdAt: Timestamp.now(),
        startedAt: null,
        finishedAt: null,
        error: null,
      });

      const deadline = Date.now() + ANALYZER_WAIT_MS;
      for (;;) {
        if (Date.now() >= deadline) {
          return {
            ok: false,
            text: `Analyzer did not finish within 90s (job ${jobPath(ref.id)}). Judge the site from a screenshot instead.`,
          };
        }
        await new Promise((r) => setTimeout(r, ANALYZER_POLL_MS));
        const job = (await ref.get()).data();
        const status = job?.status as string | undefined;
        if (status === 'done') break;
        if (status === 'failed' || status === 'blocked_budget') {
          return { ok: false, text: `Analyzer job ended ${status}: ${String(job?.error ?? '')}` };
        }
      }

      const lead = (await ctx.db.doc(leadPath(ctx.leadId)).get()).data() as Lead | undefined;
      if (!lead?.analysis) return { ok: false, text: 'Analyzer finished but wrote no analysis.' };
      return { ok: true, text: JSON.stringify(lead.analysis, null, 1) };
    },
  };
}

// ---------------------------------------------------------------------------
// Catalogue assembly
// ---------------------------------------------------------------------------

export interface ToolDeps {
  db: Firestore;
  places: PlacesClient;
  lang: 'sr' | 'en';
  shooter: Screenshotter | null;
  bucket: Bucket | null;
  search: WebSearchProvider | null;
}

/** The tools A1 is given (AGENTS.md §3, Phase 7 row set). */
export function qualifierTools(deps: ToolDeps): AnyAgentTool[] {
  const tools: AnyAgentTool[] = [
    makeReadLeadTool(),
    makeFetchPageTool(),
    makePlacesDetailsTool(deps.places, deps.lang),
    makeWebSearchTool(deps.search),
    makeRunAnalyzerTool(),
  ];
  if (deps.shooter && deps.bucket) {
    tools.push(makeScreenshotTool(deps.shooter, deps.bucket));
  }
  return tools;
}
