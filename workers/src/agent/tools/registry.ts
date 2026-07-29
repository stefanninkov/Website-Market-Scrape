/**
 * Tool framework (AGENTS.md §3).
 *
 * A tool is a typed function with a zod input schema, a description written for
 * the model, and a cost profile. The registry is the only way the loop can
 * reach a tool, which makes it the enforcement point for the rails in
 * AGENTS.md §10:
 *
 *   - a tool the registry does not hold cannot be called
 *   - `writes` is declared per tool and audited by a unit test, so "no tool
 *     sends email, writes config, or deletes anything" is a property of the
 *     catalogue rather than a line in a prompt
 *   - per-run call caps are counted here, not left to the model's discretion
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';

/** 4KB cap on anything written to the step log (AGENTS.md §2.1). */
export const LOG_CAP_BYTES = 4096;

export function truncateForLog(s: string): string {
  if (s.length <= LOG_CAP_BYTES) return s;
  return `${s.slice(0, LOG_CAP_BYTES - 24)}… [truncated ${s.length - LOG_CAP_BYTES + 24}]`;
}

/**
 * What a tool is allowed to touch. Declared, not inferred. `none` means the
 * tool only reads. There is deliberately no value that permits sending or
 * deleting: those tools do not exist, and the type makes adding one a visible
 * change rather than a quiet one.
 */
export type ToolWrites = 'none' | 'lead_draft' | 'lead_followup' | 'storage';

export interface ToolCostProfile {
  /** Rough USD per call, for the run's cost estimate. 0 for free reads. */
  usdPerCall: number;
  /** Hard cap on calls per run. Undefined means only the step cap applies. */
  maxCallsPerRun?: number;
}

export interface ToolContext {
  db: Firestore;
  leadId: string;
  runId: string;
  /** Per-run call counts, keyed by tool name. Managed by the registry. */
  callCounts: Map<string, number>;
}

export type ToolOutcome =
  | { ok: true; text: string; images?: Array<{ mediaType: string; base64: string }> }
  | { ok: false; text: string };

export interface AgentTool<I> {
  name: string;
  /** Written for the model: what it does, when to use it, what it returns. */
  description: string;
  schema: z.ZodType<I>;
  /** JSON Schema for the Anthropic tools parameter. */
  jsonSchema: Record<string, unknown>;
  writes: ToolWrites;
  cost: ToolCostProfile;
  run(input: I, ctx: ToolContext): Promise<ToolOutcome>;
}

/** Erased tool type so the registry can hold tools of differing input types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAgentTool = AgentTool<any>;

export function toolResultText(outcome: ToolOutcome): string {
  return outcome.text;
}

export class ToolRegistry {
  private readonly tools = new Map<string, AnyAgentTool>();

  constructor(tools: AnyAgentTool[]) {
    for (const t of tools) {
      if (this.tools.has(t.name)) throw new Error(`Duplicate tool name: ${t.name}`);
      this.tools.set(t.name, t);
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): AnyAgentTool[] {
    return [...this.tools.values()];
  }

  /** Anthropic tool specs for the model turn. */
  specs(): Anthropic.Tool[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.jsonSchema as Anthropic.Tool['input_schema'],
    }));
  }

  /**
   * Never throws. A tool that fails returns an error outcome so the model can
   * adapt; the run continues (AGENTS.md §2.1).
   */
  async invoke(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, text: `No such tool: ${name}` };

    const used = ctx.callCounts.get(name) ?? 0;
    if (tool.cost.maxCallsPerRun !== undefined && used >= tool.cost.maxCallsPerRun) {
      return {
        ok: false,
        text: `${name} is capped at ${tool.cost.maxCallsPerRun} calls per run and has been used ${used} times. Work with what you have.`,
      };
    }

    const parsed = tool.schema.safeParse(rawInput);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return { ok: false, text: `Invalid input for ${name}: ${issues}` };
    }

    ctx.callCounts.set(name, used + 1);
    try {
      return await tool.run(parsed.data, ctx);
    } catch (err) {
      return { ok: false, text: `${name} failed: ${String(err)}` };
    }
  }

  /** Sum of per-call costs actually incurred. */
  incurredUsd(ctx: ToolContext): number {
    let total = 0;
    for (const [name, count] of ctx.callCounts) {
      const tool = this.tools.get(name);
      if (tool) total += tool.cost.usdPerCall * count;
    }
    return total;
  }
}

export function newToolContext(db: Firestore, leadId: string, runId: string): ToolContext {
  return { db, leadId, runId, callCounts: new Map() };
}
