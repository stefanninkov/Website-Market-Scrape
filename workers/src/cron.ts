/**
 * cron worker entry — scheduled duties, not queue-driven:
 *  - Sunday 06:00 CET: enqueue all schedule == 'weekly' sweeps (SPEC §5.7)  ✓
 *  - Gmail reply-polling fallback every 30 min (SPEC §7)                    ✓
 *  - Gmail watch renewal, checked hourly, renews <24h before expiry        ✓
 *
 * Ticks once a minute; each duty decides internally whether it's due. All
 * Gmail duties no-op silently until Gmail is connected in Settings and
 * GMAIL_CLIENT_ID/SECRET are present in workers/.env.
 */

import 'dotenv/config';
import { initFirebase } from './lib/firebase.js';
import { runWeeklyCronIfDue } from './handlers/cron.js';
import { createGmailThreads, pollReplies, renewWatchIfDue } from './handlers/gmail.js';

const db = initFirebase();
const TICK_MS = 60_000;
const POLL_EVERY_MS = 30 * 60_000; // SPEC §7: 30-min fallback poll
const WATCH_CHECK_EVERY_MS = 60 * 60_000;

const OWNER_EMAIL = 'stefan.ninkov@gmail.com';
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC || 'gmail-replies';

function topicName(): string {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  return `projects/${project}/topics/${PUBSUB_TOPIC}`;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [cron] ${msg}`);
}

let lastPollAt = 0;
let lastWatchCheckAt = 0;

async function tick(): Promise<void> {
  try {
    const enqueued = await runWeeklyCronIfDue(db);
    if (enqueued > 0) log(`weekly cron fired: enqueued ${enqueued} sweep job(s)`);
  } catch (err) {
    log(`weekly cron error: ${String(err)}`);
  }

  const now = Date.now();

  if (now - lastPollAt >= POLL_EVERY_MS) {
    lastPollAt = now;
    try {
      const gmail = await createGmailThreads(db);
      if (gmail) {
        const marked = await pollReplies(db, gmail, OWNER_EMAIL);
        if (marked > 0) log(`reply poll: marked ${marked} lead(s) as replied`);
      }
    } catch (err) {
      log(`reply poll error: ${String(err)}`);
    }
  }

  if (now - lastWatchCheckAt >= WATCH_CHECK_EVERY_MS) {
    lastWatchCheckAt = now;
    try {
      const gmail = await createGmailThreads(db);
      if (gmail && (await renewWatchIfDue(db, gmail, topicName()))) {
        log('gmail watch renewed');
      }
    } catch (err) {
      log(`watch renewal error: ${String(err)}`);
    }
  }
}

log('cron worker started (weekly sweeps + gmail poll/watch duties active)');
void tick();
setInterval(() => void tick(), TICK_MS);
