/**
 * Layer B — the full section library (PREVIEW-SYSTEM.md §4).
 *
 * All twelve section types live here. Each is a pure
 * `(data, tokens, lang) => string`. Availability is NOT decided here — the
 * composer omits any section whose required data is missing, which is why none
 * of these functions ever needs placeholder content.
 *
 * Layout follows the reference design: full-bleed image left / copy panel
 * right hero with the logo and nav overlaid, a decorative initial watermark,
 * circle motifs, thin rules, pill buttons, and a dot-separated meta line.
 */

import type { ArtDirection } from './art-directions.js';

export type Lang = 'sr' | 'en';

export interface Strings {
  book: string;
  bookNow: string;
  services: string;
  about: string;
  aboutLead: string;
  hours: string;
  welcome: string;
  visit: string;
  contact: string;
  call: string;
  closed: string;
  reviewsOn: string;
  basedOn: string;
  readReviews: string;
  directions: string;
  viewMore: string;
  team: string;
  pricing: string;
  gallery: string;
  faq: string;
  followUs: string;
  whyUs: string;
  concept: string;
  disclaimer: string;
}

export const STRINGS: Record<Lang, Strings> = {
  sr: {
    book: 'Zakažite termin',
    bookNow: 'Zakažite',
    services: 'Usluge',
    about: 'O nama',
    aboutLead: 'O salonu',
    hours: 'Radno vreme',
    welcome: 'Dobrodošli',
    visit: 'Posetite nas',
    contact: 'Kontakt',
    call: 'Pozovite',
    closed: 'Zatvoreno',
    reviewsOn: 'recenzija na Google-u',
    basedOn: 'na osnovu',
    readReviews: 'Pročitajte recenzije na Google-u',
    directions: 'Uputstvo do nas',
    viewMore: 'Saznajte više',
    team: 'Naš tim',
    pricing: 'Cenovnik',
    gallery: 'Galerija',
    faq: 'Česta pitanja',
    followUs: 'Zapratite nas',
    whyUs: 'Zašto baš mi',
    concept: 'Concept by FlowDev',
    disclaimer:
      'Ovo je konceptni prikaz sajta, ne zvanična prezentacija ovog biznisa. Izradio FlowDev kao predlog.',
  },
  en: {
    book: 'Book an appointment',
    bookNow: 'Book now',
    services: 'Services',
    about: 'About',
    aboutLead: 'About us',
    hours: 'Opening hours',
    welcome: 'Welcome',
    visit: 'Visit us',
    contact: 'Contact',
    call: 'Call',
    closed: 'Closed',
    reviewsOn: 'reviews on Google',
    basedOn: 'based on',
    readReviews: 'Read the reviews on Google',
    directions: 'Get directions',
    viewMore: 'View more',
    team: 'Our team',
    pricing: 'Pricing',
    gallery: 'Gallery',
    faq: 'Common questions',
    followUs: 'Follow us',
    whyUs: 'Why us',
    concept: 'Concept by FlowDev',
    disclaimer:
      'This is a concept mockup, not the official website of this business. Built by FlowDev as a proposal.',
  },
};

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Up to two initials, used for the mark and the decorative watermark. */
export function initials(name: string): string {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? (w[1]?.[0] ?? '') : '')).toUpperCase() || '·';
}

export interface NavLink {
  href: string;
  label: string;
}

// ---------------------------------------------------------------------------
// 0. Header — logo left, nav right, CTA. Sticky. (reference: hero overlay)
// ---------------------------------------------------------------------------

export function header(
  name: string,
  links: NavLink[],
  ctaHref: string,
  ctaLabel: string,
): string {
  const nav = links
    .map((l) => `<a href="${l.href}">${esc(l.label)}</a>`)
    .join('');
  return `<header class="site-head">
  <a class="brand" href="#top">
    <span class="brand-mark">${esc(initials(name))}</span>
    <span class="brand-name">${esc(name)}</span>
  </a>
  <nav class="site-nav">${nav}</nav>
  <a class="head-cta" href="${ctaHref}">${esc(ctaLabel)}</a>
</header>`;
}

// ---------------------------------------------------------------------------
// 1. hero — photo-full | split-photo | type-led | card-stack (§4.1)
// ---------------------------------------------------------------------------

export type HeroVariant = 'split-photo' | 'photo-full' | 'type-led' | 'card-stack';

export interface HeroData {
  variant: HeroVariant;
  name: string;
  headline: string;
  subheadline: string;
  city: string;
  rating: number | null;
  reviewCount: number | null;
  ctaHref: string;
  ctaLabel: string;
  image: string | null;
  altText: string;
}

export function hero(d: HeroData, _ad: ArtDirection, s: Strings): string {
  const meta = `<p class="meta"><span>${esc(d.city)}</span><i></i><span>${
    d.rating != null ? `★ ${d.rating.toFixed(1)}` : esc(s.welcome)
  }</span></p>`;

  const copy = `<div class="hero-copy">
    <h1>${esc(d.headline)}</h1>
    <p class="lede">${esc(d.subheadline)}</p>
    <span class="rule"></span>
    ${meta}
    <a class="cta" href="${d.ctaHref}">${esc(d.ctaLabel)}</a>
  </div>`;

  if (d.variant === 'card-stack' && d.rating != null) {
    return `<section class="hero card-stack" id="top">
  ${copy}
  <aside class="hero-card">
    <span class="stars">${'★'.repeat(Math.round(Math.min(d.rating, 5)))}</span>
    <p class="card-score">${d.rating.toFixed(1)}</p>
    <p class="card-sub">${d.reviewCount ?? 0} ${esc(s.reviewsOn)}</p>
  </aside>
</section>`;
  }

  if (d.variant === 'type-led' || !d.image) {
    return `<section class="hero type-led" id="top">
  <span class="watermark" aria-hidden="true">${esc(initials(d.name))}</span>
  ${copy}
</section>`;
  }

  const cls = d.variant === 'photo-full' ? 'photo-full' : 'split-photo';
  return `<section class="hero ${cls}" id="top">
  <div class="hero-visual"><img src="${d.image}" alt="${esc(d.altText)}" width="1200" height="1400"/></div>
  ${copy}
</section>`;
}

// ---------------------------------------------------------------------------
// 2. proofstrip — inline | banded
// ---------------------------------------------------------------------------

export function proofstrip(facts: string[], _ad: ArtDirection): string {
  if (facts.length < 2) return '';
  return `<div class="proofstrip">${facts
    .map((f) => `<span>${esc(f)}</span>`)
    .join('<i aria-hidden="true"></i>')}</div>`;
}

// ---------------------------------------------------------------------------
// 3. about — text-portrait (reference "Section 2": copy left, image right)
// ---------------------------------------------------------------------------

export interface AboutData {
  name: string;
  lead: string;
  body: string;
  image: string | null;
  altText: string;
  ctaHref: string;
}

export function about(d: AboutData, _ad: ArtDirection, s: Strings): string {
  const img = d.image
    ? `<div class="about-visual"><img src="${d.image}" alt="${esc(d.altText)}" width="1000" height="1160"/></div>`
    : '';
  return `<section class="about${d.image ? ' has-visual' : ''}" id="about">
  <span class="watermark left" aria-hidden="true">${esc(initials(d.name))}</span>
  <div class="about-copy">
    <span class="eyebrow">${esc(s.aboutLead)}</span>
    <h2>${esc(d.lead)}</h2>
    <p>${esc(d.body)}</p>
    <a class="pill" href="${d.ctaHref}">${esc(s.viewMore)}</a>
  </div>
  ${img}
</section>`;
}

// ---------------------------------------------------------------------------
// 4. services — numbered | icon-grid | price-cards | editorial-rows
// ---------------------------------------------------------------------------

export interface ServiceItem {
  title: string;
  blurb: string;
  price?: string;
}

export function services(
  items: ServiceItem[],
  variant: 'numbered' | 'editorial-rows',
  _ad: ArtDirection,
  s: Strings,
): string {
  if (variant === 'editorial-rows') {
    const rows = items
      .map(
        (it) => `<div class="srow"><h3>${esc(it.title)}</h3><span class="leader"></span><p>${esc(it.blurb)}</p></div>`,
      )
      .join('');
    return `<section class="services rows" id="services">
  <div class="sec-head"><span class="eyebrow">${esc(s.services)}</span><h2>${esc(s.services)}</h2></div>
  <div class="srows">${rows}</div>
</section>`;
  }
  const cols = items
    .map(
      (it, i) => `<article class="svc">
    <span class="svc-mark">${String(i + 1).padStart(2, '0')}</span>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.blurb)}</p>
  </article>`,
    )
    .join('');
  return `<section class="services" id="services">
  <div class="sec-head"><span class="eyebrow">${esc(s.services)}</span><h2>${esc(s.services)}</h2></div>
  <div class="svc-grid">${cols}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 5. whyUs — the 3-column block from the reference (icon, title, body)
// ---------------------------------------------------------------------------

export interface Pillar {
  title: string;
  body: string;
}

export function whyUs(items: Pillar[], _ad: ArtDirection, s: Strings): string {
  const cols = items
    .map(
      (it) => `<article class="pillar">
    <span class="pillar-dot" aria-hidden="true"></span>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.body)}</p>
  </article>`,
    )
    .join('');
  return `<section class="whyus">
  <div class="sec-head centered"><span class="eyebrow">${esc(s.whyUs)}</span></div>
  <div class="pillars">${cols}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 6. gallery — masonry | strip | duo
// ---------------------------------------------------------------------------

export interface GalleryImage {
  src: string;
  alt: string;
}

export function gallery(
  images: GalleryImage[],
  variant: 'strip' | 'masonry',
  _ad: ArtDirection,
  s: Strings,
): string {
  // 3 or 6 are the counts that pack the grid with no holes at any breakpoint,
  // so anything in between is trimmed down rather than left as a ragged row.
  const count = images.length >= 6 ? 6 : images.length >= 3 ? 3 : 0;
  if (count === 0) return '';
  const tiles = images
    .slice(0, count)
    .map(
      (im, i) =>
        `<figure class="tile${i === 0 ? ' lead' : ''}"><img src="${im.src}" alt="${esc(im.alt)}" width="900" height="900" loading="lazy"/></figure>`,
    )
    .join('');
  // The count travels to CSS: at two columns a 3-up wants a full-width lead
  // tile and a 6-up wants three even rows. Neither layout packs the other.
  return `<section class="gallery ${variant}" id="gallery">
  <div class="sec-head"><span class="eyebrow">${esc(s.gallery)}</span></div>
  <div class="tiles n${count}">${tiles}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 7. hours — week-table (reference: copy left, rule, hours right + circles)
// ---------------------------------------------------------------------------

export function hours(lines: string[], ctaHref: string, _ad: ArtDirection, s: Strings): string {
  const rows = lines
    .map((l) => {
      const [day = '', time = ''] = l.split('|');
      const isClosed = time.trim().toLowerCase() === s.closed.toLowerCase();
      return `<div class="hrow${isClosed ? ' closed' : ''}"><span>${esc(day)}</span><b>${esc(time)}</b></div>`;
    })
    .join('');
  return `<section class="hours" id="hours">
  <span class="circle c1" aria-hidden="true"></span>
  <span class="circle c2" aria-hidden="true"></span>
  <div class="hours-copy">
    <span class="eyebrow">${esc(s.welcome)}</span>
    <h2>${esc(s.hours)}</h2>
    <a class="pill solid" href="${ctaHref}">${esc(s.bookNow)}</a>
  </div>
  <div class="hours-list">${rows}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 8. reviews — aggregate only. Never quotes review text (Places terms).
// ---------------------------------------------------------------------------

export function reviews(
  rating: number,
  count: number | null,
  placeId: string,
  _ad: ArtDirection,
  s: Strings,
): string {
  return `<section class="reviews">
  <span class="stars">${'★'.repeat(Math.round(Math.min(rating, 5)))}</span>
  <p class="score">${rating.toFixed(1)}</p>
  <p class="score-sub">${esc(count ? `${s.basedOn} ${count} ${s.reviewsOn}` : s.reviewsOn)}</p>
  <a class="revlink" href="https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}" target="_blank" rel="noreferrer">${esc(s.readReviews)} ↗</a>
</section>`;
}

// ---------------------------------------------------------------------------
// 9. team — only when real people are known (AGENTS.md Research.ownerName)
// ---------------------------------------------------------------------------

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string | null;
}

export function team(members: TeamMember[], _ad: ArtDirection, s: Strings): string {
  const rows = members
    .map(
      (m, i) => `<article class="member${i % 2 ? ' flip' : ''}">
    ${m.image ? `<div class="member-visual"><img src="${m.image}" alt="${esc(m.name)}" width="1000" height="900" loading="lazy"/></div>` : ''}
    <div class="member-copy">
      <h3>${esc(m.name)}</h3>
      <p class="role">${esc(m.role)}</p>
      <p>${esc(m.bio)}</p>
    </div>
  </article>`,
    )
    .join('');
  return `<section class="team" id="team">
  <div class="sec-head"><span class="eyebrow">${esc(s.team)}</span></div>
  ${rows}
</section>`;
}

// ---------------------------------------------------------------------------
// 10. pricing — only with real prices. G8 blocks any digit not in source data.
// ---------------------------------------------------------------------------

export interface PriceRow {
  label: string;
  price: string;
}

export function pricing(rows: PriceRow[], name: string, _ad: ArtDirection, s: Strings): string {
  const list = rows
    .map(
      (r) => `<div class="prow"><span>${esc(r.label)}</span><i class="leader"></i><b>${esc(r.price)}</b></div>`,
    )
    .join('');
  return `<section class="pricing" id="pricing">
  <span class="watermark" aria-hidden="true">${esc(initials(name))}</span>
  <div class="sec-head"><span class="eyebrow">${esc(s.pricing)}</span><h2>${esc(s.pricing)}</h2></div>
  <div class="plist">${list}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 11. faq — accordion
// ---------------------------------------------------------------------------

export interface FaqItem {
  q: string;
  a: string;
}

export function faq(items: FaqItem[], _ad: ArtDirection, s: Strings): string {
  const list = items
    .map(
      (it) => `<details class="faq-item"><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`,
    )
    .join('');
  return `<section class="faq" id="faq">
  <div class="sec-head"><span class="eyebrow">${esc(s.faq)}</span><h2>${esc(s.faq)}</h2></div>
  <div class="faq-list">${list}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// 12. location + ctaBand + footer
// ---------------------------------------------------------------------------

export function location(
  name: string,
  address: string,
  phone: string | null,
  _ad: ArtDirection,
  s: Strings,
): string {
  const tel = phone
    ? `<a class="tel" href="tel:${phone.replace(/[^\d+]/g, '')}">${esc(phone)}</a>`
    : '';
  const q = encodeURIComponent(`${name} ${address}`);
  return `<section class="location" id="visit">
  <div>
    <span class="eyebrow">${esc(s.visit)}</span>
    <p class="addr">${esc(address)}</p>
    ${tel}
  </div>
  <a class="pill" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noreferrer">${esc(s.directions)} ↗</a>
</section>`;
}

export function ctaBand(title: string, ctaHref: string, ctaLabel: string): string {
  return `<section class="ctaband">
  <h2>${esc(title)}</h2>
  <a class="cta invert" href="${ctaHref}">${esc(ctaLabel)}</a>
</section>`;
}

export function footer(
  name: string,
  address: string,
  phone: string | null,
  hoursLines: string[],
  year: number,
  _ad: ArtDirection,
  s: Strings,
): string {
  const tel = phone ? `<a href="tel:${phone.replace(/[^\d+]/g, '')}">${esc(phone)}</a><br/>` : '';
  const hrs = hoursLines.length
    ? `<div><h4>${esc(s.hours)}</h4><p>${hoursLines
        .slice(0, 7)
        .map((l) => {
          const [d = '', t = ''] = l.split('|');
          return `${esc(d)} / ${esc(t)}`;
        })
        .join('<br/>')}</p></div>`
    : '';
  return `<footer>
  <div class="fgrid">
    <div>
      <a class="brand" href="#top"><span class="brand-mark">${esc(initials(name))}</span><span class="brand-name">${esc(name)}</span></a>
      <p>${esc(address)}</p>
    </div>
    <div><h4>${esc(s.contact)}</h4><p>${tel}${esc(address)}</p></div>
    ${hrs}
  </div>
  <p class="fbot">© ${year} ${esc(name)} · ${esc(s.disclaimer)}</p>
</footer>`;
}
