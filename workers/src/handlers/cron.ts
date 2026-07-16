/**
 * Weekly cron core (SPEC §5.7): every Sunday 06:00 CET, enqueue a `sweep` job
 * for each sweep with schedule == 'weekly'. Those runs flag brand-new place
 * IDs as isNewBusiness (handled in the sweep handler).
 *
 * Robust to restarts and missed ticks: instead of firing at an exact minute,
 * it fires once per ISO week the first time it sees "Sunday ≥ 06:00 Belgrade",
 * keyed by that Sunday's local date in config/cron.lastWeeklyKey. CET/CEST DST
 * is handled by resolving wall-clock time in Europe/Belgrade via Intl.
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@wms/shared';

const CRON_DOC = `${COLLECTIONS.config}/cron`;
const WEEKLY_HOUR_CET = 6;

interface BelgradeParts {
  weekday: string;
  hour: number;
  dateStr: string; // YYYY-MM-DD in Belgrade local time
}

/** Wall-clock parts in Europe/Belgrade (observes CET/CEST). */
export function belgradeParts(now: Date): BelgradeParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  return {
    weekday: parts.weekday ?? '',
    hour,
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** True when `now` is within the weekly window (Sunday ≥ 06:00 Belgrade). */
export function isWeeklyWindow(now: Date): boolean {
  const p = belgradeParts(now);
  return p.weekday === 'Sunday' && p.hour >= WEEKLY_HOUR_CET;
}

/**
 * Enqueue weekly sweeps if due and not already run for this week. Returns the
 * number of sweeps enqueued (0 when not due or already done this week).
 */
export async function runWeeklyCronIfDue(db: Firestore, now: Date = new Date()): Promise<number> {
  if (!isWeeklyWindow(now)) return 0;
  const key = belgradeParts(now).dateStr;

  const cronRef = db.doc(CRON_DOC);
  const cronSnap = await cronRef.get();
  if ((cronSnap.data() as { lastWeeklyKey?: string } | undefined)?.lastWeeklyKey === key) {
    return 0; // already fired this week
  }

  const weekly = await db.collection(COLLECTIONS.sweeps).where('schedule', '==', 'weekly').get();
  const now_ts = Timestamp.now();
  let count = 0;
  for (const doc of weekly.docs) {
    await db.collection(COLLECTIONS.jobs).add({
      type: 'sweep',
      payload: { sweepId: doc.id },
      status: 'queued',
      createdAt: now_ts,
      startedAt: null,
      finishedAt: null,
      error: null,
    });
    count += 1;
  }

  await cronRef.set({ lastWeeklyKey: key, lastRunAt: now_ts }, { merge: true });
  return count;
}
