/**
 * preview-worker — renders template + copy → Storage (SPEC §8).
 * Phase 0: skeleton wired to the job queue; real handler lands in Phase 4.
 */

import { initFirebase } from './lib/firebase.js';
import { notImplemented, runWorker } from './lib/queue.js';

const db = initFirebase();

runWorker(db, {
  name: 'preview-worker',
  types: ['generate_preview'],
  handlers: {
    generate_preview: notImplemented('Phase 4'),
  },
});
