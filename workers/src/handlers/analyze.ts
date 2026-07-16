/**
 * analyze handler (SPEC §6). Factory over {db, analyzer, psi} so it can be
 * driven against local fixture pages with the real Playwright analyzer.
 *
 * Per queued `analyze` job:
 *   1. Load the lead; require a real website URL.
 *   2. Playwright audit → raw observations + scraped emails.
 *   3. PSI mobile score (best-effort, free, skips on error).
 *   4. Pure scoreSite() → score + reasons + checks; write analysis: done.
 *   5. If the lead has no email and one was scraped, set it (site_scrape).
 */

import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { leadPath, scoreSite, type Job, type Lead } from '@wms/shared';
import type { JobHandler } from '../lib/queue.js';
import type { SiteAnalyzer } from '../lib/analyzer.js';
import type { PageSpeedClient } from '../lib/pagespeed.js';

export function makeAnalyzeHandler(
  db: Firestore,
  analyzer: SiteAnalyzer,
  psi: PageSpeedClient,
): JobHandler {
  return async (job: Job, ref: DocumentReference) => {
    const placeId = job.payload.placeId;
    if (!placeId) throw new Error('analyze job payload is missing placeId.');

    const leadRef = db.doc(leadPath(placeId));
    const snap = await leadRef.get();
    if (!snap.exists) throw new Error(`Lead ${placeId} not found.`);
    const lead = snap.data() as Lead;

    if (!lead.websiteUrl) {
      // Nothing to analyze; record skipped rather than failing the pipeline.
      await leadRef.update({
        'analysis.status': 'skipped',
        'analysis.reasons': ['No website URL to analyze.'],
        'analysis.analyzedAt': Timestamp.now(),
      });
      return;
    }

    try {
      const { observations, emails } = await analyzer.analyze(lead.websiteUrl);
      const pagespeedMobile = observations.unreachable
        ? null
        : await psi.mobileScore(lead.websiteUrl);
      const scored = scoreSite({ ...observations, pagespeedMobile }, new Date().getFullYear());

      const update: Record<string, unknown> = {
        analysis: {
          status: 'done',
          score: scored.score,
          checks: scored.checks,
          reasons: scored.reasons,
          analyzedAt: Timestamp.now(),
        },
      };

      // Fill in a scraped email only when we don't already have one.
      if (!lead.email && emails.length > 0) {
        update.email = emails[0];
        update.emailSource = 'site_scrape';
      }

      await leadRef.update(update);
    } catch (err) {
      // Analyzer blew up (e.g. browser launch): mark the lead's analysis failed
      // and let the queue mark the job failed too.
      await leadRef.update({
        'analysis.status': 'failed',
        'analysis.reasons': [`Analysis failed: ${err instanceof Error ? err.message : String(err)}`],
        'analysis.analyzedAt': Timestamp.now(),
      });
      throw err;
    }

    void ref; // (queue passes the job ref; not needed here)
  };
}
