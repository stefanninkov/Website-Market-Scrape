/**
 * Firebase web SDK init. All values come from env (app/.env, see .env.example).
 * `isFirebaseConfigured` lets the app render a setup screen instead of
 * crashing when the env file hasn't been filled in yet.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string | undefined) ?? '';

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export function requireAuth(): Auth {
  if (!authInstance) throw new Error('Firebase is not configured (see app/.env.example).');
  return authInstance;
}

export function requireDb(): Firestore {
  if (!dbInstance) throw new Error('Firebase is not configured (see app/.env.example).');
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();
