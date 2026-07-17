/**
 * ai-worker entry — Claude email drafts (SPEC §7) and, from Phase 4, preview
 * copy (SPEC §8). Holds one Anthropic client for the process.
 */

import 'dotenv/config';
import { initFirebase } from './lib/firebase.js';
import { runWorker } from './lib/queue.js';
import { createAnthropicClient } from './lib/anthropic.js';
import { makeEmailHandler } from './handlers/ai-email.js';

const db = initFirebase();
const anthropic = createAnthropicClient(process.env.ANTHROPIC_API_KEY ?? '');

runWorker(db, {
  name: 'ai-worker',
  types: ['generate_email'],
  handlers: {
    generate_email: makeEmailHandler(db, anthropic),
  },
});
