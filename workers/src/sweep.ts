/**
 * sweep-worker — Google Places queries, dedupe, upsert (SPEC §5).
 * Phase 0: skeleton wired to the job queue; real handler lands in Phase 1.
 */

import { initFirebase } from './lib/firebase.js';
import { notImplemented, runWorker } from './lib/queue.js';

const db = initFirebase();

runWorker(db, {
  name: 'sweep-worker',
  types: ['sweep'],
  handlers: {
    sweep: notImplemented('Phase 1'),
  },
});
