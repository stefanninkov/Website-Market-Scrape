/**
 * sweep-worker entry — Google Places queries, dedupe, upsert (SPEC §5).
 * Wires the real Places client into the handler and starts the queue loop.
 */

import 'dotenv/config';
import { initFirebase } from './lib/firebase.js';
import { runWorker } from './lib/queue.js';
import { createPlacesClient } from './lib/places.js';
import { makeSweepHandler } from './handlers/sweep.js';

const db = initFirebase();
const places = createPlacesClient(process.env.GOOGLE_PLACES_API_KEY ?? '');

runWorker(db, {
  name: 'sweep-worker',
  types: ['sweep'],
  handlers: {
    sweep: makeSweepHandler(db, places),
  },
});
