/** Small formatting helpers shared across pages. */

import type { TimestampLike } from '@wms/shared';

/** Firestore Timestamp → short local date, or "—" when null. */
export function formatDate(ts: TimestampLike | null | undefined): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Firestore Timestamp → relative "3d ago" style string. */
export function formatRelative(ts: TimestampLike | null | undefined): string {
  if (!ts) return '—';
  const ms = Date.now() - ts.toMillis();
  const sec = Math.round(ms / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return formatDate(ts);
}

/** Start of the current ISO week (Monday 00:00 local). */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
