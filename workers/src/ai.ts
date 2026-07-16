/**
 * ai-worker — Claude API email drafts (SPEC §7) + preview copy (SPEC §8).
 * Phase 0: skeleton wired to the job queue; email drafts land in Phase 3,
 * preview copy in Phase 4.
 */

import { initFirebase } from './lib/firebase.js';
import { notImplemented, runWorker } from './lib/queue.js';

const db = initFirebase();

runWorker(db, {
  name: 'ai-worker',
  types: ['generate_email'],
  handlers: {
    generate_email: notImplemented('Phase 3'),
  },
});
