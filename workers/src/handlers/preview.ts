/**
 * generate_preview handler (SPEC §8). One job covers the whole pipeline:
 *   1. status → generating
 *   2. PreviewCopy via Claude (kept on regenerate only if template changed?
 *      no — regenerate always makes fresh copy; SPEC allows regenerate)
 *   3. slug: keep the existing one on regenerate (stable links), else mint
 *   4. pick hero image from Storage niche-images/{niche}/ deterministically,
 *      embed as data URI (self-contained HTML); gradient fallback
 *   5. render template + copy + business data → previews/{slug}.html
 *   6. render OG card → previews/{slug}-og.png
 *   7. lead.preview → ready
 * On failure: preview.status → failed and the job fails.
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '../lib/firebase.js';
import {
  configPath,
  leadPath,
  makeSlug,
  parseIdentity,
  templateForNiche,
  type Job,
  type Lead,
  type TemplateId,
} from '@wms/shared';
import type { JobHandler } from '../lib/queue.js';
import type { AnthropicClient } from '../lib/anthropic.js';
import type { OgRenderer } from '../lib/og.js';
import { generatePreviewCopy } from './ai-preview.js';
import { renderOgCard, renderPreview } from '../lib/render.js';

const MAX_HERO_BYTES = 300 * 1024; // keep pages light (DESIGN: ~150KB hero target)

function mimeFor(name: string): string | null {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return null;
}

/** Stable small hash for deterministic image picks. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Curated niche image (Storage niche-images/{niche}/), embedded as a data URI
 * so the preview stays a single self-contained file. Null → gradient fallback.
 */
async function pickHeroImage(bucket: Bucket, niche: string, placeId: string): Promise<string | null> {
  try {
    const [files] = await bucket.getFiles({ prefix: `niche-images/${niche.toLowerCase()}/` });
    const images = files.filter((f) => mimeFor(f.name));
    if (images.length === 0) return null;
    const pick = images[hashCode(placeId) % images.length];
    if (!pick) return null;
    const [meta] = await pick.getMetadata();
    if (Number(meta.size ?? 0) > MAX_HERO_BYTES) return null;
    const [buf] = await pick.download();
    return `data:${mimeFor(pick.name)};base64,${buf.toString('base64')}`;
  } catch {
    return null; // storage hiccup → gradient, never fail the preview
  }
}

export interface PreviewDeps {
  db: Firestore;
  bucket: Bucket;
  anthropic: AnthropicClient;
  og: OgRenderer;
  baseUrl: string;
}

export function makePreviewHandler(deps: PreviewDeps): JobHandler {
  const { db, bucket, anthropic, og, baseUrl } = deps;

  return async (job: Job) => {
    const placeId = job.payload.placeId;
    if (!placeId) throw new Error('generate_preview job payload is missing placeId.');

    const leadRef = db.doc(leadPath(placeId));
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) throw new Error(`Lead ${placeId} not found.`);
    const lead = leadSnap.data() as Lead;

    const identitySnap = await db.doc(configPath('identity')).get();
    const calLink = identitySnap.exists ? parseIdentity(identitySnap).calLink : '';

    const toneSnap = await db.doc(configPath('toneGuide')).get();
    const toneGuide = toneSnap.exists ? ((toneSnap.data() as { text?: string }).text ?? '') : '';

    await leadRef.update({ 'preview.status': 'generating' });

    try {
      // Manual override from the job wins; else keep current; else by niche.
      const templateId: TemplateId =
        job.payload.templateId ?? lead.preview.templateId ?? templateForNiche(lead.category);

      const copy = await generatePreviewCopy(db, anthropic, lead, toneGuide);

      // Stable link on regenerate: keep the existing slug.
      const slug = lead.preview.slug ?? makeSlug(lead.name);

      const heroImageUrl = await pickHeroImage(bucket, lead.category, placeId);
      const html = renderPreview({ lead, copy, templateId, slug, baseUrl, calLink, heroImageUrl });
      const ogPng = await og.renderPng(renderOgCard(lead, templateId));

      await bucket.file(`previews/${slug}.html`).save(html, {
        contentType: 'text/html; charset=utf-8',
        resumable: false,
      });
      await bucket.file(`previews/${slug}-og.png`).save(ogPng, {
        contentType: 'image/png',
        resumable: false,
      });

      await leadRef.update({
        preview: {
          status: 'ready',
          slug,
          url: `${baseUrl}/p/${slug}`,
          templateId,
          copy,
          generatedAt: Timestamp.now(),
          views: lead.preview.views ?? 0,
          lastViewAt: lead.preview.lastViewAt ?? null,
        },
      });
    } catch (err) {
      await leadRef.update({ 'preview.status': 'failed' });
      throw err;
    }
  };
}
