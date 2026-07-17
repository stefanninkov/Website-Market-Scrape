/**
 * Preview helpers (SPEC §8, DESIGN.md §Preview templates): niche → template
 * mapping, slug generation. Pure and shared so the worker and UI agree.
 */

import type { TemplateId } from './types.js';

// DESIGN.md §Niche → template mapping (defaults, overridable per lead).
const CORPORATE: string[] = [
  'dentist',
  'lawyer',
  'accountant',
  'notar',
  'clinic',
  'physiotherap',
  'veterinar',
];
const WARM: string[] = [
  'restaurant',
  'cafe',
  'bakery',
  'bakeries',
  'hair salon',
  'beauty salon',
  'barbershop',
  'hotel',
  'guesthouse',
  'wedding',
];
const BOLD: string[] = [
  'gym',
  'auto repair',
  'car detailing',
  'construction',
  'roofing',
  'fencing',
  'electrician',
  'plumber',
  'landscap',
];

/** Pick the default template for a niche (DESIGN.md mapping). */
export function templateForNiche(niche: string): TemplateId {
  const n = niche.toLowerCase();
  if (CORPORATE.some((k) => n.includes(k))) return 'corporate-clean';
  if (WARM.some((k) => n.includes(k))) return 'warm-local';
  if (BOLD.some((k) => n.includes(k))) return 'bold-dark';
  return 'minimal-light';
}

/** Serbian latinica + common diacritics → ASCII for slugs. */
const TRANSLITERATION: Record<string, string> = {
  š: 's', đ: 'dj', č: 'c', ć: 'c', ž: 'z',
  ä: 'a', ö: 'o', ü: 'u', ß: 'ss',
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
  à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u',
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLITERATION[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no lookalikes

/** Short random suffix, e.g. "x7k2" (SPEC §8 slug shape). */
export function slugSuffix(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    const idx = Math.floor(random() * SLUG_ALPHABET.length);
    out += SLUG_ALPHABET[idx] ?? 'x';
  }
  return out;
}

/** Full preview slug: "frizerski-salon-ana-x7k2". */
export function makeSlug(businessName: string, random: () => number = Math.random): string {
  const base = slugify(businessName) || 'preview';
  return `${base}-${slugSuffix(random)}`;
}
