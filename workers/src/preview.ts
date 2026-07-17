/**
 * preview-worker entry — renders template + copy → Storage (SPEC §8).
 * Owns its own Anthropic client (for PreviewCopy) and a Playwright browser
 * (for OG images).
 */

import 'dotenv/config';
import { initBucket, initFirebase } from './lib/firebase.js';
import { runWorker } from './lib/queue.js';
import { createAnthropicClient } from './lib/anthropic.js';
import { createOgRenderer } from './lib/og.js';
import { makePreviewHandler } from './handlers/preview.js';

const db = initFirebase();
const bucket = initBucket();
const anthropic = createAnthropicClient(process.env.ANTHROPIC_API_KEY ?? '');
const og = createOgRenderer();

const baseUrl =
  process.env.APP_BASE_URL ||
  `https://${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-wms'}.web.app`;

runWorker(db, {
  name: 'preview-worker',
  types: ['generate_preview'],
  handlers: {
    generate_preview: makePreviewHandler({ db, bucket, anthropic, og, baseUrl }),
  },
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void og.close().finally(() => process.exit(0));
  });
}
