/**
 * Cloud Functions (lightweight only, SPEC §1):
 *  - enqueueJob     — callable, writes a job doc                (Phase 1 ✓)
 *  - px             — tracking pixel, logs open events          (Phase 3)
 *  - gmailPushHandler — reply detection via Pub/Sub            (Phase 3)
 *  - servePreview   — /p/{slug} Hosting rewrite                 (Phase 4)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { COLLECTIONS, type JobType } from '@wms/shared';

initializeApp();
const db = getFirestore();

export const OWNER_EMAIL = 'stefan.ninkov@gmail.com';
const REGION = 'europe-west1';

const JOB_TYPES: JobType[] = ['sweep', 'analyze', 'generate_email', 'generate_preview'];

interface EnqueueJobData {
  type?: string;
  payload?: { sweepId?: string; placeId?: string; templateId?: string; steering?: string };
}

/**
 * Writes a queued job doc that the VPS workers pick up (SPEC §1 job queue).
 * Owner-only. Validates the job type and that the payload carries the id the
 * type needs, so workers never dequeue a structurally invalid job.
 */
export const enqueueJob = onCall<EnqueueJobData>({ region: REGION }, async (request) => {
  if (request.auth?.token.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Owner only.');
  }

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

export const px = onRequest({ region: REGION }, (_req, res) => {
  res.status(501).send('px lands in Phase 3.');
});

export const servePreview = onRequest({ region: REGION }, (_req, res) => {
  res.status(404).send('Preview not found. servePreview lands in Phase 4.');
});

// gmailPushHandler (Pub/Sub triggered) is added in Phase 3 with the
// gmail-replies topic; declaring it now would fail deploys where the topic
// doesn't exist yet.
