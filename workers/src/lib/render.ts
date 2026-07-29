/**
 * Preview rendering (SPEC §8, DESIGN.md): fills a template's {{slots}} with
 * escaped business data + AI copy. Pure string work — verifiable offline.
 * Never uses content from the lead's existing site (SPEC §11).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lead, PreviewCopy, TemplateId } from '@wms/shared';

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

const templateCache = new Map<TemplateId, string>();

export function loadTemplate(id: TemplateId): string {
  const cached = templateCache.get(id);
  if (cached) return cached;
  const html = readFileSync(join(TEMPLATES_DIR, `${id}.html`), 'utf8');
  templateCache.set(id, html);
  return html;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// bold-dark accent per niche (DESIGN.md: gym lime, auto red, trades amber).
export function boldAccentForNiche(niche: string): string {
  const n = niche.toLowerCase();
  if (n.includes('gym')) return '#C1FE00';
  if (n.includes('auto') || n.includes('car')) return '#FF4D2E';
  return '#FFB300';
}

// Gradient fallbacks used when no curated niche image exists (DESIGN.md).
const HERO_GRADIENTS: Record<TemplateId, string> = {
  'minimal-light': 'linear-gradient(135deg,#F2F5FB 0%,#E3E9F5 100%)',
  'bold-dark': 'linear-gradient(150deg,#1B1B1F 0%,#0A0A0B 60%),radial-gradient(circle at 20% 10%,rgba(255,255,255,.10),transparent 45%)',
  'warm-local': 'linear-gradient(140deg,#EAD9BF 0%,#D9B896 55%,#C4936A 100%)',
  'corporate-clean': 'linear-gradient(135deg,#EAF1F0 0%,#D6E6E2 100%)',
};

export function heroBackground(templateId: TemplateId, imageUrl: string | null): string {
  if (imageUrl) {
    // Dark templates get their own overlay via ::after; keep the raw image.
    return `url('${imageUrl}')`;
  }
  return HERO_GRADIENTS[templateId];
}

interface Strings {
  servicesLabel: string;
  aboutLabel: string;
  contactLabel: string;
  phoneLabel: string;
  addressLabel: string;
  reviewsWord: string;
  disclaimer: string;
  hoursLabel: string;
  navServices: string;
  navAbout: string;
  navVisit: string;
  callNow: string;
  /** Short word for the review count stat, e.g. "recenzija" / "reviews". */
  reviewsShort: string;
  ratingShort: string;
  daysOpen: string;
  servicesShort: string;
  directions: string;
  ctaBandTitle: string;
  ctaBandSub: string;
  scrollCue: string;
  localBadge: string;
  /** Section eyebrows — must never repeat the heading below them. */
  eyeServices: string;
  eyeAbout: string;
  eyeVisit: string;
}

// SPEC §3: Serbian (latinica) for RS leads, English otherwise. Branding bar
// stays English inside the templates themselves.
function stringsFor(country: string): Strings {
  if (country === 'RS') {
    return {
      servicesLabel: 'Usluge',
      aboutLabel: 'O nama',
      contactLabel: 'Kontakt',
      phoneLabel: 'Telefon',
      addressLabel: 'Adresa',
      reviewsWord: 'recenzija na Google-u',
      hoursLabel: 'Radno vreme',
      navServices: 'Usluge',
      navAbout: 'O nama',
      navVisit: 'Kontakt',
      callNow: 'Pozovite',
      reviewsShort: 'recenzija',
      ratingShort: 'ocena na Google-u',
      daysOpen: 'dana u nedelji',
      servicesShort: 'usluga',
      directions: 'Uputstvo do nas',
      ctaBandTitle: 'Rezervišite svoj termin',
      ctaBandSub: 'Pozovite nas — javljamo se u toku radnog vremena.',
      scrollCue: 'Skrolujte',
      localBadge: 'Lokalno',
      eyeServices: 'Šta radimo',
      eyeAbout: 'Ko smo',
      eyeVisit: 'Posetite nas',
      disclaimer:
        'Ovo je konceptni prikaz sajta, ne zvanična prezentacija ovog biznisa. Izradio FlowDev kao predlog.',
    };
  }
  return {
    servicesLabel: 'Services',
    aboutLabel: 'About',
    contactLabel: 'Contact',
    phoneLabel: 'Phone',
    addressLabel: 'Address',
    reviewsWord: 'reviews on Google',
    hoursLabel: 'Opening hours',
    navServices: 'Services',
    navAbout: 'About',
    navVisit: 'Visit',
    callNow: 'Call',
    reviewsShort: 'reviews',
    ratingShort: 'rating on Google',
    daysOpen: 'days a week',
    servicesShort: 'services',
    directions: 'Get directions',
    ctaBandTitle: 'Book your appointment',
    ctaBandSub: 'Give us a call — we answer during opening hours.',
    scrollCue: 'Scroll',
    localBadge: 'Local',
    eyeServices: 'What we do',
    eyeAbout: 'Who we are',
    eyeVisit: 'Come and see us',
    disclaimer:
      'This is a concept mockup, not the official website of this business. Built by FlowDev as a proposal.',
  };
}

/**
 * Line-art icon set for service cards. A generic bullet on every row reads as
 * filler; an icon that matches the service reads as a designed page. Keys are
 * matched against the AI-written service title in both Serbian and English, so
 * this stays useful across niches. Falls back to a neutral mark, never blank.
 */
const ICON_PATHS: Record<string, string> = {
  cut: '<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M20 4L8.3 15.7M14.4 14.4L20 20M8.3 8.3L11.6 11.6"/>',
  color:
    '<path d="M12 2.6C6.9 2.6 2.6 6.9 2.6 12S6.9 21.4 12 21.4c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6h1.9c2.8 0 5.1-2.3 5.1-5.1 0-4.5-4.2-8.4-9.4-8.4z"/><circle cx="7.2" cy="11.4" r="1.1"/><circle cx="9.4" cy="7.2" r="1.1"/><circle cx="14.6" cy="7.2" r="1.1"/><circle cx="17" cy="11" r="1.1"/>',
  dry: '<path d="M17.7 7.7a2.5 2.5 0 111.8 4.3H2.5M9.6 4.6A2 2 0 1111 8H2.5M12.6 19.4A2 2 0 1014 16H2.5"/>',
  care: '<path d="M12 3.2l1.9 5.1L19 10.2l-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9z"/><path d="M18.6 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  event: '<path d="M2.6 8.2l4.7 3.1L12 4l4.7 7.3 4.7-3.1-2.1 10.4H4.7z"/><circle cx="12" cy="16.2" r="1"/>',
  clean: '<path d="M12 2.8s6 5.4 6 9.3a6 6 0 11-12 0c0-3.9 6-9.3 6-9.3z"/><path d="M9.2 13.6a2.8 2.8 0 002.8 2.8"/>',
  repair:
    '<path d="M15.2 3.4a5 5 0 00-4.9 6.1L3.6 16.2a2 2 0 102.8 2.8l6.7-6.7a5 5 0 006.1-6.1l-2.9 2.9-2.9-.6-.6-2.9z"/>',
  tooth:
    '<path d="M12 6.1C10.4 4.7 7.6 3.6 6 5c-1.9 1.6-2.2 4.4-1.6 7.4.5 2.6 1 4.8 1.5 6.2.4 1.2 2.1 1.2 2.5-.1.4-1.3.6-3.3 1.1-4.4.4-.9 1.6-.9 2 0 .5 1.1.7 3.1 1.1 4.4.4 1.3 2.1 1.3 2.5.1.5-1.4 1-3.6 1.5-6.2.6-3 .3-5.8-1.6-7.4-1.6-1.4-4.4-.3-6 1.1z"/>',
  food: '<path d="M4.5 3v6.5a2.8 2.8 0 002.8 2.8V21M7.3 3v6.2M10.1 3v6.2M17.4 3c-1.4 0-2.4 2.1-2.4 5.2 0 2 .8 3.4 1.9 3.6V21"/>',
  consult:
    '<path d="M21 14.6a2 2 0 01-2 2H8.2L3.4 20.4V5.4a2 2 0 012-2h13.6a2 2 0 012 2z"/><path d="M8 9.4h8M8 12.6h5"/>',
  fitness:
    '<path d="M4 9v6M7 6.6v10.8M17 6.6v10.8M20 9v6M7 12h10"/>',
  car: '<path d="M4.6 16.4v2.2a1 1 0 01-1 1H2.8a1 1 0 01-1-1v-2.2M22.2 16.4v2.2a1 1 0 01-1 1h-.8a1 1 0 01-1-1v-2.2"/><path d="M1.8 16.4v-4l2.1-5.1a2 2 0 011.9-1.3h12.4a2 2 0 011.9 1.3l2.1 5.1v4z"/><circle cx="6.4" cy="13.4" r="1.1"/><circle cx="17.6" cy="13.4" r="1.1"/>',
  default: '<path d="M12 3.2l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 17.4 6.2 20.8l1.6-6.5-5.1-4.4 6.7-.5z"/>',
};

/** Serbian + English keyword → icon key. First match wins, order matters. */
const ICON_KEYWORDS: [string[], keyof typeof ICON_PATHS][] = [
  [['šiša', 'sisa', 'cut', 'trim', 'barber', 'brij', 'shave', 'makaz'], 'cut'],
  [['boj', 'farb', 'color', 'colour', 'pramen', 'highlight', 'dye', 'balaya'], 'color'],
  [['fenir', 'stiliz', 'styl', 'blow', 'dry', 'brush', 'frizur', 'updo'], 'dry'],
  [['tretman', 'treat', 'nega', 'care', 'mask', 'hidrat', 'keratin', 'spa', 'massa', 'masaž'], 'care'],
  [['venč', 'venc', 'wedding', 'bridal', 'svečan', 'svecan', 'event', 'occasion', 'party'], 'event'],
  [['čišć', 'cisc', 'clean', 'pran', 'wash', 'higij', 'hygien'], 'clean'],
  [['poprav', 'repair', 'servis', 'service', 'monta', 'install', 'fix', 'ugrad'], 'repair'],
  [['zub', 'tooth', 'dental', 'implant', 'orto', 'protet'], 'tooth'],
  [['hran', 'food', 'menu', 'jelo', 'pizz', 'kuhin', 'dish', 'catering', 'kafa', 'coffee'], 'food'],
  [['konsult', 'consult', 'savet', 'advice', 'plan', 'analiz', 'audit'], 'consult'],
  [['tren', 'train', 'fitnes', 'fitness', 'gym', 'vežb', 'workout'], 'fitness'],
  [['auto', 'car', 'vozil', 'vehicle', 'gum', 'tyre', 'tire'], 'car'],
];

function iconFor(title: string): string {
  const t = title.toLowerCase();
  for (const [words, key] of ICON_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return ICON_PATHS[key] ?? ICON_PATHS.default!;
  }
  return ICON_PATHS.default!;
}

function svgIcon(title: string): string {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconFor(title)}</svg>`;
}

/** Up to two initials for the hero lettermark. */
function monogramFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '·';
  const first = words[0]![0] ?? '';
  const second = words.length > 1 ? (words[1]![0] ?? '') : '';
  return (first + second).toUpperCase();
}

/**
 * Accent ticker between the hero and the services grid. Real service names
 * only — this is a density and rhythm device, not invented content.
 */
function renderMarquee(lead: Lead, copy: PreviewCopy, strings: Strings): string {
  const items = copy.services.map((s) => s.title);
  if (lead.region) items.push(lead.region);
  if (lead.rating != null) items.push(`★ ${lead.rating.toFixed(1)}`);
  if (items.length === 0) return '';
  const seq = items.map((t) => `<span>${escapeHtml(t)}</span>`).join('<i aria-hidden="true">✦</i>');
  // Each row translates -100% of its own width, so the loop is only seamless
  // while the remaining rows still cover the viewport. Four copies keeps the
  // strip filled on wide screens even when the service names are short.
  const row = `<div class="tick-row">${seq}</div>`;
  return row.repeat(4);
}

/**
 * Splits the About copy into a lead sentence and the remainder. The lead is set
 * as a pull quote — using the hero subheadline there instead would print the
 * same sentence twice on one page, which is the fastest tell of a generated
 * site.
 */
function splitAbout(about: string): { lead: string; body: string } {
  const m = about.match(/^(.+?[.!?])\s+(.*)$/s);
  if (!m || m[1]!.length < 24 || m[2]!.trim().length < 40) return { lead: '', body: about };
  return { lead: m[1]!.trim(), body: m[2]!.trim() };
}

/** Stat row built only from real Places data — no invented numbers. */
function renderStats(lead: Lead, copy: PreviewCopy, strings: Strings): string {
  const cells: string[] = [];
  if (lead.rating != null) {
    cells.push(`<div><b>${lead.rating.toFixed(1)}</b><span>${strings.ratingShort}</span></div>`);
  }
  if (lead.reviewCount) {
    cells.push(`<div><b>${lead.reviewCount}</b><span>${strings.reviewsShort}</span></div>`);
  }
  const open = (lead.openingHours ?? []).filter((l) => {
    const hours = l.split('|')[1] ?? '';
    return hours !== '' && !/zatvoreno|closed/i.test(hours);
  }).length;
  if (open > 0) cells.push(`<div><b>${open}</b><span>${strings.daysOpen}</span></div>`);
  if (copy.services.length > 0) {
    cells.push(`<div><b>${copy.services.length}</b><span>${strings.servicesShort}</span></div>`);
  }
  if (cells.length === 0) return '';
  return cells.join('');
}

/**
 * Hero visual. With a curated niche image it's a photo panel; without one it's
 * a built composition (arch, lettermark, rating chip) — never an empty box.
 * WEB-STANDARD §8.1.
 */
function renderHeroPanel(lead: Lead, imageUrl: string | null, strings: Strings): string {
  const chip =
    lead.rating != null
      ? `<div class="chip"><b>★ ${lead.rating.toFixed(1)}</b><span>${lead.reviewCount ?? 0} ${strings.reviewsShort}</span></div>`
      : '';
  if (imageUrl) {
    return `<div class="panel has-photo"><div class="photo" role="img" aria-label="${escapeHtml(lead.name)}"></div>${chip}</div>`;
  }
  return `<div class="panel"><div class="arch"><span class="mono">${escapeHtml(monogramFor(lead.name))}</span></div>${chip}<span class="tagchip">${escapeHtml(lead.region || strings.localBadge)}</span></div>`;
}

function renderServices(templateId: TemplateId, copy: PreviewCopy): string {
  return copy.services
    .map((svc, i) => {
      const n = String(i + 1).padStart(2, '0');
      const title = escapeHtml(svc.title);
      const blurb = escapeHtml(svc.blurb);
      switch (templateId) {
        case 'minimal-light':
          return `<div class="svc"><span class="num">${n}</span><h3>${title}</h3><p>${blurb}</p></div>`;
        case 'bold-dark':
          return `<div class="svc"><span class="num">${n}</span><h3>${title}</h3><p>${blurb}</p></div>`;
        case 'warm-local':
          return `<article class="svc"><span class="icowrap">${svgIcon(svc.title)}</span><h3>${title}</h3><p>${blurb}</p><span class="svc-n">${n}</span></article>`;
        case 'corporate-clean':
          return `<div class="svc"><span class="chk">✓</span><div><h3>${title}</h3><p>${blurb}</p></div></div>`;
      }
    })
    .join('\n');
}

// Rating block only when rating ≥ 4.0 (DESIGN.md shared structure).
function renderRating(lead: Lead, strings: Strings): string {
  if (lead.rating == null || lead.rating < 4.0) return '';
  const full = Math.round(lead.rating);
  const stars = '★'.repeat(Math.min(full, 5)) + '☆'.repeat(Math.max(0, 5 - full));
  return `<div class="rating"><span class="stars">${stars}</span><p>${lead.rating.toFixed(1)} ★ · ${lead.reviewCount ?? 0} ${strings.reviewsWord}</p></div>`;
}

/**
 * Proof strip (WEB-STANDARD §9.2) — highest trust-per-pixel element on the
 * page. Real Places data only; each item is omitted when we don't have it, so
 * the strip degrades to nothing rather than showing placeholders.
 */
function renderProof(lead: Lead, strings: Strings): string {
  const items: string[] = [];
  if (lead.rating != null) {
    const reviews = lead.reviewCount ? ` · ${lead.reviewCount} ${strings.reviewsWord}` : '';
    items.push(`<li class="proof-rating"><b>★ ${lead.rating.toFixed(1)}</b>${reviews}</li>`);
  }
  if (lead.region) items.push(`<li>${escapeHtml(lead.region)}</li>`);
  if (lead.category) items.push(`<li>${escapeHtml(lead.category)}</li>`);
  if (items.length === 0) return '';
  return `<ul class="proof">${items.join('')}</ul>`;
}

/**
 * Dark proof band. Uses the real Google rating as a statement rather than
 * repeating hero copy — duplicate sentences are the fastest way to look
 * auto-generated. Renders nothing when there's no rating to stand on.
 */
function renderProofBand(lead: Lead, strings: Strings): string {
  if (lead.rating == null) return '';
  const stars = '★'.repeat(Math.round(Math.min(lead.rating, 5)));
  const sub = [
    lead.reviewCount ? `${lead.reviewCount} ${strings.reviewsWord}` : '',
    lead.category && lead.region ? `${lead.category} · ${lead.region}` : lead.region,
  ]
    .filter(Boolean)
    .join(' · ');
  return `<span class="band-stars">${stars}</span><p class="band-score">${lead.rating.toFixed(1)}</p><p class="band-sub">${escapeHtml(sub)}</p>`;
}

/** Quick-facts aside next to the About copy, real data only. */
function renderFacts(lead: Lead, strings: Strings): string {
  const rows: string[] = [];
  if (lead.category) rows.push(`<div><dt>${strings.navServices}</dt><dd>${escapeHtml(lead.category)}</dd></div>`);
  if (lead.region) rows.push(`<div><dt>${strings.addressLabel}</dt><dd>${escapeHtml(lead.region)}</dd></div>`);
  if (lead.rating != null) {
    rows.push(
      `<div><dt>Google</dt><dd>★ ${lead.rating.toFixed(1)}${lead.reviewCount ? ` (${lead.reviewCount})` : ''}</dd></div>`,
    );
  }
  if (rows.length === 0) return '';
  return `<dl class="facts">${rows.join('')}</dl>`;
}

/** Opening-hours rows from real Places data. Empty string when unknown. */
function renderHours(lead: Lead): string {
  if (!lead.openingHours || lead.openingHours.length === 0) return '';
  const rows = lead.openingHours
    .map((line) => {
      const [day = '', hours = ''] = line.split('|');
      return `<tr><th scope="row">${escapeHtml(day)}</th><td>${escapeHtml(hours)}</td></tr>`;
    })
    .join('');
  return `<table class="hours"><tbody>${rows}</tbody></table>`;
}

export interface RenderParams {
  lead: Lead;
  copy: PreviewCopy;
  templateId: TemplateId;
  slug: string;
  baseUrl: string; // e.g. https://project.web.app
  calLink: string;
  heroImageUrl: string | null;
}

/** Fill the template. Returns the final self-contained HTML. */
export function renderPreview(params: RenderParams): string {
  const { lead, copy, templateId, slug, baseUrl, calLink, heroImageUrl } = params;
  const strings = stringsFor(lead.country);
  const phone = lead.phone ?? '';
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : `${baseUrl}`;

  const slots: Record<string, string> = {
    lang: lead.country === 'RS' ? 'sr-Latn' : 'en',
    businessName: escapeHtml(lead.name),
    headline: escapeHtml(copy.headline),
    subheadline: escapeHtml(copy.subheadline),
    about: escapeHtml(copy.about),
    ctaLabel: escapeHtml(copy.ctaLabel),
    metaDescription: escapeHtml(copy.metaDescription),
    servicesHtml: renderServices(templateId, copy),
    ratingBlock: renderRating(lead, strings),
    proofStrip: renderProof(lead, strings),
    proofBand: renderProofBand(lead, strings),
    bandHidden: lead.rating == null ? 'hidden' : '',
    factsHtml: renderFacts(lead, strings),
    hoursHtml: renderHours(lead),
    hoursLabel: strings.hoursLabel,
    // Sections with no real data are dropped entirely (WEB-STANDARD §1.4).
    hoursHidden: lead.openingHours?.length ? '' : 'hidden',
    mapQuery: encodeURIComponent(`${lead.name} ${lead.address}`),
    // WEB-STANDARD §8.1: never an empty placeholder. Without a curated image
    // the hero panel is a built composition, not a grey box.
    heroVisual: renderHeroPanel(lead, heroImageUrl, strings),
    heroMode: heroImageUrl ? 'has-visual' : 'type-led',
    marqueeHtml: renderMarquee(lead, copy, strings),
    marqueeHidden: copy.services.length === 0 ? 'hidden' : '',
    statsHtml: renderStats(lead, copy, strings),
    statsHidden: renderStats(lead, copy, strings) === '' ? 'hidden' : '',
    monogram: escapeHtml(monogramFor(lead.name)),
    directionsLabel: strings.directions,
    ctaBandTitle: strings.ctaBandTitle,
    ctaBandSub: strings.ctaBandSub,
    scrollCue: strings.scrollCue,
    reviewsShort: strings.reviewsShort,
    eyeServices: strings.eyeServices,
    eyeAbout: strings.eyeAbout,
    eyeVisit: strings.eyeVisit,
    aboutLead: escapeHtml(splitAbout(copy.about).lead),
    aboutLeadHidden: splitAbout(copy.about).lead === '' ? 'hidden' : '',
    aboutBody: escapeHtml(splitAbout(copy.about).body),
    phone: escapeHtml(phone || '—'),
    phoneHref,
    address: escapeHtml(lead.address),
    pageUrl: `${baseUrl}/p/${slug}`,
    ogImage: `${baseUrl}/p/${slug}-og.png`,
    calLink: escapeHtml(calLink || baseUrl),
    disclaimer: strings.disclaimer,
    servicesLabel: strings.servicesLabel,
    aboutLabel: strings.aboutLabel,
    contactLabel: strings.contactLabel,
    phoneLabel: strings.phoneLabel,
    addressLabel: strings.addressLabel,
    navServices: strings.navServices,
    navAbout: strings.navAbout,
    navVisit: strings.navVisit,
    callNow: strings.callNow,
    year: String(new Date().getFullYear()),
    accent: boldAccentForNiche(lead.category),
    heroBackground: heroBackground(templateId, heroImageUrl),
  };

  let html = loadTemplate(templateId);
  for (const [key, value] of Object.entries(slots)) {
    html = html.split(`{{${key}}}`).join(value);
  }
  return html;
}

/** OG card HTML (1200x630) in the template's visual language (DESIGN.md). */
export function renderOgCard(
  lead: Lead,
  templateId: TemplateId,
): string {
  const palettes: Record<TemplateId, { bg: string; fg: string; sub: string; font: string }> = {
    'minimal-light': { bg: '#2D5BFF', fg: '#FFFFFF', sub: 'rgba(255,255,255,.75)', font: 'Inter, system-ui, sans-serif' },
    'bold-dark': { bg: '#0A0A0B', fg: boldAccentForNiche(lead.category), sub: 'rgba(245,245,244,.7)', font: 'Archivo, system-ui, sans-serif' },
    'warm-local': { bg: '#C4572E', fg: '#FAF6EF', sub: 'rgba(250,246,239,.78)', font: 'Georgia, serif' },
    'corporate-clean': { bg: '#12233D', fg: '#FFFFFF', sub: 'rgba(255,255,255,.72)', font: 'Inter, system-ui, sans-serif' },
  };
  const p = palettes[templateId];
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${p.bg};font-family:${p.font};display:flex;flex-direction:column;justify-content:center;padding:80px;position:relative;overflow:hidden}
h1{color:${p.fg};font-size:76px;line-height:1.05;font-weight:800;max-width:20ch}
p{color:${p.sub};font-size:32px;margin-top:24px}
.mark{position:absolute;right:56px;bottom:44px;color:${p.sub};font-size:24px;font-weight:600}
</style></head><body>
<h1>${escapeHtml(lead.name)}</h1>
<p>${escapeHtml(lead.category)} · ${escapeHtml(lead.region)}</p>
<span class="mark">FlowDev</span>
</body></html>`;
}
