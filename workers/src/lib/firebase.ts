/**
 * Admin SDK init for workers. Credentials come from the JSON at
 * FIREBASE_SERVICE_ACCOUNT_PATH (workers/.env), which may be either:
 *   - a service account key ("type": "service_account"), or
 *   - user credentials ("type": "authorized_user"), e.g. from
 *     `gcloud auth application-default login`.
 * Fails fast with a clear message instead of a cryptic SDK error.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import 'dotenv/config';

// Derived from firebase-admin to avoid the @google-cloud/storage CJS/ESM
// dual-package type clash.
export type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

let app: App | null = null;

export function initFirebase(): Firestore {
  if (!app) {
    // Local dev against the Firestore emulator needs no service account.
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      app = initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-wms' });
      return getFirestore(app);
    }
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!path) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH is not set. Copy workers/.env.example to workers/.env and fill it in.',
      );
    }
    let raw: string;
    try {
      raw = readFileSync(path, 'utf8');
    } catch {
      throw new Error(`Service account file not found at "${path}" (FIREBASE_SERVICE_ACCOUNT_PATH).`);
    }
    const creds = JSON.parse(raw) as Record<string, string>;
    const projectId = process.env.GCLOUD_PROJECT || creds.project_id;

    if (creds.type === 'authorized_user') {
      // The Admin SDK's Firestore client rejects an explicit refreshToken
      // credential, but accepts application default credentials — which do
      // understand this format. Point ADC at the same file.
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(path);
      app = initializeApp({ projectId });
    } else {
      app = initializeApp({ credential: cert(creds), projectId });
    }
  }
  return getFirestore(app);
}

/** Default Storage bucket (FIREBASE_STORAGE_BUCKET or {project}.appspot.com). */
export function initBucket(): Bucket {
  initFirebase(); // ensures the app exists
  const name =
    process.env.FIREBASE_STORAGE_BUCKET ||
    `${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-wms'}.appspot.com`;
  return getStorage(app!).bucket(name);
}
