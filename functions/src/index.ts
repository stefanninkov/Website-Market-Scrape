/**
 * Cloud Functions (lightweight only, SPEC §1):
 *  - enqueueJob        — callable, writes a job doc                (Phase 1 ✓)
 *  - px                — tracking pixel, logs open events          (Phase 3 ✓)
 *  - sendEmail         — callable, sends the draft via Gmail       (Phase 3 ✓)
 *  - gmailAuthStart/Callback — OAuth flow, tokens → config/gmail   (Phase 3 ✓)
 *  - gmailPushHandler  — reply detection via Pub/Sub               (Phase 3 ✓)
 *  - servePreview      — /p/{slug} Hosting rewrite                 (Phase 4)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { google } from 'googleapis';
import { COLLECTIONS, configPath, leadPath, type JobType, type Lead } from '@wms/shared';
import {
  buildRawMessage,
  createOAuthClient,
  GMAIL_SCOPES,
  TRACKING_PIXEL_GIF,
} from './gmail.js';

initializeApp();
const db = getFirestore();

export const OWNER_EMAIL = 'stefan.ninkov@gmail.com';
const REGION = 'europe-west1';
const FOLLOW_UP_DAYS = 4; // SPEC §7: followUpDue default +4 days
const DAILY_SEND_SOFT_LIMIT = 20; // SPEC §7: soft warning above 20 sends/day

const JOB_TYPES: JobType[] = ['sweep', 'analyze', 'generate_email', 'generate_preview'];

function appBaseUrl(): string {
  return process.env.APP_BASE_URL || `https://${process.env.GCLOUD_PROJECT}.web.app`;
}

/**
 * Default Storage bucket. Newer projects use the `.firebasestorage.app`
 * naming, which the Admin SDK's legacy `.appspot.com` default gets wrong —
 * so honor STORAGE_BUCKET when set (functions/.env).
 */
function previewBucket() {
  const name = process.env.STORAGE_BUCKET;
  return name ? getStorage().bucket(name) : getStorage().bucket();
}

function requireOwner(email: string | undefined): void {
  if (email !== OWNER_EMAIL) throw new HttpsError('permission-denied', 'Owner only.');
}

// ---------------------------------------------------------------------------
// enqueueJob
// ---------------------------------------------------------------------------

interface EnqueueJobData {
  type?: string;
  payload?: { sweepId?: string; placeId?: string; templateId?: string; steering?: string };
}

export const enqueueJob = onCall<EnqueueJobData>({ region: REGION }, async (request) => {
  requireOwner(request.auth?.token.email);

  const { type, payload = {} } = request.data ?? {};
  if (!type || !JOB_TYPES.includes(type as JobType)) {
    throw new HttpsError('invalid-argument', `type must be one of: ${JOB_TYPES.join(', ')}`);
  }
  const jobType = type as JobType;

  if (jobType === 'sweep' && !payload.sweepId) {
    throw new HttpsError('invalid-argument', 'sweep jobs require payload.sweepId.');
  }
  if (jobType !== 'sweep' && !payload.placeId) {
    throw new HttpsError('invalid-argument', `${jobType} jobs require payload.placeId.`);
  }

  const cleanPayload: EnqueueJobData['payload'] = {};
  if (payload.sweepId) cleanPayload.sweepId = payload.sweepId;
  if (payload.placeId) cleanPayload.placeId = payload.placeId;
  if (payload.templateId) cleanPayload.templateId = payload.templateId;
  if (payload.steering) cleanPayload.steering = payload.steering;

  const ref = await db.collection(COLLECTIONS.jobs).add({
    type: jobType,
    payload: cleanPayload,
    status: 'queued',
    createdAt: FieldValue.serverTimestamp(),
    startedAt: null,
    finishedAt: null,
    error: null,
  });

  return { jobId: ref.id };
});

// ---------------------------------------------------------------------------
// px — tracking pixel (SPEC §7). GET /px?l={leadId}
// ---------------------------------------------------------------------------

export const px = onRequest({ region: REGION }, async (req, res) => {
  // Always serve the gif, whatever happens — never break email rendering.
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const leadId = typeof req.query.l === 'string' ? req.query.l : null;
  if (leadId) {
    try {
      const leadRef = db.doc(leadPath(leadId));
      const snap = await leadRef.get();
      if (snap.exists) {
        const now = Timestamp.now();
        await leadRef.update({
          'outreach.opens': FieldValue.increment(1),
          'outreach.lastOpenAt': now,
        });
        await db.collection(COLLECTIONS.events).add({
          leadId,
          type: 'open',
          at: now,
          meta: {},
        });
      }
    } catch (err) {
      console.error('px logging failed:', err);
    }
  }

  res.status(200).send(TRACKING_PIXEL_GIF);
});

// ---------------------------------------------------------------------------
// Gmail OAuth flow — tokens land in config/gmail (owner-only rules)
// ---------------------------------------------------------------------------

function callbackUrl(): string {
  return `${appBaseUrl()}/gmailAuthCallback`;
}

export const gmailAuthStart = onRequest({ region: REGION }, (_req, res) => {
  try {
    const client = createOAuthClient(callbackUrl());
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // always return a refresh token
      scope: GMAIL_SCOPES,
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`Gmail OAuth is not configured: ${(err as Error).message}`);
  }
});

export const gmailAuthCallback = onRequest({ region: REGION }, async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code) {
    res.status(400).send('Missing authorization code.');
    return;
  }
  try {
    const client = createOAuthClient(callbackUrl());
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Only the owner's own Gmail may be connected (single-user app).
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress ?? null;
    if (emailAddress !== OWNER_EMAIL) {
      res.status(403).send(`This app is locked to ${OWNER_EMAIL}. You signed in as ${emailAddress}.`);
      return;
    }

    await db.doc(configPath('gmail')).set(
      {
        accessToken: tokens.access_token ?? null,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date ?? null,
        watchExpiration: null,
        historyId: profile.data.historyId ?? null,
        emailAddress,
      },
      { merge: true },
    );

    res.redirect(`${appBaseUrl()}/settings`);
  } catch (err) {
    res.status(500).send(`OAuth exchange failed: ${(err as Error).message}`);
  }
});

// ---------------------------------------------------------------------------
// sendEmail — send the current draft via Gmail with the tracking pixel
// ---------------------------------------------------------------------------

async function gmailClientFromConfig() {
  const snap = await db.doc(configPath('gmail')).get();
  const cfg = snap.data() as { refreshToken?: string | null; emailAddress?: string | null } | undefined;
  if (!cfg?.refreshToken) {
    throw new HttpsError('failed-precondition', 'Gmail is not connected — open Settings first.');
  }
  const client = createOAuthClient(callbackUrl());
  client.setCredentials({ refresh_token: cfg.refreshToken });
  return { gmail: google.gmail({ version: 'v1', auth: client }), from: cfg.emailAddress ?? OWNER_EMAIL };
}

export const sendEmail = onCall<{ placeId?: string }>({ region: REGION }, async (request) => {
  requireOwner(request.auth?.token.email);

  const placeId = request.data?.placeId;
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId is required.');

  const leadRef = db.doc(leadPath(placeId));
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) throw new HttpsError('not-found', `Lead ${placeId} not found.`);
  const lead = leadSnap.data() as Lead;

  if (!lead.email) throw new HttpsError('failed-precondition', 'Lead has no email address.');
  const draft = lead.outreach.draft;
  if (!draft) throw new HttpsError('failed-precondition', 'Lead has no email draft.');

  const { gmail, from } = await gmailClientFromConfig();

  const pixelUrl = `${appBaseUrl()}/px?l=${encodeURIComponent(placeId)}`;
  const raw = buildRawMessage({
    from,
    to: lead.email,
    subject: draft.subject,
    body: draft.body,
    pixelUrl,
  });

  let threadId: string;
  try {
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    threadId = sent.data.threadId ?? '';
  } catch (err) {
    throw new HttpsError('internal', `Gmail send failed: ${(err as Error).message}`);
  }

  const now = Timestamp.now();
  const followUpDue = Timestamp.fromMillis(now.toMillis() + FOLLOW_UP_DAYS * 86400_000);

  await leadRef.update({
    'outreach.threadId': threadId,
    'outreach.lastSentAt': now,
    'outreach.followUpDue': followUpDue,
    // Auto-advance early stages; never touch replied/won/lost/ignored.
    ...(lead.stage === 'new' || lead.stage === 'qualified' ? { stage: 'contacted' } : {}),
  });
  await db.collection(COLLECTIONS.events).add({
    leadId: placeId,
    type: 'sent',
    at: now,
    meta: { to: lead.email, subject: draft.subject },
  });

  // Daily soft warning (SPEC §7): count today's sends.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await db
    .collection(COLLECTIONS.events)
    .where('type', '==', 'sent')
    .where('at', '>=', Timestamp.fromDate(startOfDay))
    .count()
    .get();

  return {
    threadId,
    sentToday: sentToday.data().count,
    softLimit: DAILY_SEND_SOFT_LIMIT,
  };
});

// ---------------------------------------------------------------------------
// gmailPushHandler — reply detection (SPEC §7).
// Gmail watch publishes to the gmail-replies topic; we scan history for new
// inbox messages and match their threadIds to contacted leads.
// NOTE: deploying this function requires the Pub/Sub topic to exist:
//   gcloud pubsub topics create gmail-replies
// ---------------------------------------------------------------------------

export async function applyRepliesFromThreads(threadIds: string[]): Promise<number> {
  let matched = 0;
  for (const threadId of [...new Set(threadIds)]) {
    if (!threadId) continue;
    const leads = await db
      .collection(COLLECTIONS.leads)
      .where('outreach.threadId', '==', threadId)
      .limit(1)
      .get();
    const doc = leads.docs[0];
    if (!doc) continue;
    const lead = doc.data() as Lead;
    if (lead.outreach.replied) continue; // already recorded

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
      meta: { threadId },
    });
    matched += 1;
  }
  return matched;
}

export const gmailPushHandler = onMessagePublished(
  { region: REGION, topic: 'gmail-replies' },
  async (event) => {
    try {
      const payload = event.data.message.json as { historyId?: string | number } | undefined;
      const newHistoryId = payload?.historyId ? String(payload.historyId) : null;

      const cfgRef = db.doc(configPath('gmail'));
      const cfgSnap = await cfgRef.get();
      const cfg = cfgSnap.data() as { historyId?: string | null } | undefined;
      const startHistoryId = cfg?.historyId;
      if (!startHistoryId) return; // not connected / no baseline yet

      const { gmail } = await gmailClientFromConfig();
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      const threadIds: string[] = [];
      for (const h of history.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          if (added.message?.threadId) threadIds.push(added.message.threadId);
        }
      }
      const matched = await applyRepliesFromThreads(threadIds);
      if (matched > 0) console.log(`gmailPushHandler: marked ${matched} lead(s) as replied`);

      if (newHistoryId) await cfgRef.set({ historyId: newHistoryId }, { merge: true });
    } catch (err) {
      // Log and swallow — Pub/Sub retries; the VPS polling fallback also covers gaps.
      console.error('gmailPushHandler failed:', err);
    }
  },
);

// ---------------------------------------------------------------------------
// servePreview — /p/{slug} + /p/{slug}-og.png from Storage (SPEC §8).
// Streams via the Admin SDK (bypasses owner-only storage rules), logs a
// preview_view event and bumps the view counter for page loads (not OG hits).
// ---------------------------------------------------------------------------

export const servePreview = onRequest({ region: REGION }, async (req, res) => {
  // Path arrives as /p/{slug} via the Hosting rewrite (or /{slug} when the
  // function is hit directly). Normalize and validate.
  const raw = req.path.replace(/^\/p\//, '').replace(/^\//, '');
  const slugPart = decodeURIComponent(raw.split('/')[0] ?? '');
  if (!slugPart || !/^[a-z0-9-]+(\.png)?$/.test(slugPart)) {
    res.status(404).send('Not found.');
    return;
  }

  const isOg = slugPart.endsWith('-og.png');
  const slug = isOg ? slugPart.slice(0, -'-og.png'.length) : slugPart;
  const objectPath = isOg ? `previews/${slug}-og.png` : `previews/${slug}.html`;

  try {
    const file = previewBucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send('Preview not found.');
      return;
    }
    const [contents] = await file.download();

    if (isOg) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600');
      res.status(200).send(contents);
      return;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.status(200).send(contents.toString('utf8'));

    // View tracking after the response — a warm lead signal (SPEC §8).
    try {
      const leads = await db
        .collection(COLLECTIONS.leads)
        .where('preview.slug', '==', slug)
        .limit(1)
        .get();
      const doc = leads.docs[0];
      if (doc) {
        const now = Timestamp.now();
        await doc.ref.update({
          'preview.views': FieldValue.increment(1),
          'preview.lastViewAt': now,
        });
        await db.collection(COLLECTIONS.events).add({
          leadId: doc.id,
          type: 'preview_view',
          at: now,
          meta: { slug },
        });
      }
    } catch (err) {
      console.error('servePreview view tracking failed:', err);
    }
  } catch (err) {
    console.error('servePreview failed:', err);
    res.status(500).send('Preview temporarily unavailable.');
  }
});
