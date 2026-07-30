/**
 * Composer (PREVIEW-SYSTEM.md §2, §4).
 *
 * Resolves a CompositionSpec against the data that actually exists and renders
 * it. Rendering is pure: the same spec plus the same data always produces the
 * same bytes, which is what makes regeneration safe for links already sent.
 *
 * A section whose required data is missing is not in the spec. That is the
 * whole reason nothing here needs placeholder content.
 */

import type { ArtDirectionId, Lead, PreviewCopy } from '@wms/shared';
import { artDirection, fontHref, tokenBlock, type ArtDirection } from './art-directions.js';
import {
  STRINGS,
  about,
  esc,
  footer,
  hero,
  hours,
  reviews,
  services,
  visit,
  type Lang,
} from './sections.js';

export interface ComposeParams {
  lead: Lead;
  copy: PreviewCopy;
  artDirectionId: ArtDirectionId;
  slug: string;
  baseUrl: string;
  calLink: string;
  /** data: URI or URL for the hero. Null → type-led hero. */
  heroImage: string | null;
  aboutImage: string | null;
}

/** First sentence of the about copy, so the About lead never repeats the hero. */
function splitAbout(text: string): { lead: string; body: string } {
  const m = text.match(/^(.+?[.!?])\s+(.*)$/s);
  if (!m || m[1]!.length < 24 || m[2]!.trim().length < 40) return { lead: '', body: text };
  return { lead: m[1]!.trim(), body: m[2]!.trim() };
}

function pageCss(ad: ArtDirection): string {
  return `${tokenBlock(ad)}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--font-text);font-size:var(--step-0);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:600;letter-spacing:-.02em;line-height:1.06}
a{color:inherit}
img{max-width:100%;display:block;object-fit:cover}
section{padding:calc(var(--gap-unit)*7) calc(var(--gap-unit)*3)}
.eyebrow{display:inline-block;font-family:var(--font-text);font-size:var(--step--1);font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.rule{display:block;width:96px;height:1px;background:var(--line);margin:calc(var(--gap-unit)*3) 0}
.cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 calc(var(--gap-unit)*4);border-radius:var(--radius);background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;letter-spacing:.01em;transition:transform calc(var(--motion)*.16s) cubic-bezier(.2,0,0,1)}
@media(hover:hover){.cta:hover{transform:translateY(-2px)}}
.cta.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}

/* hero */
.hero{padding-top:calc(var(--gap-unit)*7);padding-bottom:calc(var(--gap-unit)*8)}
.hero h1{font-size:clamp(2.6rem,5.4vw,4.6rem);max-width:13ch;letter-spacing:-.03em}
.hero .lede{margin-top:calc(var(--gap-unit)*3);color:var(--ink-dim);font-size:var(--step-1);max-width:38ch}
.hero-meta{display:flex;align-items:center;gap:calc(var(--gap-unit)*2);font-size:var(--step--1);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim)}
.hero-meta i{width:4px;height:4px;border-radius:50%;background:var(--accent);display:block}
.hero .cta{margin-top:calc(var(--gap-unit)*4)}
.hero-proof{margin-top:calc(var(--gap-unit)*3);font-size:var(--step--1);color:var(--ink-dim)}
.hero-proof b{color:var(--accent)}
.hero-visual{border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.hero-visual img{width:100%;height:100%;min-height:420px;aspect-ratio:6/7}
.hero.type-led h1{font-size:clamp(2.8rem,7vw,6rem);max-width:15ch}

/* about */
.about h2{font-size:clamp(1.7rem,3.4vw,2.9rem);margin-top:calc(var(--gap-unit)*2);max-width:18ch}
.about p{margin-top:calc(var(--gap-unit)*3);color:var(--ink-dim);max-width:56ch}
.about-visual{border-radius:var(--radius);overflow:hidden;margin-top:calc(var(--gap-unit)*5);box-shadow:var(--shadow)}
.about-visual img{width:100%;aspect-ratio:4/5;max-height:620px}

/* services */
.services .sec-head{margin-bottom:calc(var(--gap-unit)*5)}
.svc-grid{display:grid;gap:calc(var(--gap-unit)*5)}
.svc{position:relative;padding-top:calc(var(--gap-unit)*3);border-top:1px solid var(--line)}
.svc-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:1px solid var(--accent);color:var(--accent);font-size:var(--step--1);font-weight:600;margin-bottom:calc(var(--gap-unit)*2)}
.svc h3{font-size:var(--step-1)}
.svc p{margin-top:calc(var(--gap-unit)*1.5);color:var(--ink-dim);font-size:calc(var(--step-0)*.95);max-width:34ch}

/* hours */
.hours{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.hours h2{font-size:clamp(1.7rem,3.4vw,2.9rem);margin-top:calc(var(--gap-unit)*2)}
.hours .cta{margin-top:calc(var(--gap-unit)*4)}
.hours-list{margin-top:calc(var(--gap-unit)*5)}
.hrow{display:flex;justify-content:space-between;gap:calc(var(--gap-unit)*2);padding:calc(var(--gap-unit)*2) 0;border-bottom:1px solid var(--line);font-size:calc(var(--step-0)*.97)}
.hrow span{color:var(--ink-dim)}
.hrow b{font-variant-numeric:tabular-nums;font-weight:600}
.hrow.closed b{color:var(--ink-dim);font-weight:400}

/* reviews */
.reviews{text-align:center;background:var(--ink);color:var(--bg)}
.reviews .stars{color:var(--accent);letter-spacing:.35em;font-size:var(--step-0)}
.reviews .score{font-family:var(--font-display);font-size:clamp(3.4rem,7vw,6rem);line-height:1;margin-top:calc(var(--gap-unit)*1.5)}
.reviews .score-sub{margin-top:calc(var(--gap-unit)*1.5);opacity:.72;font-size:calc(var(--step-0)*.95)}
.revlink{display:inline-flex;align-items:center;min-height:48px;margin-top:calc(var(--gap-unit)*2);color:inherit;font-weight:600;font-size:calc(var(--step-0)*.92);text-decoration:none;border-bottom:1px solid currentColor}

/* visit */
.visit{display:grid;gap:calc(var(--gap-unit)*3)}
.visit .addr{margin-top:calc(var(--gap-unit)*2);font-size:var(--step-1);max-width:24ch}
.visit .tel{display:inline-flex;align-items:center;min-height:48px;margin-top:calc(var(--gap-unit)*1.5);color:var(--accent);font-weight:600;font-size:var(--step-1);text-decoration:none}
.maplink{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 calc(var(--gap-unit)*3);border:1px solid var(--line);border-radius:var(--radius);text-decoration:none;font-weight:600;font-size:calc(var(--step-0)*.94);align-self:start}

footer{background:var(--ink);color:var(--bg);padding:calc(var(--gap-unit)*7) calc(var(--gap-unit)*3) calc(var(--gap-unit)*14)}
.fgrid{display:grid;gap:calc(var(--gap-unit)*4)}
footer h4{font-size:var(--step-1);margin-bottom:calc(var(--gap-unit))}
footer p,footer a{opacity:.78;font-size:calc(var(--step-0)*.94);text-decoration:none;line-height:1.7}
.fbot{margin-top:calc(var(--gap-unit)*6);padding-top:calc(var(--gap-unit)*3);border-top:1px solid rgba(255,255,255,.16);font-size:calc(var(--step-0)*.8);opacity:.55}

.brandbar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 14px;background:var(--ink);color:var(--bg);font-size:.82rem}
.brandbar a{background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;padding:7px 14px;border-radius:calc(var(--radius)*.6);font-size:.78rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

@media(min-width:900px){
  section{padding:calc(var(--gap-unit)*10) calc(var(--gap-unit)*6)}
  .hero{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--gap-unit)*9);align-items:center;min-height:min(88vh,900px)}
  .hero-visual{height:min(78vh,780px)}
  .hero.type-led{display:block;max-width:1180px;margin:0 auto}
  .hero.split{max-width:1320px;margin:0 auto}
  .hero.split .hero-visual{order:-1}
  .about.has-visual{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--gap-unit)*8);align-items:center;max-width:1320px;margin:0 auto}
  .about-visual{margin-top:0}
  .services,.hours,.visit,.reviews{max-width:1320px;margin:0 auto}
  .svc-grid{grid-template-columns:repeat(3,1fr);gap:calc(var(--gap-unit)*6)}
  .hours{display:grid;grid-template-columns:1fr 1px 1fr;gap:calc(var(--gap-unit)*8);align-items:start;max-width:none}
  .hours::before{content:'';grid-column:2;width:1px;height:100%;background:var(--line)}
  .hours-list{margin-top:0;grid-column:3}
  .hours-copy{grid-column:1}
  .visit{grid-template-columns:1fr auto;align-items:end}
  .fgrid{grid-template-columns:1fr 1fr;max-width:1320px;margin:0 auto}
  .fbot{max-width:1320px;margin-left:auto;margin-right:auto}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}`;
}

export function composePage(p: ComposeParams): string {
  const ad = artDirection(p.artDirectionId);
  const lang: Lang = p.lead.country === 'RS' ? 'sr' : 'en';
  const s = STRINGS[lang];
  const { lead, copy } = p;
  const phoneHref = lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, '')}` : '#visit';
  const ab = splitAbout(copy.about);

  const blocks: string[] = [
    hero(
      {
        name: lead.name,
        headline: copy.headline,
        subheadline: copy.subheadline,
        city: lead.region,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        ctaHref: lead.openingHours?.length ? '#hours' : phoneHref,
        ctaLabel: copy.ctaLabel,
        image: p.heroImage,
        altText: `${lead.name}, ${lead.category}, ${lead.region}`,
      },
      ad,
      s,
    ),
  ];

  if (copy.services.length >= 3) blocks.push(services(copy.services.slice(0, 6), ad, s));

  if (ab.lead || copy.about) {
    blocks.push(
      about(
        {
          eyebrow: s.about,
          lead: ab.lead || copy.subheadline,
          body: ab.body,
          image: p.aboutImage,
          altText: `${lead.name} — ${lead.category}`,
        },
        ad,
        s,
      ),
    );
  }

  // Requires real hours. No hours means no section, per §4.
  if (lead.openingHours?.length) blocks.push(hours(lead.openingHours, phoneHref, ad, s));

  if (lead.rating != null) {
    blocks.push(reviews(lead.rating, lead.reviewCount, lead.placeId, ad, s));
  }

  blocks.push(visit(lead.name, lead.address, lead.phone, ad, s));
  blocks.push(footer(lead.name, lead.address, lead.phone, new Date().getFullYear(), ad, s));

  return `<!doctype html>
<html lang="${lang === 'sr' ? 'sr-Latn' : 'en'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(lead.name)} — ${esc(copy.headline)}</title>
<meta name="description" content="${esc(copy.metaDescription)}"/>
<meta name="robots" content="noindex"/>
<meta name="theme-color" content="${ad.bg}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(lead.name)} — ${esc(copy.headline)}"/>
<meta property="og:description" content="${esc(copy.metaDescription)}"/>
<meta property="og:image" content="${p.baseUrl}/p/${p.slug}-og.png"/>
<meta property="og:url" content="${p.baseUrl}/p/${p.slug}"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="${fontHref(ad)}"/>
<style>${pageCss(ad)}</style>
</head>
<body>
${blocks.join('\n')}
<div class="brandbar"><span>${esc(s.concept)}</span><a href="${esc(p.calLink)}">Book a call</a></div>
</body>
</html>`;
}
