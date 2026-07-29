/**
 * A1, the qualifier (AGENTS.md §4).
 *
 * Goal, not instruction: "decide whether this business is worth a personalised
 * cold email from a one-person web studio, and say why."
 *
 * The six signals are named in the prompt in the order AGENTS.md gives them,
 * because that order is the weighting. The parts that must not depend on the
 * model reading carefully — evidence on every claim, disqualifiers matching the
 * verdict, the score range — are enforced by `qualificationSchema` instead.
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import {
  qualificationSchema,
  type AgentCaps,
  type AgentRunResult,
  type Lead,
  type Qualification,
} from '@wms/shared';
import { runAgent, type AgentLogger } from './loop.js';
import { QUALIFIER_SEARCH_MAX_USES, serverWebSearchSpec } from './tools/index.js';
import { ToolRegistry, newToolContext, type AnyAgentTool } from './tools/registry.js';
import type { Firestore } from 'firebase-admin/firestore';

export const SUBMIT_TOOL = 'submit_qualification';

const SYSTEM = `You decide which leads deserve a personalised cold email from Stefan, who runs FlowDev — a one-person web studio building small business websites in Serbia and the wider EU.

Your job is triage, not sales. Stefan's scarce resource is his attention: a sweep returns hundreds of businesses and he can only write a handful of good emails. A wrong "qualified" costs him an hour. A wrong "discard" costs him a customer. Being honestly unsure is cheaper than either.

Weigh these six things, in this order of importance:

1. ALIVE. Reviews in the last 6 months, published hours, recent photos. A business with 4 reviews and nothing since 2021 is dead. Discard it.
2. REACHABLE. An email, a contact form, or a named owner. No route to a human is a discard no matter how bad the site is.
3. ACTUALLY BAD. The analyzer score is mechanical. Take a 375px screenshot and judge the site as a customer would on a phone. A site scoring 72 that looks fine and works is not a prospect. A site scoring 45 that is a well-maintained Wix is a weak one. When the screenshot and the score disagree, trust the screenshot and say so in your rationale.
4. CAN PAY. Proxies only, never invention: review volume, price level, niche norms, multiple locations, staff or team mentions, published price lists. A 3-person salon in a village is a different conversation from a 12-chair salon in Novi Sad.
5. BUYS FROM A FREELANCER. Chains, franchises and anything with a corporate parent are discards. They have a procurement process, not a decision maker.
6. NOT ALREADY COVERED. A current copyright year and a modern stack mean someone already got this job.

Rules you must follow:

- Every entry in "evidence" needs a real source: a URL you fetched, a screenshot path you were given, a measured value, or "places:reviews". A claim you cannot source is a claim you must not make.
- "insufficient_data" is a legitimate and encouraged verdict. Use it when you genuinely cannot tell, rather than guessing confidently. Those leads go to a human.
- fitScore rates how good a PROSPECT this business is, from 0 to 100. It is not how bad the site is — a terrible site at a dying business is a low fitScore.
- confidence is your own calibration, 0 to 1. Lower it when a tool failed, when web search was unavailable, or when you are inferring rather than observing.
- Keep the rationale to 2-4 plain sentences that Stefan can act on without opening the lead.
- Work efficiently. Stop calling tools as soon as you can answer. You do not need every tool on every lead.
- You get ONE web search per run and it is reserved for signal 5: checking whether this business is a chain, a franchise, or has a corporate parent. Do not spend it on anything else.

Finish by calling ${SUBMIT_TOOL}. Do not answer in prose.`;

/** JSON Schema mirroring qualificationSchema, for the submit tool. */
const SUBMIT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['qualified', 'discard', 'insufficient_data'],
      description: 'insufficient_data is a real answer, not a failure',
    },
    fitScore: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'How good a prospect, not how bad the site',
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string', description: '2-4 plain sentences' },
    signals: {
      type: 'object',
      properties: {
        alive: { type: 'boolean' },
        reachable: { type: 'boolean' },
        siteVerdict: {
          type: 'string',
          enum: ['none', 'broken', 'dated', 'adequate', 'good'],
        },
        sizeProxy: { type: 'string', enum: ['micro', 'small', 'medium', 'unknown'] },
        isChain: { type: 'boolean' },
      },
      required: ['alive', 'reachable', 'siteVerdict', 'sizeProxy', 'isChain'],
      additionalProperties: false,
    },
    disqualifiers: {
      type: 'array',
      items: { type: 'string' },
      description: 'Empty when qualified. A discard must name at least one.',
    },
    evidence: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          source: {
            type: 'string',
            description: 'url, screenshot path, measured value, or "places:reviews"',
          },
        },
        required: ['claim', 'source'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'verdict',
    'fitScore',
    'confidence',
    'rationale',
    'signals',
    'disqualifiers',
    'evidence',
  ],
  additionalProperties: false,
};

/** The submit tool is a schema carrier; the loop validates and never runs it. */
export function submitQualificationSpec(): AnyAgentTool {
  return {
    name: SUBMIT_TOOL,
    description:
      'Submit your final qualification. Call this exactly once, when you have enough to decide or have concluded you cannot.',
    schema: z.unknown() as z.ZodType<unknown>,
    jsonSchema: SUBMIT_JSON_SCHEMA,
    writes: 'none',
    cost: { usdPerCall: 0 },
    async run() {
      return { ok: true as const, text: 'accepted' };
    },
  };
}

function openingMessage(lead: Lead, leadId: string): string {
  return [
    `Qualify this lead. Its place ID is ${leadId}.`,
    '',
    `Name: ${lead.name}`,
    `Niche: ${lead.category}`,
    `Where: ${lead.region}, ${lead.country}`,
    `Website: ${lead.websiteUrl ?? '(none listed on Google)'} (${lead.websiteType})`,
    `Google: ${lead.rating ?? '?'} from ${lead.reviewCount ?? 0} reviews`,
    `Contact on file: ${lead.email ?? 'no email'}, ${lead.phone ?? 'no phone'}`,
    '',
    'Start with read_lead. Judge the site from a screenshot before calling it bad.',
  ].join('\n');
}

export interface QualifyParams {
  db: Firestore;
  client: Anthropic;
  leadId: string;
  lead: Lead;
  caps: AgentCaps;
  tools: AnyAgentTool[];
  runId: string;
  logger?: AgentLogger;
  shouldAbort?: () => Promise<boolean>;
  /** False when a client-side provider is wired instead (PLAN.md §7). */
  serverSearch?: boolean;
}

export async function qualifyLead(
  params: QualifyParams,
): Promise<AgentRunResult<Qualification>> {
  const registry = new ToolRegistry([...params.tools, submitQualificationSpec()]);
  const ctx = newToolContext(params.db, params.leadId, params.runId);

  const result = await runAgent<Qualification>({
    client: params.client,
    caps: params.caps,
    system: SYSTEM,
    userMessage: openingMessage(params.lead, params.leadId),
    tools: registry,
    toolContext: ctx,
    outputSchema: qualificationSchema as unknown as z.ZodType<Qualification>,
    submitToolName: SUBMIT_TOOL,
    serverTools:
      params.serverSearch === false ? [] : [serverWebSearchSpec(QUALIFIER_SEARCH_MAX_USES)],
    ...(params.logger ? { logger: params.logger } : {}),
    ...(params.shouldAbort ? { shouldAbort: params.shouldAbort } : {}),
  });

  // Tool-side spend (a Places call) is real money the model caused, so it is
  // added to the run's cost rather than tracked separately.
  return { ...result, costUsd: result.costUsd + registry.incurredUsd(ctx) };
}
