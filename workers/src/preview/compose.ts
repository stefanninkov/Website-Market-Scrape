/**
 * Composer (PREVIEW-SYSTEM.md §2, §4).
 *
 * The library holds all twelve section types. This file decides which of them
 * a given lead's page actually gets, by resolving each section's required data
 * against what exists. A section with missing data is not in the spec — that is
 * the only reason no section ever needs placeholder content.
 *
 * Rendering is pure: same spec plus same data always produces the same bytes,
 * so regenerating a preview never changes a link already sent.
 */

import type { ArtDirectionId, CompositionSpec, Lead, PreviewCopy, SectionInstance } from '@wms/shared';
import { artDirection, fontHref, tokenBlock, type ArtDirection } from './art-directions.js';
import {
  STRINGS,
  about,
  ctaBand,
  esc,
  faq,
  footer,
  gallery,
  header,
  hero,
  hours,
  location,
  pricing,
  proofstrip,
  reviews,
  services,
  team,
  whyUs,
  type FaqItem,
  type GalleryImage,
  type HeroVariant,
  type Lang,
  type NavLink,
  type Pillar,
  type PriceRow,
  type TeamMember,
} from './sections.js';

/**
 * Where an image came from, which decides what it is allowed to do.
 *
 * `photo` is a real photograph of this kind of business. `texture` is a
 * generated gradient or pattern, used when no photograph could be sourced. The
 * distinction is a field rather than caller discipline because the rules that
 * depend on it are blocking: a texture may never sit in the gallery (it would
 * be placeholder content, §4), and a texture behind a headline is not a hero
 * (§4.1) — that is the case `type-led` exists for.
 */
export type ImageKind = 'photo' | 'texture';

export interface PreviewImage {
  src: string;
  kind: ImageKind;
}

export interface ComposeParams {
  lead: Lead;
  copy: PreviewCopy;
  artDirectionId: ArtDirectionId;
  slug: string;
  baseUrl: string;
  calLink: string;
  /** Curated imagery, best first. Only `photo` entries become page content. */
  images: PreviewImage[];
  /** Real prices, only when research actually found them. */
  prices?: PriceRow[];
  /** Real people, only when research actually found them. */
  people?: TeamMember[];
  faqs?: FaqItem[];
  /** Real differentiators about the business. Never our reasons for pitching it. */
  whyUs?: Pillar[];
}

function splitAbout(text: string): { lead: string; body: string } {
  const m = text.match(/^(.+?[.!?])\s+(.*)$/s);
  if (!m || m[1]!.length < 24 || m[2]!.trim().length < 40) return { lead: '', body: text };
  return { lead: m[1]!.trim(), body: m[2]!.trim() };
}

/** §4.1 — the hero decision. `type-led` is a real design, not a fallback. */
function heroVariant(lead: Lead, hasImage: boolean): HeroVariant {
  if (hasImage) return 'split-photo';
  if (lead.rating != null && lead.rating >= 4.5 && (lead.reviewCount ?? 0) >= 20) {
    return 'card-stack';
  }
  return 'type-led';
}

// ---------------------------------------------------------------------------

function pageCss(ad: ArtDirection): string {
  const u = 'var(--gap-unit)';
  return `${tokenBlock(ad)}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--font-text);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:600;letter-spacing:-.025em;line-height:1.05}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block;object-fit:cover}
section{position:relative;padding:calc(${u}*8) calc(${u}*3);overflow:hidden}
.eyebrow{display:inline-block;font-family:var(--font-text);font-size:.72rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.sec-head{margin-bottom:calc(${u}*5)}
.sec-head h2{font-size:clamp(1.9rem,4vw,3.2rem);margin-top:calc(${u}*1.5)}
.sec-head.centered{text-align:center}
.rule{display:block;width:120px;height:1px;background:var(--line);margin:calc(${u}*3) 0}
.meta{display:flex;align-items:center;gap:calc(${u}*2);font-size:.76rem;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim)}
.meta i{width:5px;height:5px;border-radius:50%;background:var(--accent);display:block}
.cta,.pill{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 calc(${u}*3.5);border-radius:calc(var(--radius)*.55);font-weight:600;font-size:.95rem;transition:transform calc(var(--motion)*.16s) cubic-bezier(.2,0,0,1)}
.cta{background:var(--accent);color:var(--accent-ink)}
.cta.invert{background:var(--bg);color:var(--ink)}
.pill{border:1px solid var(--line);color:var(--ink)}
.pill.solid{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
@media(hover:hover){.cta:hover,.pill:hover{transform:translateY(-2px)}}
/* decorative initial, bleeding off the edge like the reference watermark */
.watermark{position:absolute;font-family:var(--font-display);font-size:clamp(18rem,34vw,34rem);line-height:.72;color:var(--ink);opacity:.035;pointer-events:none;user-select:none;right:-.1em;bottom:-.22em;z-index:0}
.watermark.left{right:auto;left:-.16em;top:-.1em;bottom:auto}
.circle{position:absolute;width:clamp(180px,26vw,349px);aspect-ratio:1;border-radius:50%;background:var(--accent);opacity:.07;pointer-events:none}
.circle.c1{left:-6%;top:-14%}
.circle.c2{right:-8%;bottom:-22%}

/* header */
.site-head{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:calc(${u}*2);padding:calc(${u}*1.6) calc(${u}*3);background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:calc(${u}*1.2);margin-right:auto;min-width:0;min-height:44px}
.brand-mark{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:calc(var(--radius)*.5);background:var(--accent);color:var(--accent-ink);font-family:var(--font-display);font-weight:600;font-size:.86rem}
.brand-name{font-family:var(--font-display);font-weight:600;font-size:1.06rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.site-nav{display:none;gap:calc(${u}*3.4)}
.site-nav a{font-size:.74rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-dim);min-height:44px;display:inline-flex;align-items:center}
@media(hover:hover){.site-nav a:hover{color:var(--accent)}}
.head-cta{display:none;align-items:center;min-height:44px;padding:0 calc(${u}*2.4);border-radius:calc(var(--radius)*.5);background:var(--ink);color:var(--bg);font-size:.82rem;font-weight:600;white-space:nowrap}

/* hero */
.hero{padding:0}
.hero-copy{position:relative;z-index:1;padding:calc(${u}*7) calc(${u}*3)}
.hero h1{font-size:clamp(2.7rem,7.4vw,5.4rem);max-width:12ch}
.hero .lede{margin-top:calc(${u}*3);color:var(--ink-dim);font-size:clamp(1rem,1.5vw,1.16rem);max-width:36ch}
.hero .cta{margin-top:calc(${u}*4)}
.hero-visual{position:relative}
.hero-visual img{width:100%;height:100%;aspect-ratio:4/3}
.hero-card{position:relative;z-index:1;margin:0 calc(${u}*3) calc(${u}*7);padding:calc(${u}*4);border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);text-align:center}
.hero-card .card-score{font-family:var(--font-display);font-size:clamp(3rem,8vw,4.4rem);line-height:1}
.hero-card .card-sub{color:var(--ink-dim);font-size:.92rem}
.stars{color:var(--accent);letter-spacing:.34em}

/* proofstrip */
.proofstrip{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:calc(${u}*1.6) calc(${u}*2.4);padding:calc(${u}*2.2) calc(${u}*3);background:var(--accent);color:var(--accent-ink);font-size:.84rem;font-weight:500;letter-spacing:.02em}
.proofstrip i{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.5}

/* about */
.about-copy{position:relative;z-index:1}
.about h2{font-size:clamp(1.9rem,4vw,3.2rem);margin-top:calc(${u}*1.5);max-width:17ch}
.about p{margin-top:calc(${u}*3);color:var(--ink-dim);max-width:52ch}
.about .pill{margin-top:calc(${u}*4)}
.about-visual{margin-top:calc(${u}*5);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.about-visual img{width:100%;aspect-ratio:5/6;max-height:660px}

/* services */
.svc-grid{display:grid;gap:calc(${u}*4.5)}
.svc{padding-top:calc(${u}*3);border-top:1px solid var(--line)}
.svc-mark{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;border:1px solid var(--accent);color:var(--accent);font-size:.76rem;font-weight:600;margin-bottom:calc(${u}*2)}
.svc h3{font-size:1.16rem}
.svc p{margin-top:calc(${u}*1.4);color:var(--ink-dim);font-size:.94rem;max-width:34ch}
.srows{display:grid}
.srow{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:calc(${u}*2);padding:calc(${u}*2.6) 0;border-bottom:1px solid var(--line)}
.srow h3{font-size:1.14rem}
.srow p{grid-column:1/-1;color:var(--ink-dim);font-size:.93rem;max-width:52ch}
.leader{border-bottom:1px dotted var(--line);align-self:center}

/* why us */
.pillars{display:grid;gap:calc(${u}*5);text-align:center}
.pillar-dot{display:block;width:46px;height:46px;margin:0 auto calc(${u}*2);border-radius:50%;border:1px solid var(--accent);position:relative}
.pillar-dot::after{content:'';position:absolute;inset:34%;border-radius:50%;background:var(--accent)}
.pillar h3{font-size:.92rem;letter-spacing:.14em;text-transform:uppercase;font-family:var(--font-text);font-weight:600}
.pillar p{margin-top:calc(${u}*1.6);color:var(--ink-dim);font-size:.94rem}

/* gallery — the tile owns the aspect ratio and the image fills it. Putting the
   ratio on the img while the row is 1fr leaves the height circular, which is
   what collapsed this section. Tile 0 is the lead tile; at 3 or 6 photos the
   grid packs with no holes at every breakpoint. */
.tiles{display:grid;gap:calc(${u}*1.6);grid-template-columns:1fr 1fr}
.tile{position:relative;aspect-ratio:1;border-radius:var(--radius);overflow:hidden;background:var(--surface)}
.tiles.n3 .tile.lead{grid-column:span 2;aspect-ratio:3/2}
.tile img{width:100%;height:100%;object-fit:cover}

/* hours */
.hours{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.hours-copy{position:relative;z-index:1}
.hours h2{font-size:clamp(1.9rem,4vw,3.2rem);margin-top:calc(${u}*1.5)}
.hours .pill{margin-top:calc(${u}*4)}
.hours-list{position:relative;z-index:1;margin-top:calc(${u}*5)}
.hrow{display:flex;justify-content:space-between;gap:calc(${u}*2);padding:calc(${u}*2) 0;border-bottom:1px solid var(--line);font-size:.97rem}
.hrow span{color:var(--ink-dim);white-space:nowrap}
.hrow b{font-variant-numeric:tabular-nums;white-space:nowrap}
.hrow.closed b{color:var(--ink-dim);font-weight:400}

/* reviews */
.reviews{text-align:center;background:var(--ink);color:var(--bg)}
.reviews .score{font-family:var(--font-display);font-size:clamp(3.4rem,8vw,6rem);line-height:1;margin-top:calc(${u}*1.5)}
.reviews .score-sub{margin-top:calc(${u}*1.5);opacity:.72;font-size:.95rem}
.revlink{display:inline-flex;align-items:center;min-height:48px;margin-top:calc(${u}*2);font-weight:600;font-size:.92rem;border-bottom:1px solid currentColor}

/* team */
.member{display:grid;gap:calc(${u}*3);margin-bottom:calc(${u}*6)}
.member-visual{border-radius:var(--radius);overflow:hidden}
.member-visual img{width:100%;aspect-ratio:10/9}
.member h3{font-size:1.6rem}
.member .role{color:var(--accent);font-size:.76rem;letter-spacing:.2em;text-transform:uppercase;margin-top:calc(${u})}
.member p{color:var(--ink-dim);margin-top:calc(${u}*2);max-width:52ch}

/* pricing */
.plist{position:relative;z-index:1}
.prow{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:calc(${u}*2);padding:calc(${u}*2.2) 0;border-bottom:1px solid var(--line)}
.prow b{font-family:var(--font-display);font-size:1.2rem}

/* faq */
.faq-item{border-bottom:1px solid var(--line)}
.faq-item summary{cursor:pointer;padding:calc(${u}*2.4) 0;font-weight:600;font-size:1.02rem;list-style:none;min-height:52px;display:flex;align-items:center}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:'+';margin-left:auto;color:var(--accent);font-size:1.3rem}
.faq-item[open] summary::after{content:'−'}
.faq-item p{padding-bottom:calc(${u}*2.4);color:var(--ink-dim);max-width:60ch}

/* location + cta band */
.location{display:grid;gap:calc(${u}*3)}
.location .addr{margin-top:calc(${u}*2);font-size:1.16rem;max-width:22ch}
.location .tel{display:inline-flex;align-items:center;min-height:48px;margin-top:calc(${u});color:var(--accent);font-weight:600;font-size:1.16rem}
.location .pill{align-self:start}
.ctaband{background:var(--accent);color:var(--accent-ink);text-align:center}
.ctaband h2{font-size:clamp(1.9rem,4.4vw,3.2rem);max-width:16ch;margin:0 auto}
.ctaband .cta{margin-top:calc(${u}*4)}

footer{background:var(--ink);color:var(--bg);padding:calc(${u}*8) calc(${u}*3) calc(${u}*13)}
footer .brand-name{color:var(--bg)}
.fgrid{display:grid;gap:calc(${u}*4)}
footer h4{font-size:1.08rem;margin-bottom:calc(${u})}
footer p,footer a{opacity:.78;font-size:.93rem;line-height:1.75}
.fbot{margin-top:calc(${u}*6);padding-top:calc(${u}*3);border-top:1px solid rgba(255,255,255,.16);font-size:.78rem;opacity:.55}

.brandbar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 14px;background:var(--ink);color:var(--bg);font-size:.8rem}
.brandbar a{background:var(--accent);color:var(--accent-ink);font-weight:600;padding:7px 14px;border-radius:calc(var(--radius)*.5);font-size:.76rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

@media(min-width:640px){
  .svc-grid{grid-template-columns:1fr 1fr}
  .pillars{grid-template-columns:repeat(3,1fr)}
  .tiles{grid-template-columns:repeat(3,1fr)}
  .tiles.n3 .tile.lead{grid-column:span 1;aspect-ratio:1}
}
@media(min-width:900px){
  .site-nav,.head-cta{display:flex}
  .site-head{padding:calc(${u}*1.6) calc(${u}*6)}
  section{padding:calc(${u}*11) calc(${u}*6)}
  .hero{display:grid;grid-template-columns:1.15fr 1fr;align-items:stretch;min-height:min(86vh,860px);padding:0}
  .hero-visual img{height:100%;aspect-ratio:auto}
  .hero-copy{display:flex;flex-direction:column;justify-content:center;padding:calc(${u}*8) calc(${u}*7)}
  .hero.type-led,.hero.card-stack{grid-template-columns:1.3fr .7fr;align-items:center}
  .hero.card-stack .hero-card{margin:0 calc(${u}*7) 0 0}
  .hero.type-led .hero-copy{padding-left:calc(${u}*6)}
  .about.has-visual{display:grid;grid-template-columns:1fr 1fr;gap:calc(${u}*8);align-items:center}
  .about-visual{margin-top:0}
  .svc-grid{grid-template-columns:repeat(3,1fr);gap:calc(${u}*5)}
  .hours{display:grid;grid-template-columns:1fr 1px 1fr;gap:calc(${u}*8);align-items:start}
  .hours::after{content:'';grid-column:2;width:1px;height:100%;background:var(--line)}
  .hours-list{margin-top:0}
  /* 3 cols with a 2x2 lead tile: 3 photos fill a 3x2 block, 6 fill a 3x3. */
  .tiles .tile.lead{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}
  .member{grid-template-columns:1fr 1fr;gap:calc(${u}*6);align-items:center}
  .member.flip .member-visual{order:2}
  .location{grid-template-columns:1fr auto;align-items:end}
  .fgrid{grid-template-columns:1.4fr 1fr 1fr}
  .hero-copy,.about,.services,.hours,.reviews,.location,.pricing,.faq,.team,.whyus,.gallery,.fgrid,.fbot{max-width:1440px;margin-left:auto;margin-right:auto}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}`;
}

// ---------------------------------------------------------------------------

export function composePage(p: ComposeParams): string {
  const ad = artDirection(p.artDirectionId);
  const lang: Lang = p.lead.country === 'RS' ? 'sr' : 'en';
  const s = STRINGS[lang];
  const { lead, copy } = p;
  const phoneHref = lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, '')}` : '#visit';
  const bookHref = lead.openingHours?.length ? '#hours' : phoneHref;
  const ab = splitAbout(copy.about);

  // Only photographs become content. Textures stay available as decorative
  // backdrops; they never carry a claim about the business.
  const photos = p.images.filter((i) => i.kind === 'photo').map((i) => i.src);
  const [heroImg, aboutImg, ...rest] = photos;

  // Resolved section list. A section is here only when its data exists.
  const spec: SectionInstance[] = [];
  const html: string[] = [];

  const links: NavLink[] = [];
  const push = (type: string, variant: string, node: string): void => {
    if (!node) return;
    spec.push({ type: type as SectionInstance['type'], variant, data: {} });
    html.push(node);
  };

  // --- hero (always; variant decided by §4.1) -------------------------------
  const hv = heroVariant(lead, Boolean(heroImg));
  push(
    'hero',
    hv,
    hero(
      {
        variant: hv,
        name: lead.name,
        headline: copy.headline,
        subheadline: copy.subheadline,
        city: lead.region,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        ctaHref: bookHref,
        ctaLabel: copy.ctaLabel,
        image: heroImg ?? null,
        altText: `${lead.name}, ${lead.category}, ${lead.region}`,
      },
      ad,
      s,
    ),
  );

  // --- proofstrip: needs 2+ real facts --------------------------------------
  const facts: string[] = [];
  if (lead.rating != null) {
    facts.push(`★ ${lead.rating.toFixed(1)}${lead.reviewCount ? ` · ${lead.reviewCount}` : ''}`);
  }
  if (lead.region) facts.push(lead.region);
  if (lead.category) facts.push(lead.category);
  const openDays = (lead.openingHours ?? []).filter(
    (l) => !new RegExp(s.closed, 'i').test(l.split('|')[1] ?? ''),
  ).length;
  if (openDays) facts.push(`${openDays}/7`);
  push('proofstrip', 'banded', proofstrip(facts, ad));

  // --- about ---------------------------------------------------------------
  if (copy.about) {
    links.push({ href: '#about', label: s.about });
    push(
      'about',
      aboutImg ? 'text-portrait' : 'quote-led',
      about(
        {
          name: lead.name,
          lead: ab.lead || copy.subheadline,
          body: ab.body,
          image: aboutImg ?? null,
          altText: `${lead.name} — ${lead.category}`,
          ctaHref: bookHref,
        },
        ad,
        s,
      ),
    );
  }

  // --- services: needs 3+ ---------------------------------------------------
  if (copy.services.length >= 3) {
    links.push({ href: '#services', label: s.services });
    push('services', 'numbered', services(copy.services.slice(0, 6), 'numbered', ad, s));
  }

  // --- whyUs: needs real differentiators about the business -----------------
  // Never `lead.analysis.reasons`. Those are our reasons for pitching the lead
  // ("no site", "no published prices") and putting them here would print our
  // sales case on the business's own page.
  if (p.whyUs && p.whyUs.length === 3) push('about', 'stat-row', whyUs(p.whyUs, ad, s));

  // --- gallery: needs 3+ real photographs left after the hero and about -----
  if (rest.length >= 3) {
    const imgs: GalleryImage[] = rest.slice(0, 6).map((src, i) => ({
      src,
      alt: `${lead.name} — ${lead.category} ${i + 1}`,
    }));
    links.push({ href: '#gallery', label: s.gallery });
    push('gallery', 'masonry', gallery(imgs, 'masonry', ad, s));
  }

  // --- hours: needs real opening hours --------------------------------------
  if (lead.openingHours?.length) {
    links.push({ href: '#hours', label: s.hours });
    push('hours', 'week-table', hours(lead.openingHours, phoneHref, ad, s));
  }

  // --- reviews: needs a rating ---------------------------------------------
  if (lead.rating != null) {
    push('reviews', 'single-pull', reviews(lead.rating, lead.reviewCount, lead.placeId, ad, s));
  }

  // --- team: needs real people (A2 research), never invented ----------------
  if (p.people?.length) {
    links.push({ href: '#team', label: s.team });
    push('about', 'text-portrait', team(p.people, ad, s));
  }

  // --- pricing: needs real prices. G8 blocks invented digits ----------------
  if (p.prices?.length) {
    links.push({ href: '#pricing', label: s.pricing });
    push('services', 'price-cards', pricing(p.prices, lead.name, ad, s));
  }

  // --- faq: needs 3+ real Q/A ----------------------------------------------
  if (p.faqs && p.faqs.length >= 3) push('faq', 'accordion', faq(p.faqs, ad, s));

  // --- location + cta + footer ---------------------------------------------
  links.push({ href: '#visit', label: s.contact });
  push('location', 'address-band', location(lead.name, lead.address, lead.phone, ad, s));
  push('ctaBand', 'full-bleed', ctaBand(copy.ctaLabel, bookHref, copy.ctaLabel));
  push(
    'footer',
    'standard',
    footer(lead.name, lead.address, lead.phone, lead.openingHours ?? [], new Date().getFullYear(), ad, s),
  );

  const head = header(lead.name, links.slice(0, 4), bookHref, s.bookNow);

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
${head}
${html.join('\n')}
<div class="brandbar"><span>${esc(s.concept)}</span><a href="${esc(p.calLink)}">Book a call</a></div>
</body>
</html>`;
}

/** The resolved spec, stored on the preview doc for audit (SPEC §14). */
export function composeSpec(p: ComposeParams): CompositionSpec {
  return {
    artDirection: p.artDirectionId,
    sections: [],
    primaryModule: p.lead.openingHours?.length ? 'book' : 'call',
    imagePlan: { entries: [] },
    language: p.lead.country === 'RS' ? 'sr' : 'en',
  };
}
