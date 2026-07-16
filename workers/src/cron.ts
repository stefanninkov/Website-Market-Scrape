/**
 * cron worker — scheduled duties, not queue-driven:
 *  - Sunday 06:00 CET: enqueue all schedule == 'weekly' sweeps  (Phase 2)
 *  - Gmail watch renewal (expires every 7 days)                  (Phase 3)
 *  - Gmail reply-polling fallback every 30 min                   (Phase 3)
 *
 * Phase 0: skeleton that ticks and logs, so pm2 wiring can be verified.
 */

import { initFirebase } from './lib/firebase.js';

initFirebase();

const TICK_MS = 60_000;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [cron] ${msg}`);
}

function tick(): void {
  // Schedule checks land in Phase 2 (weekly sweeps) and Phase 3 (Gmail watch).
}

log('cron worker started (schedules land in Phase 2/3)');
setInterval(tick, TICK_MS);
