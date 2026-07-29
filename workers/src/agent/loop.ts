/**
 * Bounded tool-use loop (AGENTS.md §2.1).
 *
 * The contract that matters: **a run never ends by throwing**. Every exit path
 * — cap tripped, tool error, model error, invalid output, kill switch — returns
 * an `AgentRunResult` with a status. Callers write lead state in one
 * transaction *after* the loop returns, so a capped or failed run leaves the
 * lead untouched (CLAUDE.md agent rules).
 *
 * All three bounds are checked together before every model turn; whichever
 * trips first ends the run as `capped`.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL } from '../lib/anthropic.js';
import { z } from 'zod';
import { anthropicCostUsd, type AgentCaps, type AgentRunResult } from '@wms/shared';
import type { ToolContext, ToolRegistry } from './tools/registry.js';
import { toolResultText, truncateForLog } from './tools/registry.js';

/** SPEC §2 / CLAUDE.md: claude-sonnet-4-6, shared with the v2 workers. */
export { ANTHROPIC_MODEL as AGENT_MODEL } from '../lib/anthropic.js';

/** Max tokens per individual model turn. Not a run budget — that's caps.maxTokens. */
const MAX_TOKENS_PER_TURN = 4096;

export interface AgentLogger {
  /** Called for every model turn and every tool call. Must never throw. */
  step(entry: {
    role: 'model' | 'tool';
    toolName: string | null;
    inputSummary: string;
    outputSummary: string;
    tokens: number;
  }): Promise<void>;
}

export interface RunAgentParams<T> {
  client: Anthropic;
  caps: AgentCaps;
  system: string;
  /** The opening user message: the goal plus the lead context. */
  userMessage: string;
  tools: ToolRegistry;
  toolContext: ToolContext;
  /** The agent's output contract. Validated before the run is called `done`. */
  outputSchema: z.ZodType<T>;
  /**
   * Name of the tool the model calls to finish. Making submission a tool rather
   * than free text means the final answer arrives already shaped, and the model
   * cannot end a run by writing prose.
   */
  submitToolName: string;
  logger?: AgentLogger;
  /**
   * Checked before every model turn. Returning true ends the run as `aborted` —
   * this is how the global kill switch stops a run in flight (AGENTS.md §10.8).
   */
  shouldAbort?: () => Promise<boolean>;
  now?: () => number;
}

interface Totals {
  steps: number;
  tokensIn: number;
  tokensOut: number;
}

function result<T>(
  status: AgentRunResult<T>['status'],
  totals: Totals,
  rationale: string,
  output: T | null = null,
  confidence = 0,
): AgentRunResult<T> {
  return {
    status,
    output,
    confidence,
    rationale,
    steps: totals.steps,
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut,
    costUsd: anthropicCostUsd(totals.tokensIn, totals.tokensOut),
  };
}

/** Confidence and rationale ride on the submitted output when present. */
function readSelfAssessment(output: unknown): { confidence: number; rationale: string } {
  if (typeof output !== 'object' || output === null) return { confidence: 0, rationale: '' };
  const o = output as Record<string, unknown>;
  return {
    confidence: typeof o.confidence === 'number' ? o.confidence : 0,
    rationale: typeof o.rationale === 'string' ? o.rationale : '',
  };
}

export async function runAgent<T>(params: RunAgentParams<T>): Promise<AgentRunResult<T>> {
  const {
    client,
    caps,
    system,
    userMessage,
    tools,
    toolContext,
    outputSchema,
    submitToolName,
    logger,
    shouldAbort,
    now = () => Date.now(),
  } = params;

  const deadline = now() + caps.maxSeconds * 1000;
  const totals: Totals = { steps: 0, tokensIn: 0, tokensOut: 0 };
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  // One retry on schema failure, with the errors appended (AGENTS.md §2.1).
  let validationRetryUsed = false;

  const safeLog = async (entry: Parameters<AgentLogger['step']>[0]): Promise<void> => {
    if (!logger) return;
    try {
      await logger.step(entry);
    } catch {
      // Logging must never be able to fail a run.
    }
  };

  for (;;) {
    if (shouldAbort && (await shouldAbort().catch(() => false))) {
      return result('aborted', totals, 'Aborted: kill switch or lead lock.');
    }
    // All three axes, checked together, before spending anything.
    if (totals.steps >= caps.maxSteps) {
      return result('capped', totals, `Stopped at the ${caps.maxSteps}-step cap.`);
    }
    if (totals.tokensIn + totals.tokensOut >= caps.maxTokens) {
      return result('capped', totals, `Stopped at the ${caps.maxTokens}-token cap.`);
    }
    if (now() >= deadline) {
      return result('capped', totals, `Stopped at the ${caps.maxSeconds}s wall-clock cap.`);
    }

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS_PER_TURN,
        system,
        tools: tools.specs(),
        messages,
      });
    } catch (err) {
      return result('failed', totals, `Model call failed: ${String(err)}`);
    }

    totals.steps += 1;
    totals.tokensIn += response.usage.input_tokens;
    totals.tokensOut += response.usage.output_tokens;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const saidText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    await safeLog({
      role: 'model',
      toolName: null,
      inputSummary: truncateForLog(saidText),
      outputSummary: truncateForLog(toolUses.map((t) => t.name).join(', ') || '(no tool call)'),
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    if (toolUses.length === 0) {
      // The model answered in prose instead of submitting. Push it once toward
      // the submit tool rather than accepting unshaped output.
      if (validationRetryUsed) {
        return result('failed', totals, 'Model stopped without calling the submit tool.');
      }
      validationRetryUsed = true;
      messages.push(
        { role: 'assistant', content: response.content },
        {
          role: 'user',
          content: `Do not answer in prose. Call the ${submitToolName} tool with your final answer.`,
        },
      );
      continue;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let submitted: { block: Anthropic.ToolUseBlock; parsed: T } | null = null;
    let submitFailure: string | null = null;

    for (const use of toolUses) {
      if (use.name === submitToolName) {
        const check = outputSchema.safeParse(use.input);
        if (check.success) {
          submitted = { block: use, parsed: check.data };
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: 'accepted' });
          await safeLog({
            role: 'tool',
            toolName: use.name,
            inputSummary: truncateForLog(JSON.stringify(use.input)),
            outputSummary: 'accepted',
            tokens: 0,
          });
        } else {
          const issues = check.error.issues
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ');
          submitFailure = issues;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `Rejected. Fix these and call ${submitToolName} again: ${issues}`,
            is_error: true,
          });
          await safeLog({
            role: 'tool',
            toolName: use.name,
            inputSummary: truncateForLog(JSON.stringify(use.input)),
            outputSummary: truncateForLog(`rejected: ${issues}`),
            tokens: 0,
          });
        }
        continue;
      }

      // A tool that throws is reported back to the model as an error result
      // rather than ending the run — a dead link is not a reason to give up.
      const outcome = await tools.invoke(use.name, use.input, toolContext);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: toolResultText(outcome),
        ...(outcome.ok ? {} : { is_error: true as const }),
      });
      await safeLog({
        role: 'tool',
        toolName: use.name,
        inputSummary: truncateForLog(JSON.stringify(use.input)),
        outputSummary: truncateForLog(toolResultText(outcome)),
        tokens: 0,
      });
    }

    if (submitted) {
      const { confidence, rationale } = readSelfAssessment(submitted.parsed);
      return result('done', totals, rationale, submitted.parsed, confidence);
    }

    if (submitFailure !== null) {
      if (validationRetryUsed) {
        return result('failed', totals, `Output failed validation twice: ${submitFailure}`);
      }
      validationRetryUsed = true;
    }

    messages.push({ role: 'user', content: toolResults });
  }
}
