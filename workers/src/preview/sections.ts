/**
 * Layer B — section library (PREVIEW-SYSTEM.md §4).
 *
 * Each section is a pure `(data, tokens, lang) => string`. The rule that makes
 * the whole system work: **no section renders with placeholder content.** If
 * required data is missing the composer leaves the section out of the spec, so
 * these functions never have to invent anything.
 *
 * Layout language follows the reference design Stefan supplied (split hero,
 * thin rules, circle motifs, generous vertical rhythm), expressed through the
 * art-direction tokens rather than copied values.
 */

import type { ArtDirection } from './art-directions.js';

export type Lang = 'sr' | 'en';

export interface Strings {
  book: string;
  services: string;
  about: string;
  hours: string;
  visit: string;
  call: string;
  closed: string;
  reviewsOn: string;
  basedOn: string;
  readReviews: string;
  directions: string;
  since: string;
  disclaimer: string;
  concept: string;
}

export const STRINGS: Record<Lang, Strings> = {
  sr: {
    book: 'Zakažite termin',
    services: 'Usluge',
    about: 'O nama',
    hours: 'Radno vreme',
    visit: 'Kontakt',
    call: 'Pozovite',
    closed: 'Zatvoreno',
    reviewsOn: 'recenzija na Google-u',
    basedOn: 'na osnovu',
    readReviews: 'Pročitajte recenzije na Google-u',
    directions: 'Uputstvo do nas',
    since: 'od',
    concept: 'Concept by FlowDev',
    disclaimer:
      'Ovo je konceptni prikaz sajta, ne zvanična prezentacija ovog biznisa. Izradio FlowDev kao predlog.',
  },
  en: {
    book: 'Book an appointment',
    services: 'Services',
    about: 'About',
    hours: 'Opening hours',
    visit: 'Visit',
    call: 'Call',
    closed: 'Closed',
    reviewsOn: 'reviews on Google',
    basedOn: 'based on',
    readReviews: 'Read the reviews on Google',
    directions: 'Get directions',
    since: 'since',
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

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export interface HeroData {
  name: string;
  headline: string;
  subheadline: string;
  city: string;
  rating: number | null;
  reviewCount: number | null;
  ctaHref: string;
  ctaLabel: string;
  /** data: URI or absolute URL. Absent → the type-led variant. */
  image: string | null;
  altText: string;
}

/**
 * `split-photo` when there is a usable image, `type-led` otherwise (§4.1).
 * type-led is a real design — oversized fluid display type and negative space —
 * not a degraded fallback. There is no gradient-behind-a-headline path.
 */
export function hero(d: HeroData, ad: ArtDirection, s: Strings): string {
  const proof =
    d.rating != null
      ? `<p class="hero-proof"><b>★ ${d.rating.toFixed(1)}</b>${
          d.reviewCount ? ` · ${d.reviewCount} ${esc(s.reviewsOn)}` : ''
        }</p>`
      : '';
  const meta = `<p class="hero-meta"><span>${esc(d.city)}</span><i></i><span>★ ${
    d.rating != null ? d.rating.toFixed(1) : '—'
  }</span></p>`;

  if (d.image) {
    return `<section class="hero split" id="top">
  <div class="hero-visual"><img src="${d.image}" alt="${esc(d.altText)}" width="1200" height="1400" loading="eager"/></div>
  <div class="hero-copy">
    <h1>${esc(d.headline)}</h1>
    <p class="lede">${esc(d.subheadline)}</p>
    <span class="rule"></span>
    ${meta}
    <a class="cta" href="${d.ctaHref}">${esc(d.ctaLabel)}</a>
    ${proof}
  </div>
</section>`;
  }

  return `<section class="hero type-led" id="top">
  <div class="hero-copy">
    <span class="eyebrow">${esc(d.name)}</span>
    <h1>${esc(d.headline)}</h1>
    <p class="lede">${esc(d.subheadline)}</p>
    <span class="rule"></span>
    ${meta}
    <a class="cta" href="${d.ctaHref}">${esc(d.ctaLabel)}</a>
    ${proof}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// About — text left, image right (reference: "Section 2")
// ---------------------------------------------------------------------------

export interface AboutData {
  eyebrow: string;
  lead: string;
  body: string;
  image: string | null;
  altText: string;
}

export function about(d: AboutData, _ad: ArtDirection, _s: Strings): string {
  const img = d.image
    ? `<div class="about-visual"><img src="${d.image}" alt="${esc(d.altText)}" width="1000" height="1160" loading="lazy"/></div>`
    : '';
  return `<section class="about ${d.image ? 'has-visual' : ''}" id="about">
  <div class="about-copy">
    <span class="eyebrow">${esc(d.eyebrow)}</span>
    <h2>${esc(d.lead)}</h2>
    <p>${esc(d.body)}</p>
  </div>
  ${img}
</section>`;
}

// ---------------------------------------------------------------------------
// Services — 3 columns with a circle mark (reference: "coulmns_3")
// ---------------------------------------------------------------------------

export interface ServiceItem {
  title: string;
  blurb: string;
}

export function services(items: ServiceItem[], _ad: ArtDirection, s: Strings): string {
  const cols = items
    .map(
      (it, i) => `<article class="svc">
    <span class="svc-mark">${String(i + 1).padStart(2, '0')}</span>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.blurb)}</p>
  </article>`,
    )
    .join('\n');
  return `<section class="services" id="services">
  <div class="sec-head"><span class="eyebrow">${esc(s.services)}</span></div>
  <div class="svc-grid">${cols}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// Hours — headline + CTA left, vertical rule, real hours right
// ---------------------------------------------------------------------------

export function hours(
  lines: string[],
  ctaHref: string,
  _ad: ArtDirection,
  s: Strings,
): string {
  const rows = lines
    .map((l) => {
      const [day = '', time = ''] = l.split('|');
      const isClosed = new RegExp(`^${s.closed}$`, 'i').test(time.trim());
      return `<div class="hrow${isClosed ? ' closed' : ''}"><span>${esc(day)}</span><b>${esc(time)}</b></div>`;
    })
    .join('');
  return `<section class="hours" id="hours">
  <div class="hours-copy">
    <span class="eyebrow">${esc(s.hours)}</span>
    <h2>${esc(s.hours)}</h2>
    <a class="cta ghost" href="${ctaHref}">${esc(s.book)}</a>
  </div>
  <div class="hours-list">${rows}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// Reviews band — aggregate only, links out to Google (never quoted text)
// ---------------------------------------------------------------------------

export function reviews(
  rating: number,
  count: number | null,
  placeId: string,
  _ad: ArtDirection,
  s: Strings,
): string {
  const stars = '★'.repeat(Math.round(Math.min(rating, 5)));
  const sub = count ? `${s.basedOn} ${count} ${s.reviewsOn}` : s.reviewsOn;
  return `<section class="reviews">
  <span class="stars">${stars}</span>
  <p class="score">${rating.toFixed(1)}</p>
  <p class="score-sub">${esc(sub)}</p>
  <a class="revlink" href="https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}" target="_blank" rel="noreferrer">${esc(s.readReviews)} ↗</a>
</section>`;
}

// ---------------------------------------------------------------------------
// Visit — address + phone + directions
// ---------------------------------------------------------------------------

export function visit(
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
  return `<section class="visit" id="visit">
  <div>
    <span class="eyebrow">${esc(s.visit)}</span>
    <p class="addr">${esc(address)}</p>
    ${tel}
  </div>
  <a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noreferrer">${esc(s.directions)} ↗</a>
</section>`;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function footer(
  name: string,
  address: string,
  phone: string | null,
  year: number,
  _ad: ArtDirection,
  s: Strings,
): string {
  const tel = phone ? `<a href="tel:${phone.replace(/[^\d+]/g, '')}">${esc(phone)}</a><br/>` : '';
  return `<footer>
  <div class="fgrid">
    <div><h4>${esc(name)}</h4><p>${esc(address)}</p></div>
    <div><h4>${esc(s.visit)}</h4><p>${tel}${esc(address)}</p></div>
  </div>
  <p class="fbot">© ${year} ${esc(name)} · ${esc(s.disclaimer)}</p>
</footer>`;
}
