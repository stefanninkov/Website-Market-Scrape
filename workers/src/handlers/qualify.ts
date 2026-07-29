/**
 * `qualify` job handler (AGENTS.md §4).
 *
 * Order matters here and is the whole safety story:
 *   1. refuse early — kill switch, per-agent toggle, lead lock, monthly budget
 *   2. run the loop, which cannot throw
 *   3. write lead state in ONE transaction, and only on `done`
 *
 * A capped, failed, aborted or budget-blocked run leaves the lead exactly as it
 * was (CLAUDE.md agent rules). The run document still records what happened, so
 * a run that decided nothing is still auditable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  leadPath,
  type Job,
  type Lead,
  type Qualification,
} from '@wms/shared';
import type { JobHandler } from '../lib/queue.js';
import { BudgetBlockedError } from '../lib/queue.js';
import type { PlacesClient } from '../lib/places.js';
import type { Bucket } from '../lib/firebase.js';
import { qualifierTools, type Screenshotter, type WebSearchProvider } from '../agent/tools/index.js';
import { qualifyLead } from '../agent/qualifier.js';
import {
  agentEnabled,
  closeRun,
  isAgentBudgetExhausted,
  openRun,
  readAgentsConfig,
  recordAgentSpend,
} from '../agent/runs.js';

export interface QualifyDeps {
  db: Firestore;
  client: Anthropic;
  places: PlacesClient;
  shooter: Screenshotter | null;
  bucket: Bucket | null;
  search: WebSearchProvider | null;
}

export function makeQualifyHandler(deps: QualifyDeps): JobHandler {
  const { db } = deps;

  return async (job: Job) => {
    const leadId = job.payload.placeId;
    if (!leadId) throw new Error('qualify job payload is missing placeId.');

    const cfg = await readAgentsConfig(db);
    if (!agentEnabled(cfg, 'qualifier')) {
      throw new Error('Qualifier is disabled (kill switch or per-agent toggle).');
    }
    if (await isAgentBudgetExhausted(db, cfg)) {
      // Surfaces as job status blocked_budget, same as the Places/Anthropic guards.
      throw new BudgetBlockedError('anthropic');
    }

    const leadRef = db.doc(leadPath(leadId));
    const snap = await leadRef.get();
    if (!snap.exists) throw new Error(`Lead ${leadId} not found.`);
    const lead = snap.data() as Lead;

    // Rail 4: a locked lead is off limits to every automated action, checked
    // before enqueuing work rather than only before acting on it.
    if (lead.agent?.locked) {
      throw new Error(`Lead ${leadId} is locked: ${lead.agent.lockReason ?? 'no reason recorded'}`);
    }

    const { runId, logger } = await openRun(db, 'qualifier', leadId);

    const result = await qualifyLead({
      db,
      client: deps.client,
      leadId,
      lead,
      caps: cfg.perRun.qualifier,
      runId,
      logger,
      tools: qualifierTools({
        db,
        places: deps.places,
        lang: lead.country === 'RS' ? 'sr' : 'en',
        shooter: deps.shooter,
        bucket: deps.bucket,
        search: deps.search,
      }),
      // Server-side search unless a client-side provider is configured.
      serverSearch: deps.search === null,
      // Re-read the switch each step so flipping it stops a run in flight.
      shouldAbort: async () => {
        const fresh = await readAgentsConfig(db);
        return !agentEnabled(fresh, 'qualifier');
      },
    });

    await recordAgentSpend(db, result.costUsd);
    await closeRun(db, runId, result, result.status === 'done' ? null : result.rationale);

    if (result.status !== 'done' || result.output === null) {
      throw new Error(`Qualifier ended ${result.status}: ${result.rationale}`);
    }

    const qualification: Qualification = result.output;

    // One transaction, at the end (AGENTS.md §2.1).
    await db.runTransaction(async (tx) => {
      tx.update(leadRef, {
        qualification,
        agent: {
          lastRunAt: Timestamp.now(),
          lastRunId: runId,
          locked: lead.agent?.locked ?? false,
          lockReason: lead.agent?.lockReason ?? null,
        },
      });
      tx.set(db.collection(COLLECTIONS.events).doc(), {
        leadId,
        type: qualification.verdict === 'discard' ? 'discarded' : 'qualified',
        at: FieldValue.serverTimestamp(),
        meta: {
          verdict: qualification.verdict,
          fitScore: qualification.fitScore,
          confidence: qualification.confidence,
          runId,
        },
      });
    });
  };
}
