/**
 * generate_email handler (SPEC §7). Factory over {db, anthropic} so it can be
 * verified with a fake Anthropic client.
 *
 * Builds the prompt from lead data + analysis.reasons + preview.url +
 * config/toneGuide + config/identity, calls Claude for strict JSON
 * {subject, body}, parses defensively, zod-validates, retries once on invalid
 * JSON, tracks token spend through the budget guard, and saves an editable
 * draft. Never sends (CLAUDE.md).
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  anthropicCostUsd,
  configPath,
  emailDraftOutputSchema,
  leadPath,
  parseIdentity,
  type EmailDraftOutput,
  type Identity,
  type Job,
  type Lead,
} from '@wms/shared';
import type { JobHandler } from '../lib/queue.js';
import { assertBudget, recordSpend } from '../lib/budget.js';
import type { AnthropicClient } from '../lib/anthropic.js';
import { parseJsonLenient } from '../lib/parse.js';

const MAX_TOKENS = 1024;

interface PromptParts {
  system: string;
  user: string;
}

function isSerbian(lead: Lead): boolean {
  return lead.country === 'RS';
}

function buildEmailPrompt(
  lead: Lead,
  identity: Identity,
  toneGuide: string,
  steering: string | undefined,
): PromptParts {
  const serbian = isSerbian(lead);
  const lang = serbian
    ? 'Serbian (latinica). Write the entire email in Serbian using Latin script, never Cyrillic.'
    : 'English.';

  const system = [
    'You are FlowDev, a freelance web developer writing a short, warm, professional B2B cold email to a local business owner.',
    `Language: ${lang}`,
    'Hard rules:',
    '- Plain text only. No markdown, no HTML.',
    '- Body must be 120 words or fewer.',
    '- Exactly one clear call to action.',
    '- Must end with the sender identity and full postal address, then a one-line opt-out sentence (e.g. reply STOP to not be contacted again).',
    '- Warm and specific, never corporate-stiff, never insulting about their current website.',
    '- Leave no placeholders. Every field must be final text.',
    'Output ONLY strict JSON: {"subject": string, "body": string}. No prose, no code fences.',
  ].join('\n');

  const reasons = lead.analysis?.reasons ?? [];
  const previewLine =
    lead.preview.status === 'ready' && lead.preview.url
      ? `A free one-page website preview you built for them is live at: ${lead.preview.url} — reference it as something you already made for them.`
      : 'No preview link yet — invite them to a quick call instead of linking a preview.';

  const user = [
    `Business name: ${lead.name}`,
    `Niche: ${lead.category}`,
    `City/region: ${lead.region}, ${lead.country}`,
    lead.rating != null ? `Google rating: ${lead.rating} (${lead.reviewCount ?? 0} reviews)` : '',
    `Current web presence: ${lead.websiteType}`,
    reasons.length > 0
      ? `Observed weaknesses (address gently, never insultingly): ${reasons.join('; ')}`
      : '',
    previewLine,
    '',
    'Sender identity (use verbatim in the signature):',
    `- Name: ${identity.fullName}`,
    `- Business: ${identity.businessName}`,
    `- Address: ${identity.address}`,
    `- Booking link: ${identity.calLink}`,
    identity.emailSignature ? `- Signature: ${identity.emailSignature}` : '',
    '',
    toneGuide ? `Tone guide:\n${toneGuide}` : '',
    steering ? `\nExtra steering from the sender: ${steering}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

async function generateAndParse(
  db: Firestore,
  anthropic: AnthropicClient,
  prompt: PromptParts,
): Promise<EmailDraftOutput> {
  // First attempt.
  await assertBudget(db, 'anthropic');
  const first = await anthropic.generate({ ...prompt, maxTokens: MAX_TOKENS });
  await recordSpend(db, 'anthropic', anthropicCostUsd(first.inputTokens, first.outputTokens));

  const firstParsed = tryParse(first.text);
  if (firstParsed) return firstParsed;

  // One retry with a "return only valid JSON" reminder (CLAUDE.md).
  await assertBudget(db, 'anthropic');
  const retry = await anthropic.generate({
    system: prompt.system,
    user: `${prompt.user}\n\nYour previous reply was not valid JSON. Return ONLY the JSON object {"subject": string, "body": string} and nothing else.`,
    maxTokens: MAX_TOKENS,
  });
  await recordSpend(db, 'anthropic', anthropicCostUsd(retry.inputTokens, retry.outputTokens));

  const retryParsed = tryParse(retry.text);
  if (retryParsed) return retryParsed;

  throw new Error('Claude did not return valid email JSON after one retry.');
}

function tryParse(text: string): EmailDraftOutput | null {
  try {
    const parsed = emailDraftOutputSchema.safeParse(parseJsonLenient(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function makeEmailHandler(db: Firestore, anthropic: AnthropicClient): JobHandler {
  return async (job: Job) => {
    const placeId = job.payload.placeId;
    if (!placeId) throw new Error('generate_email job payload is missing placeId.');

    const leadRef = db.doc(leadPath(placeId));
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) throw new Error(`Lead ${placeId} not found.`);
    const lead = leadSnap.data() as Lead;

    const identitySnap = await db.doc(configPath('identity')).get();
    if (!identitySnap.exists) {
      throw new Error('config/identity is not set — fill in Settings before generating emails.');
    }
    const identity = parseIdentity(identitySnap);

    const toneSnap = await db.doc(configPath('toneGuide')).get();
    const toneGuide = toneSnap.exists ? ((toneSnap.data() as { text?: string }).text ?? '') : '';

    const prompt = buildEmailPrompt(lead, identity, toneGuide, job.payload.steering);
    const draft = await generateAndParse(db, anthropic, prompt);

    await leadRef.update({
      'outreach.draft': {
        subject: draft.subject,
        body: draft.body,
        generatedAt: Timestamp.now(),
      },
    });
  };
}
