/**
 * analyzer-worker entry — Playwright site audits + scoring (SPEC §6).
 * Owns one shared browser via the Playwright analyzer and the PSI client.
 */

import 'dotenv/config';
import { initFirebase } from './lib/firebase.js';
import { runWorker } from './lib/queue.js';
import { createPlaywrightAnalyzer } from './lib/analyzer.js';
import { createPageSpeedClient } from './lib/pagespeed.js';
import { makeAnalyzeHandler } from './handlers/analyze.js';

const db = initFirebase();
const analyzer = createPlaywrightAnalyzer();
const psi = createPageSpeedClient(process.env.PAGESPEED_API_KEY);

runWorker(db, {
  name: 'analyzer-worker',
  types: ['analyze'],
  handlers: {
    analyze: makeAnalyzeHandler(db, analyzer, psi),
  },
});

// Close the browser cleanly on shutdown.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void analyzer.close().finally(() => process.exit(0));
  });
}
