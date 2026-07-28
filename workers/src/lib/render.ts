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
    disclaimer:
      'This is a concept mockup, not the official website of this business. Built by FlowDev as a proposal.',
  };
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
          return `<div class="svc"><span class="ico">✦</span><div><h3>${title}</h3><p>${blurb}</p></div></div>`;
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
    // WEB-STANDARD §8.1: never ship an empty placeholder. With no image the
    // hero becomes type-led and the visual element is omitted entirely.
    heroVisual: heroImageUrl
      ? `<div class="hero-visual" role="img" aria-label="${escapeHtml(lead.name)}"></div>`
      : '',
    heroMode: heroImageUrl ? 'has-visual' : 'type-led',
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
