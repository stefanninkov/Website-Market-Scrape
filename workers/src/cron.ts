/**
 * cron worker entry — scheduled duties, not queue-driven:
 *  - Sunday 06:00 CET: enqueue all schedule == 'weekly' sweeps (SPEC §5.7).  ✓
 *  - Gmail watch renewal + reply-polling fallback (Phase 3).
 *
 * Ticks once a minute and lets runWeeklyCronIfDue decide (idempotent per week).
 */

import 'dotenv/config';
import { initFirebase } from './lib/firebase.js';
import { runWeeklyCronIfDue } from './handlers/cron.js';

const db = initFirebase();
const TICK_MS = 60_000;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [cron] ${msg}`);
}

async function tick(): Promise<void> {
  try {
    const enqueued = await runWeeklyCronIfDue(db);
    if (enqueued > 0) log(`weekly cron fired: enqueued ${enqueued} sweep job(s)`);
  } catch (err) {
    // Never let a transient error kill the cron loop.
    log(`tick error: ${String(err)}`);
  }
}

log('cron worker started (weekly sweeps active; Gmail duties land in Phase 3)');
void tick();
setInterval(() => void tick(), TICK_MS);
