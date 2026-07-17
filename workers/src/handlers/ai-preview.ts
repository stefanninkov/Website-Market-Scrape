/**
 * PreviewCopy generation (SPEC §8 contract). Authored as ai-worker code;
 * invoked from the preview pipeline so one `generate_preview` job covers
 * copy + render without inventing extra job types.
 */

import type { Firestore } from 'firebase-admin/firestore';
import {
  anthropicCostUsd,
  previewCopySchema,
  type Lead,
  type PreviewCopy,
} from '@wms/shared';
import { assertBudget, recordSpend } from '../lib/budget.js';
import type { AnthropicClient } from '../lib/anthropic.js';
import { parseJsonLenient } from '../lib/parse.js';

const MAX_TOKENS = 1500;

function buildPrompt(lead: Lead, toneGuide: string): { system: string; user: string } {
  const serbian = lead.country === 'RS';
  const lang = serbian
    ? 'Serbian (latinica). All content strings in Serbian using Latin script, never Cyrillic.'
    : 'English.';

  const system = [
    'You write landing-page copy for a one-page website concept for a local business.',
    `Language: ${lang}`,
    'Hard rules:',
    '- headline: 8 words or fewer. Confident, specific to the business, no clichés.',
    '- subheadline: 20 words or fewer.',
    '- about: 50-80 words, warm and human, first person plural ("we"/"mi").',
    '- services: 3 to 6 items; each blurb 15 words or fewer.',
    '- ctaLabel: short, e.g. "Pozovite nas" / "Get in touch".',
    '- metaDescription: one sentence for search/social.',
    '- If weaknesses of their current web presence are listed, let the copy quietly answer them (fast, mobile-friendly, easy to find) — never mention the old site or anything negative.',
    '- Invent nothing factual: no prices, no opening hours, no specific services you cannot infer from the niche.',
    'Output ONLY strict JSON: {"headline": string, "subheadline": string, "about": string, "services": [{"title": string, "blurb": string}], "ctaLabel": string, "metaDescription": string}. No prose, no code fences.',
  ].join('\n');

  const user = [
    `Business: ${lead.name}`,
    `Niche: ${lead.category}`,
    `City: ${lead.region}, ${lead.country}`,
    lead.rating != null ? `Google rating: ${lead.rating} (${lead.reviewCount ?? 0} reviews)` : '',
    lead.analysis?.reasons?.length
      ? `Current web-presence weaknesses (address subtly, never insultingly): ${lead.analysis.reasons.join('; ')}`
      : '',
    toneGuide ? `Tone guide:\n${toneGuide}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

function tryParse(text: string): PreviewCopy | null {
  try {
    const parsed = previewCopySchema.safeParse(parseJsonLenient(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Generate zod-valid PreviewCopy with one retry (CLAUDE.md AI rules). */
export async function generatePreviewCopy(
  db: Firestore,
  anthropic: AnthropicClient,
  lead: Lead,
  toneGuide: string,
): Promise<PreviewCopy> {
  const prompt = buildPrompt(lead, toneGuide);

  await assertBudget(db, 'anthropic');
  const first = await anthropic.generate({ ...prompt, maxTokens: MAX_TOKENS });
  await recordSpend(db, 'anthropic', anthropicCostUsd(first.inputTokens, first.outputTokens));
  const firstParsed = tryParse(first.text);
  if (firstParsed) return firstParsed;

  await assertBudget(db, 'anthropic');
  const retry = await anthropic.generate({
    system: prompt.system,
    user: `${prompt.user}\n\nYour previous reply was not valid JSON matching the contract. Return ONLY the JSON object and nothing else.`,
    maxTokens: MAX_TOKENS,
  });
  await recordSpend(db, 'anthropic', anthropicCostUsd(retry.inputTokens, retry.outputTokens));
  const retryParsed = tryParse(retry.text);
  if (retryParsed) return retryParsed;

  throw new Error('Claude did not return valid PreviewCopy JSON after one retry.');
}
