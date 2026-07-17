/**
 * VPS-side Gmail duties (SPEC §7), run by the cron worker:
 *  - pollReplies: every 30 min, fallback reply detection — for each contacted,
 *    not-yet-replied lead with a threadId, fetch the thread and check for a
 *    message from someone other than the owner.
 *  - renewWatchIfDue: Gmail watch expires every 7 days; re-arm daily.
 *
 * The Gmail surface is abstracted (GmailThreads) so reply handling is
 * verifiable against the emulator with a fake; the real client uses the OAuth
 * refresh token stored in config/gmail.
 */

import { google } from 'googleapis';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, configPath, type Lead } from '@wms/shared';

const WATCH_RENEW_BEFORE_MS = 24 * 3600_000; // renew when <24h of watch left

export interface ThreadMessage {
  fromEmail: string | null;
}

export interface GmailThreads {
  /** Sender addresses of all messages in a thread. */
  getThreadMessages(threadId: string): Promise<ThreadMessage[]>;
  /** Re-arm users.watch; returns the new expiration (epoch ms) + historyId. */
  watch(topicName: string): Promise<{ expiration: number | null; historyId: string | null }>;
}

/** True when any message in the thread comes from someone other than us. */
export function threadHasReply(messages: ThreadMessage[], ownerEmail: string): boolean {
  const owner = ownerEmail.toLowerCase();
  return messages.some((m) => m.fromEmail !== null && m.fromEmail.toLowerCase() !== owner);
}

function extractEmail(fromHeader: string | undefined | null): string | null {
  if (!fromHeader) return null;
  const angled = fromHeader.match(/<([^>]+)>/);
  const raw = angled?.[1] ?? fromHeader;
  return raw.trim().toLowerCase() || null;
}

interface GmailConfigDoc {
  refreshToken?: string | null;
  emailAddress?: string | null;
  watchExpiration?: number | null;
}

/** Real Gmail client from config/gmail; null when not connected/configured. */
export async function createGmailThreads(db: Firestore): Promise<GmailThreads | null> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const snap = await db.doc(configPath('gmail')).get();
  const cfg = snap.data() as GmailConfigDoc | undefined;
  if (!cfg?.refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: cfg.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });

  return {
    async getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From'],
      });
      return (thread.data.messages ?? []).map((m) => ({
        fromEmail: extractEmail(
          m.payload?.headers?.find((h) => h.name?.toLowerCase() === 'from')?.value,
        ),
      }));
    },
    async watch(topicName: string) {
      const res = await gmail.users.watch({
        userId: 'me',
        requestBody: { topicName, labelIds: ['INBOX'] },
      });
      return {
        expiration: res.data.expiration ? Number(res.data.expiration) : null,
        historyId: res.data.historyId ? String(res.data.historyId) : null,
      };
    },
  };
}

/** Fallback reply poll. Returns how many leads were newly marked replied. */
export async function pollReplies(
  db: Firestore,
  gmail: GmailThreads,
  ownerEmail: string,
): Promise<number> {
  const candidates = await db
    .collection(COLLECTIONS.leads)
    .where('outreach.replied', '==', false)
    .where('outreach.threadId', '!=', null)
    .limit(200)
    .get();

  let marked = 0;
  for (const doc of candidates.docs) {
    const lead = doc.data() as Lead;
    const threadId = lead.outreach.threadId;
    if (!threadId) continue;
    try {
      const messages = await gmail.getThreadMessages(threadId);
      if (!threadHasReply(messages, ownerEmail)) continue;
      const now = Timestamp.now();
      await doc.ref.update({
        'outreach.replied': true,
        'outreach.followUpDue': null,
        stage: 'replied',
      });
      await db.collection(COLLECTIONS.events).add({
        leadId: doc.id,
        type: 'reply',
        at: now,
        meta: { threadId, via: 'poll' },
      });
      marked += 1;
    } catch (err) {
      // One bad thread must not stop the poll (CLAUDE.md error handling).
      console.error(`pollReplies: thread ${threadId} failed:`, err);
    }
  }
  return marked;
}

/** Re-arm the Gmail watch when it's near expiry. Returns true when renewed. */
export async function renewWatchIfDue(
  db: Firestore,
  gmail: GmailThreads,
  topicName: string,
  now: Date = new Date(),
): Promise<boolean> {
  const ref = db.doc(configPath('gmail'));
  const snap = await ref.get();
  const cfg = snap.data() as GmailConfigDoc | undefined;
  if (!cfg?.refreshToken) return false;

  const expiration = cfg.watchExpiration ?? 0;
  if (expiration - now.getTime() > WATCH_RENEW_BEFORE_MS) return false;

  const res = await gmail.watch(topicName);
  await ref.set(
    {
      watchExpiration: res.expiration,
      ...(res.historyId ? { historyId: res.historyId } : {}),
    },
    { merge: true },
  );
  return true;
}
