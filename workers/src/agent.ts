/**
 * agent-worker entry — the sixth pm2 process (AGENTS.md §2).
 *
 * Concurrency 1: Playwright is already competing for RAM with the analyzer and
 * preview workers on a CX22. Raise only after measuring.
 *
 * Screenshots reuse the analyzer's Playwright posture (honest UA, single
 * browser). Web search is optional: with no provider configured the tool tells
 * the model to continue without it and lower its confidence, rather than
 * failing runs.
 */

import 'dotenv/config';
import { chromium, type Browser } from 'playwright';
import { initBucket, initFirebase } from './lib/firebase.js';
import { runWorker } from './lib/queue.js';
import { createRawAnthropic } from './lib/anthropic.js';
import { createPlacesClient } from './lib/places.js';
import { makeQualifyHandler } from './handlers/qualify.js';
import { AGENT_USER_AGENT, type Screenshotter } from './agent/tools/index.js';

const db = initFirebase();
const bucket = initBucket();
const anthropic = createRawAnthropic(process.env.ANTHROPIC_API_KEY ?? '');
const places = createPlacesClient(process.env.GOOGLE_PLACES_API_KEY ?? '');

/** One browser for the process, launched lazily and reused. */
function createScreenshotter(): Screenshotter {
  let browser: Browser | null = null;
  return {
    async capture(url, width) {
      browser ??= await chromium.launch({
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {}),
      });
      const page = await browser.newPage({
        viewport: { width, height: width === 375 ? 812 : 900 },
        userAgent: AGENT_USER_AGENT,
      });
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForTimeout(1200);
        return await page.screenshot({ type: 'png', fullPage: false });
      } finally {
        await page.close();
      }
    },
  };
}

runWorker(db, {
  name: 'agent-worker',
  types: ['qualify'],
  handlers: {
    qualify: makeQualifyHandler({
      db,
      client: anthropic,
      places,
      shooter: createScreenshotter(),
      bucket,
      // No provider wired: web_search needs a key Stefan has not chosen yet.
      search: null,
    }),
  },
});
