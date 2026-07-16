/**
 * sweep handler (SPEC §5). Built as a factory over its dependencies so it can
 * be verified against a fake PlacesClient with no live API key.
 *
 * Flow per queued `sweep` job:
 *   1. Load the sweep doc (payload.sweepId).
 *   2. Per niche: Text Search "{niche} in {region}, {country}", up to 3 pages.
 *   3. Dedupe place IDs across the run.
 *   4. New place IDs → Place Details → classify websiteType → upsert lead.
 *        - none/facebook/instagram: direct score, analysis skipped.
 *        - real: analysis pending, enqueue an `analyze` job.
 *      Existing place IDs → bump lastSeenAt only.
 *   5. Write sweep stats + lastRunAt.
 *
 * Every metered call is wrapped by the budget guard (assertBudget before,
 * recordSpend after). A budget block aborts the job as blocked_budget; leads
 * already upserted persist (idempotent by placeId).
 */

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  classifyWebsiteType,
  COLLECTIONS,
  emptyOutreach,
  emptyPreview,
  isDirectScored,
  leadPath,
  parseSweep,
  PLACES_DETAILS_USD,
  PLACES_TEXT_SEARCH_USD,
  WEBSITE_TYPE_SCORE,
  type Job,
  type Lead,
  type LeadAnalysis,
  type WebsiteType,
} from '@wms/shared';
import type { JobHandler } from '../lib/queue.js';
import { assertBudget, recordSpend } from '../lib/budget.js';
import type { PlaceDetails, PlacesClient } from '../lib/places.js';

const MAX_PAGES = 3; // SPEC §5.2: max 3 pages (60 results) per query

function reasonsForDirectScore(type: 'none' | 'facebook' | 'instagram'): string[] {
  switch (type) {
    case 'none':
      return ['No website listed on Google — a clean opportunity.'];
    case 'facebook':
      return ['Uses a Facebook page instead of a real website.'];
    case 'instagram':
      return ['Uses an Instagram page instead of a real website.'];
  }
}

/** Build the analysis subobject for a direct-scored (non-analyzed) lead. */
function directAnalysis(type: 'none' | 'facebook' | 'instagram', now: Timestamp): LeadAnalysis {
  return {
    status: 'skipped',
    score: WEBSITE_TYPE_SCORE[type],
    checks: {
      https: false,
      responsive: false,
      viewportMeta: false,
      copyrightYear: null,
      techStack: [],
      pagespeedMobile: null,
      sslValid: false,
      lastModifiedHeader: null,
    },
    reasons: reasonsForDirectScore(type),
    analyzedAt: now,
  };
}

function buildLead(
  details: PlaceDetails,
  niche: string,
  sweep: { country: string; region: string },
  websiteType: WebsiteType,
  isNewBusiness: boolean,
  now: Timestamp,
): Lead {
  const direct = isDirectScored(websiteType);
  return {
    placeId: details.placeId,
    name: details.name,
    category: niche,
    country: sweep.country,
    region: sweep.region,
    address: details.address,
    phone: details.phone,
    websiteUrl: details.websiteUrl,
    websiteType,
    rating: details.rating,
    reviewCount: details.reviewCount,
    firstSeenAt: now,
    lastSeenAt: now,
    isNewBusiness,
    // real → analyzer fills this (Phase 2); pending placeholder for now.
    analysis: direct
      ? directAnalysis(websiteType, now)
      : {
          status: 'pending',
          score: 0,
          checks: {
            https: false,
            responsive: false,
            viewportMeta: false,
            copyrightYear: null,
            techStack: [],
            pagespeedMobile: null,
            sslValid: false,
            lastModifiedHeader: null,
          },
          reasons: [],
          analyzedAt: now,
        },
    stage: 'new',
    notes: '',
    email: null,
    emailSource: null,
    outreach: emptyOutreach(),
    preview: emptyPreview(),
  };
}

async function enqueueAnalyze(db: Firestore, placeId: string, now: Timestamp): Promise<void> {
  await db.collection(COLLECTIONS.jobs).add({
    type: 'analyze',
    payload: { placeId },
    status: 'queued',
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    error: null,
  });
}

export function makeSweepHandler(db: Firestore, places: PlacesClient): JobHandler {
  return async (job: Job) => {
    const sweepId = job.payload.sweepId;
    if (!sweepId) throw new Error('sweep job payload is missing sweepId.');

    const sweepRef = db.collection(COLLECTIONS.sweeps).doc(sweepId);
    const sweepSnap = await sweepRef.get();
    if (!sweepSnap.exists) throw new Error(`Sweep ${sweepId} not found.`);
    const sweep = parseSweep(sweepSnap);

    // Re-runs flag brand-new place IDs as hot "new business" leads (SPEC §5.6).
    const flagNewBusiness = sweep.lastRunAt !== null;

    // 1–3: collect deduped place IDs across all niche queries.
    const seen = new Set<string>();
    for (const niche of sweep.niches) {
      const query = `${niche} in ${sweep.region}, ${sweep.country}`;
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        await assertBudget(db, 'places');
        const result = await places.textSearch(query, sweep.country, pageToken);
        await recordSpend(db, 'places', PLACES_TEXT_SEARCH_USD);
        for (const id of result.placeIds) seen.add(id);
        if (!result.nextPageToken) break;
        pageToken = result.nextPageToken;
      }
    }

    // 4: Details + upsert for new IDs; bump lastSeenAt for existing.
    let totalFound = 0;
    let noWebsite = 0;
    let newLastRun = 0;

    for (const placeId of seen) {
      totalFound += 1;
      const now = Timestamp.now();
      const leadRef = db.doc(leadPath(placeId));
      const existing = await leadRef.get();

      if (existing.exists) {
        await leadRef.update({ lastSeenAt: now });
        const type = (existing.data() as Lead).websiteType;
        if (type === 'none' || type === 'facebook' || type === 'instagram') noWebsite += 1;
        continue;
      }

      await assertBudget(db, 'places');
      const details = await places.placeDetails(placeId);
      await recordSpend(db, 'places', PLACES_DETAILS_USD);

      // Prefer the niche that produced this place: it's the first niche whose
      // query matched. We don't track that per-ID, so use the sweep's niches[0]
      // as the category when multiple niches share the sweep. Single-niche
      // sweeps (the common case) are exact.
      const niche = sweep.niches[0] ?? details.primaryType ?? 'business';
      const websiteType = classifyWebsiteType(details.websiteUrl);
      const lead = buildLead(details, niche, sweep, websiteType, flagNewBusiness, now);

      await leadRef.set(lead);
      newLastRun += 1;
      if (isDirectScored(websiteType)) {
        noWebsite += 1;
      } else if (websiteType === 'real') {
        await enqueueAnalyze(db, placeId, now);
      }
    }

    // 5: sweep stats.
    await sweepRef.update({
      lastRunAt: FieldValue.serverTimestamp(),
      stats: { totalFound, noWebsite, newLastRun },
    });
  };
}
