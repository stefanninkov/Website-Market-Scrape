/**
 * Cloud Functions (lightweight only, SPEC §1):
 *  - enqueueJob     — callable, writes a job doc         (implemented Phase 1)
 *  - px             — tracking pixel, logs open events   (implemented Phase 3)
 *  - gmailPushHandler — reply detection via Pub/Sub      (implemented Phase 3)
 *  - servePreview   — /p/{slug} Hosting rewrite          (implemented Phase 4)
 *
 * Phase 0 ships compile-clean stubs so the deploy pipeline and Hosting
 * rewrites can be wired up before the features exist.
 */

import { initializeApp } from 'firebase-admin/app';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const OWNER_EMAIL = 'stefan.ninkov@gmail.com';

export const enqueueJob = onCall({ region: 'europe-west1' }, (request) => {
  if (request.auth?.token.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Owner only.');
  }
  throw new HttpsError('unimplemented', 'enqueueJob lands in Phase 1.');
});

export const px = onRequest({ region: 'europe-west1' }, (_req, res) => {
  res.status(501).send('px lands in Phase 3.');
});

export const servePreview = onRequest({ region: 'europe-west1' }, (_req, res) => {
  res.status(404).send('Preview not found. servePreview lands in Phase 4.');
});

// gmailPushHandler (Pub/Sub triggered) is added in Phase 3 together with the
// gmail-replies topic; declaring it now would fail deploys on projects where
// the topic doesn't exist yet.
