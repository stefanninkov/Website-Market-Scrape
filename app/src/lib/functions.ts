/**
 * Callable Cloud Function wrappers. enqueueJob writes a job doc server-side
 * (SPEC §1); the app never writes jobs directly so the function can validate.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { JobType } from '@wms/shared';
import { requireAuth } from './firebase';

interface EnqueuePayload {
  sweepId?: string;
  placeId?: string;
  templateId?: string;
  steering?: string;
}

const REGION = 'europe-west1';

export async function enqueueJob(type: JobType, payload: EnqueuePayload): Promise<string> {
  const functions = getFunctions(requireAuth().app, REGION);
  const callable = httpsCallable<{ type: JobType; payload: EnqueuePayload }, { jobId: string }>(
    functions,
    'enqueueJob',
  );
  const result = await callable({ type, payload });
  return result.data.jobId;
}

export interface SendEmailResult {
  threadId: string;
  sentToday: number;
  softLimit: number;
}

/** Send the lead's current draft via Gmail (backend injects the tracking pixel). */
export async function sendEmail(placeId: string): Promise<SendEmailResult> {
  const functions = getFunctions(requireAuth().app, REGION);
  const callable = httpsCallable<{ placeId: string }, SendEmailResult>(functions, 'sendEmail');
  const result = await callable({ placeId });
  return result.data;
}
