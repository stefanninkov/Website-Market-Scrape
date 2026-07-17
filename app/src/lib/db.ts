/**
 * Typed Firestore access for the app (CLAUDE.md: all access through helpers).
 * Thin converters + query builders over the web SDK. Realtime hooks live in
 * hooks.ts; callable-function wrappers in functions.ts.
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOCS,
  type ApiBudget,
  type AppEvent,
  type GmailConfig,
  type Identity,
  type Job,
  type Lead,
  type NichesConfig,
  type Sweep,
  type ToneGuide,
} from '@wms/shared';
import { requireDb } from './firebase';

/** A lead with its Firestore doc id (== placeId) attached for React keys. */
export type LeadWithId = Lead & { id: string };
export type SweepWithId = Sweep & { id: string };
export type JobWithId = Job & { id: string };

function converter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as Record<string, unknown>,
    fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
  };
}

export const leadsCol = (): CollectionReference<Lead> =>
  collection(requireDb(), COLLECTIONS.leads).withConverter(converter<Lead>());

export const sweepsCol = (): CollectionReference<Sweep> =>
  collection(requireDb(), COLLECTIONS.sweeps).withConverter(converter<Sweep>());

export const jobsCol = (): CollectionReference<Job> =>
  collection(requireDb(), COLLECTIONS.jobs).withConverter(converter<Job>());

export const leadDoc = (placeId: string): DocumentReference<Lead> =>
  doc(requireDb(), COLLECTIONS.leads, placeId).withConverter(converter<Lead>());

export const sweepDoc = (sweepId: string): DocumentReference<Sweep> =>
  doc(requireDb(), COLLECTIONS.sweeps, sweepId).withConverter(converter<Sweep>());

export const apiBudgetDoc = (): DocumentReference<ApiBudget> =>
  doc(requireDb(), COLLECTIONS.config, CONFIG_DOCS.apiBudget).withConverter(converter<ApiBudget>());

export const nichesDoc = (): DocumentReference<NichesConfig> =>
  doc(requireDb(), COLLECTIONS.config, CONFIG_DOCS.niches).withConverter(converter<NichesConfig>());

export const identityDoc = (): DocumentReference<Identity> =>
  doc(requireDb(), COLLECTIONS.config, CONFIG_DOCS.identity).withConverter(converter<Identity>());

export const toneGuideDoc = (): DocumentReference<ToneGuide> =>
  doc(requireDb(), COLLECTIONS.config, CONFIG_DOCS.toneGuide).withConverter(converter<ToneGuide>());

export const gmailDoc = (): DocumentReference<GmailConfig> =>
  doc(requireDb(), COLLECTIONS.config, CONFIG_DOCS.gmail).withConverter(converter<GmailConfig>());

/** Recent events for one lead, newest first (drawer timeline). */
export const leadEventsQuery = (leadId: string): Query<AppEvent> =>
  query(
    collection(requireDb(), COLLECTIONS.events).withConverter(converter<AppEvent>()),
    where('leadId', '==', leadId),
    orderBy('at', 'desc'),
    limit(50),
  );
