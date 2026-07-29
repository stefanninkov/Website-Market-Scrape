/**
 * Agent run persistence (AGENTS.md §8.1).
 *
 * "An agent you cannot read is an agent you cannot tune" (CLAUDE.md), so every
 * model turn and tool call is appended to `agentRuns/{runId}/steps` as it
 * happens. The run document itself is opened at the start and closed once,
 * which is what makes the feed readable while a run is still going.
 *
 * Lead state is deliberately *not* written here. That happens in one
 * transaction in the handler after the loop returns, so a capped or failed run
 * leaves the lead untouched.
 */

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  AGENT_STEPS_SUBCOLLECTION,
  COLLECTIONS,
  agentRunPath,
  applyAgentSpend,
  configPath,
  isAgentBudgetBlocked,
  type AgentId,
  type AgentRunResult,
  type AgentsConfig,
  type ApiBudget,
} from '@wms/shared';
import type { AgentLogger } from './loop.js';
import { truncateForLog } from './tools/registry.js';

export interface OpenRun {
  runId: string;
  logger: AgentLogger;
}

/** Creates the run doc and returns a logger that appends steps to it. */
export async function openRun(
  db: Firestore,
  agentId: AgentId,
  leadId: string,
): Promise<OpenRun> {
  const ref = db.collection(COLLECTIONS.agentRuns).doc();
  await ref.set({
    agentId,
    leadId,
    status: 'running',
    confidence: 0,
    rationale: '',
    steps: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    startedAt: Timestamp.now(),
    finishedAt: null,
    error: null,
    outputRef: null,
  });

  let n = 0;
  const logger: AgentLogger = {
    async step(entry) {
      const index = n++;
      await ref
        .collection(AGENT_STEPS_SUBCOLLECTION)
        .doc(String(index).padStart(4, '0'))
        .set({
          role: entry.role,
          toolName: entry.toolName,
          inputSummary: truncateForLog(entry.inputSummary),
          outputSummary: truncateForLog(entry.outputSummary),
          at: Timestamp.now(),
          tokens: entry.tokens,
        });
    },
  };

  return { runId: ref.id, logger };
}

/** Closes the run doc with the loop's result. Never throws. */
export async function closeRun<T>(
  db: Firestore,
  runId: string,
  result: AgentRunResult<T>,
  error: string | null,
  outputRef: string | null = null,
): Promise<void> {
  try {
    await db.doc(agentRunPath(runId)).update({
      status: result.status,
      confidence: result.confidence,
      rationale: result.rationale,
      steps: result.steps,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      finishedAt: FieldValue.serverTimestamp(),
      error,
      outputRef,
    });
  } catch {
    // A run that finished but could not be closed must not fail the job.
  }
}

// ---------------------------------------------------------------------------
// config/agents
// ---------------------------------------------------------------------------

/** Caps from AGENTS.md §4 to §7. */
export const DEFAULT_AGENTS_CONFIG: AgentsConfig = {
  enabled: true,
  qualifier: true,
  researcher: false,
  outreach: false,
  preview: false,
  autoQualifyOnAnalyze: true,
  highValueNiches: [],
  monthlyAgentBudgetUsd: 60,
  perRun: {
    qualifier: { maxSteps: 20, maxTokens: 60_000, maxSeconds: 90 },
    researcher: { maxSteps: 25, maxTokens: 100_000, maxSeconds: 150 },
    outreach: { maxSteps: 12, maxTokens: 40_000, maxSeconds: 120 },
    preview: { maxSteps: 30, maxTokens: 150_000, maxSeconds: 300 },
  },
};

/** Reads config/agents, falling back to defaults when the doc is absent. */
export async function readAgentsConfig(db: Firestore): Promise<AgentsConfig> {
  const snap = await db.doc(configPath('agents')).get();
  if (!snap.exists) return DEFAULT_AGENTS_CONFIG;
  const data = snap.data() as Partial<AgentsConfig>;
  return {
    ...DEFAULT_AGENTS_CONFIG,
    ...data,
    perRun: { ...DEFAULT_AGENTS_CONFIG.perRun, ...(data.perRun ?? {}) },
  };
}

/**
 * Global kill switch plus the per-agent toggle. Read fresh before every run so
 * flipping it stops new runs within one poll interval (AGENTS.md §10.8).
 */
export function agentEnabled(cfg: AgentsConfig, agentId: AgentId): boolean {
  return cfg.enabled && cfg[agentId];
}

/** Monthly agent budget check (AGENTS.md §8.4). */
export async function isAgentBudgetExhausted(
  db: Firestore,
  cfg: AgentsConfig,
): Promise<boolean> {
  const snap = await db.doc(configPath('apiBudget')).get();
  if (!snap.exists) return false;
  return isAgentBudgetBlocked(snap.data() as ApiBudget, cfg.monthlyAgentBudgetUsd);
}

/** Records agent spend on the monthly, daily and anthropic counters. */
export async function recordAgentSpend(db: Firestore, usd: number): Promise<void> {
  if (usd <= 0) return;
  const ref = db.doc(configPath('apiBudget'));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    tx.set(ref, applyAgentSpend(snap.data() as ApiBudget, usd), { merge: true });
  });
}
