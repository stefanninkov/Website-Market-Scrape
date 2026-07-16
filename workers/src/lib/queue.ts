/**
 * Firestore-as-job-queue listener loop (SPEC §1).
 *
 * Each worker process calls runWorker() with the job types it owns and a
 * handler per type. The loop:
 *  1. Listens (onSnapshot) for jobs with status 'queued' of those types.
 *  2. Claims a job by transactionally flipping queued → running (safe if
 *     multiple workers ever watch the same type).
 *  3. Runs the handler; writes done / failed / blocked_budget.
 *
 * Handler failures NEVER crash the loop (CLAUDE.md rule): they land on the
 * job doc as status 'failed' + error string.
 */

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import { COLLECTIONS, parseJob, type Job, type JobType } from '@wms/shared';

/** Thrown by handlers when the budget guard refuses the job (SPEC §2). */
export class BudgetBlockedError extends Error {
  constructor(api: string) {
    super(`Budget guard: ${api} spend is at/above 90% of the monthly limit.`);
    this.name = 'BudgetBlockedError';
  }
}

export type JobHandler = (job: Job, ref: DocumentReference) => Promise<void>;

export interface WorkerOptions {
  name: string;
  types: JobType[];
  handlers: Partial<Record<JobType, JobHandler>>;
}

function log(name: string, msg: string): void {
  console.log(`[${new Date().toISOString()}] [${name}] ${msg}`);
}

/** Transactionally claim a queued job. Returns false if someone else got it. */
async function claim(db: Firestore, ref: DocumentReference): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || (snap.data() as { status?: string }).status !== 'queued') {
      return false;
    }
    tx.update(ref, { status: 'running', startedAt: Timestamp.now() });
    return true;
  });
}

async function process(
  db: Firestore,
  opts: WorkerOptions,
  ref: DocumentReference,
): Promise<void> {
  if (!(await claim(db, ref))) return;

  let job: Job;
  try {
    job = parseJob(await ref.get());
  } catch (err) {
    log(opts.name, `job ${ref.id} has an invalid shape: ${String(err)}`);
    await ref.update({
      status: 'failed',
      finishedAt: Timestamp.now(),
      error: `Invalid job document: ${String(err)}`,
    });
    return;
  }

  const handler = opts.handlers[job.type];
  if (!handler) {
    await ref.update({
      status: 'failed',
      finishedAt: Timestamp.now(),
      error: `Worker "${opts.name}" has no handler for job type "${job.type}".`,
    });
    return;
  }

  log(opts.name, `running ${job.type} job ${ref.id}`);
  try {
    await handler(job, ref);
    await ref.update({ status: 'done', finishedAt: Timestamp.now(), error: null });
    log(opts.name, `done ${job.type} job ${ref.id}`);
  } catch (err) {
    const blocked = err instanceof BudgetBlockedError;
    const message = err instanceof Error ? err.message : String(err);
    await ref.update({
      status: blocked ? 'blocked_budget' : 'failed',
      finishedAt: Timestamp.now(),
      error: message,
    });
    log(opts.name, `${blocked ? 'blocked (budget)' : 'FAILED'} ${job.type} job ${ref.id}: ${message}`);
  }
}

/**
 * Starts the listener loop and keeps the process alive. Jobs of the watched
 * types are processed sequentially (one at a time per process) — enough for a
 * single-user tool and required for Playwright politeness rules.
 */
export function runWorker(db: Firestore, opts: WorkerOptions): void {
  const pending: DocumentReference[] = [];
  const enqueued = new Set<string>();
  let draining = false;

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    while (pending.length > 0) {
      const ref = pending.shift();
      if (!ref) break;
      enqueued.delete(ref.id);
      try {
        await process(db, opts, ref);
      } catch (err) {
        // Last-resort catch: even queue bookkeeping errors must not kill the loop.
        log(opts.name, `unexpected error processing job ${ref.id}: ${String(err)}`);
      }
    }
    draining = false;
  }

  const query = db
    .collection(COLLECTIONS.jobs)
    .where('status', '==', 'queued')
    .where('type', 'in', opts.types);

  query.onSnapshot(
    (snap) => {
      for (const doc of snap.docs) {
        if (!enqueued.has(doc.id)) {
          enqueued.add(doc.id);
          pending.push(doc.ref);
        }
      }
      void drain();
    },
    (err) => {
      // Listener errors (network blips) are logged; Firestore SDK retries.
      log(opts.name, `listener error: ${String(err)}`);
    },
  );

  log(opts.name, `worker started, watching job types: ${opts.types.join(', ')}`);
}

/** Placeholder handler for phases that aren't built yet. */
export function notImplemented(phase: string): JobHandler {
  return () => Promise.reject(new Error(`Not implemented yet — lands in ${phase}.`));
}
