/**
 * analyzer-worker — Playwright site audits + scoring (SPEC §6).
 * Phase 0: skeleton wired to the job queue; real handler lands in Phase 2.
 */

import { initFirebase } from './lib/firebase.js';
import { notImplemented, runWorker } from './lib/queue.js';

const db = initFirebase();

runWorker(db, {
  name: 'analyzer-worker',
  types: ['analyze'],
  handlers: {
    analyze: notImplemented('Phase 2'),
  },
});
