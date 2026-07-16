import { describe, expect, it } from 'vitest';
import {
  detectTechStack,
  extractCopyrightYear,
  MAX_SCORE,
  POINTS,
  scoreSite,
  type SiteObservations,
} from './analysis.js';
import { classifyWebsiteType, WEBSITE_TYPE_SCORE } from './classify.js';

const CURRENT_YEAR = 2026;

// A reachable, modern, secure site: no points.
const goodSite: SiteObservations = {
  isHttps: true,
  sslValid: true,
  unreachable: false,
  parked: false,
  hasViewportMeta: true,
  hasHorizontalOverflow: false,
  copyrightYear: 2026,
  techStack: [],
  pagespeedMobile: 92,
  lastModifiedHeader: 'Wed, 01 Jul 2026 10:00:00 GMT',
};

describe('classifyWebsiteType', () => {
  it('treats empty/missing as none', () => {
    expect(classifyWebsiteType(null)).toBe('none');
    expect(classifyWebsiteType(undefined)).toBe('none');
    expect(classifyWebsiteType('   ')).toBe('none');
  });
  it('detects facebook (with and without scheme, subdomains)', () => {
    expect(classifyWebsiteType('https://facebook.com/biz')).toBe('facebook');
    expect(classifyWebsiteType('facebook.com/biz')).toBe('facebook');
    expect(classifyWebsiteType('https://www.facebook.com/biz')).toBe('facebook');
    expect(classifyWebsiteType('https://m.facebook.com/biz')).toBe('facebook');
    expect(classifyWebsiteType('https://fb.com/biz')).toBe('facebook');
  });
  it('detects instagram', () => {
    expect(classifyWebsiteType('https://instagram.com/biz')).toBe('instagram');
    expect(classifyWebsiteType('instagr.am/biz')).toBe('instagram');
  });
  it('treats a real domain as real', () => {
    expect(classifyWebsiteType('https://dentalplus.rs')).toBe('real');
    expect(classifyWebsiteType('example.co.uk')).toBe('real');
  });
  it('does not misclassify a domain that merely contains the word facebook', () => {
    expect(classifyWebsiteType('https://facebookmarketing-agency.rs')).toBe('real');
  });
  it('assigns the SPEC direct scores', () => {
    expect(WEBSITE_TYPE_SCORE.none).toBe(100);
    expect(WEBSITE_TYPE_SCORE.facebook).toBe(95);
    expect(WEBSITE_TYPE_SCORE.instagram).toBe(95);
  });
});

describe('extractCopyrightYear', () => {
  it('finds a single year', () => {
    expect(extractCopyrightYear('© 2015 Firma d.o.o.', CURRENT_YEAR)).toBe(2015);
  });
  it('returns the newest year in a range', () => {
    expect(extractCopyrightYear('Copyright 2014-2019 All rights reserved', CURRENT_YEAR)).toBe(2019);
  });
  it('ignores implausible years (phone numbers, addresses)', () => {
    expect(extractCopyrightYear('Call 021 4500 300, apt 1899', CURRENT_YEAR)).toBe(null);
  });
  it('ignores future years beyond next year', () => {
    expect(extractCopyrightYear('© 2099', CURRENT_YEAR)).toBe(null);
  });
  it('returns null when no year present', () => {
    expect(extractCopyrightYear('All rights reserved', CURRENT_YEAR)).toBe(null);
  });
});

describe('detectTechStack', () => {
  it('detects WordPress', () => {
    expect(detectTechStack({ html: '<link href="/wp-content/themes/x.css">', generatorMeta: null }))
      .toContain('WordPress (likely an aging theme)');
  });
  it('detects jQuery 1.x', () => {
    expect(detectTechStack({ html: '<script src="/js/jquery-1.11.3.min.js">', generatorMeta: null }))
      .toContain('jQuery 1.x (very outdated)');
  });
  it('detects layout tables', () => {
    expect(detectTechStack({ html: '<table cellpadding="0" cellspacing="0">', generatorMeta: null }))
      .toContain('Table-based layout (pre-2010 technique)');
  });
  it('detects Flash', () => {
    expect(detectTechStack({ html: '<embed src="intro.swf">', generatorMeta: null }))
      .toContain('Adobe Flash (dead technology)');
  });
  it('detects Wix free tier via generator meta', () => {
    expect(detectTechStack({ html: '<div>', generatorMeta: 'Wix.com Website Builder' }))
      .toContain('Wix free tier');
  });
  it('returns empty for a clean modern site', () => {
    expect(detectTechStack({ html: '<div class="hero"></div>', generatorMeta: null })).toEqual([]);
  });
});

describe('scoreSite', () => {
  it('scores a modern secure site at 0', () => {
    const r = scoreSite(goodSite, CURRENT_YEAR);
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
    expect(r.checks.https).toBe(true);
    expect(r.checks.responsive).toBe(true);
  });

  it('adds 25 for no HTTPS', () => {
    const r = scoreSite({ ...goodSite, isHttps: false }, CURRENT_YEAR);
    expect(r.score).toBe(POINTS.noHttps);
    expect(r.reasons[0]).toMatch(/HTTPS/);
  });

  it('adds 15 for missing viewport and marks not responsive', () => {
    const r = scoreSite({ ...goodSite, hasViewportMeta: false }, CURRENT_YEAR);
    expect(r.score).toBe(POINTS.noViewport);
    expect(r.checks.viewportMeta).toBe(false);
    expect(r.checks.responsive).toBe(false);
  });

  it('adds 10 for a stale copyright year', () => {
    const r = scoreSite({ ...goodSite, copyrightYear: 2016 }, CURRENT_YEAR);
    expect(r.score).toBe(POINTS.staleCopyright);
  });

  it('caps tech fingerprint points at 20 even with three fingerprints', () => {
    const r = scoreSite(
      { ...goodSite, techStack: ['a', 'b', 'c'] },
      CURRENT_YEAR,
    );
    expect(r.score).toBe(POINTS.techFingerprintCap);
  });

  it('scores PageSpeed bands correctly', () => {
    expect(scoreSite({ ...goodSite, pagespeedMobile: 30 }, CURRENT_YEAR).score).toBe(POINTS.pagespeedVeryLow);
    expect(scoreSite({ ...goodSite, pagespeedMobile: 50 }, CURRENT_YEAR).score).toBe(POINTS.pagespeedLow);
    expect(scoreSite({ ...goodSite, pagespeedMobile: 75 }, CURRENT_YEAR).score).toBe(0);
  });

  it('short-circuits on unreachable/parked with +30 and no DOM reasons', () => {
    const r = scoreSite(
      { ...goodSite, unreachable: true, isHttps: false, hasViewportMeta: false },
      CURRENT_YEAR,
    );
    expect(r.score).toBe(POINTS.unreachable);
    expect(r.reasons).toHaveLength(1);
  });

  it('caps the total at 100', () => {
    const worst: SiteObservations = {
      isHttps: false,
      sslValid: false,
      unreachable: false,
      parked: false,
      hasViewportMeta: false,
      hasHorizontalOverflow: true,
      copyrightYear: 2005,
      techStack: ['a', 'b'],
      pagespeedMobile: 10,
      lastModifiedHeader: null,
    };
    // 25 + 15 + 15 + 10 + 20 + 15 = 100
    expect(scoreSite(worst, CURRENT_YEAR).score).toBe(MAX_SCORE);
  });
});
