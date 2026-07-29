/**
 * Anthropic API client (SPEC §7/§8, CLAUDE.md AI rules). Model is
 * `claude-sonnet-4-6` per SPEC, overridable via ANTHROPIC_MODEL. Behind an
 * interface so the ai-worker can be verified with a fake (no live key).
 *
 * The client only makes the call and reports token usage; budget guarding and
 * defensive JSON parsing live in the handlers.
 */

import Anthropic from '@anthropic-ai/sdk';

/** SPEC §2/CLAUDE.md: claude-sonnet-4-6. Env override for easy bumping. */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export interface GenerateParams {
  system: string;
  user: string;
  maxTokens: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AnthropicClient {
  generate(params: GenerateParams): Promise<GenerateResult>;
}

export class AnthropicApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnthropicApiError';
  }
}

/**
 * Raw SDK handle for the agent loop, which needs multi-turn tool use and so
 * cannot go through the single-shot `generate` interface above. Kept separate
 * rather than widening AnthropicClient, so the v2 workers are untouched.
 */
export function createRawAnthropic(apiKey: string): Anthropic {
  if (!apiKey) throw new AnthropicApiError('ANTHROPIC_API_KEY is not set (workers/.env).');
  return new Anthropic({ apiKey });
}

export function createAnthropicClient(apiKey: string): AnthropicClient {
  // Lazily constructed so a missing key fails the job, not worker startup.
  let sdk: Anthropic | null = null;
  function client(): Anthropic {
    if (!apiKey) throw new AnthropicApiError('ANTHROPIC_API_KEY is not set (workers/.env).');
    if (!sdk) sdk = new Anthropic({ apiKey });
    return sdk;
  }

  return {
    async generate({ system, user, maxTokens }: GenerateParams): Promise<GenerateResult> {
      let message: Anthropic.Message;
      try {
        message = await client().messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        });
      } catch (err) {
        throw new AnthropicApiError(`Anthropic request failed: ${String(err)}`);
      }
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return {
        text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    },
  };
}
