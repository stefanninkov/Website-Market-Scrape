/**
 * PageSpeed Insights client (SPEC §2, §6). Free tier, 25k/day. Returns the
 * mobile performance score 0-100, or null on any error/quota — the analyzer
 * treats PSI as best-effort and skips gracefully (CLAUDE.md error handling).
 */

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface PageSpeedClient {
  mobileScore(url: string): Promise<number | null>;
}

export function createPageSpeedClient(apiKey: string | undefined): PageSpeedClient {
  return {
    async mobileScore(url: string): Promise<number | null> {
      try {
        const params = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
        if (apiKey) params.set('key', apiKey);
        const res = await fetch(`${PSI_URL}?${params.toString()}`, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          lighthouseResult?: { categories?: { performance?: { score?: number } } };
        };
        const score = data.lighthouseResult?.categories?.performance?.score;
        if (typeof score !== 'number') return null;
        return Math.round(score * 100); // Lighthouse reports 0..1
      } catch {
        return null; // quota, network, timeout → skip
      }
    },
  };
}
