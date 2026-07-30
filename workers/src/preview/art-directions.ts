/**
 * Layer A — art direction presets (PREVIEW-SYSTEM.md §3).
 *
 * Each preset is a complete visual system, not a colour swap. The hard
 * constraints from WEB-STANDARD H7 and H8 are structural here: `fontDisplay`
 * and `fontText` are the only two families, `weights` carries at most three,
 * and there is exactly one `accent`. A preset needing a second accent is a new
 * preset, which is why there is no second accent field to put it in.
 *
 * Values resolve to the CSS custom properties inlined at the top of every
 * generated page.
 */

import type { ArtDirectionId } from '@wms/shared';

export type Density = 'tight' | 'normal' | 'roomy';

export interface ArtDirection {
  id: ArtDirectionId;
  /** What this direction reads as, for the agent choosing between them. */
  readsAs: string;
  bg: string;
  surface: string;
  ink: string;
  inkDim: string;
  line: string;
  accent: string;
  /** Text colour on top of `accent`. Must clear 4.5:1 against it (H2). */
  accentInk: string;
  fontDisplay: string;
  fontText: string;
  /** Google Fonts family names + weights, for the single stylesheet link. */
  googleFonts: string[];
  /** Modular scale ratio for the type steps (WEB-STANDARD §3). */
  scaleRatio: 1.25 | 1.333 | 1.5;
  radiusPx: number;
  density: Density;
  shadow: string;
  /** true when the palette is dark, so sections know which way to contrast. */
  dark: boolean;
}

/** Base spacing unit in px, multiplied by the space scale per density. */
export const DENSITY_GAP: Record<Density, number> = {
  tight: 6,
  normal: 8,
  roomy: 10,
};

export const ART_DIRECTIONS: Record<ArtDirectionId, ArtDirection> = {
  'editorial-warm': {
    id: 'editorial-warm',
    readsAs: 'Considered, local, warm',
    bg: '#FBF7F0',
    surface: '#FFFFFF',
    ink: '#1A1614',
    inkDim: '#6B615A',
    line: 'rgba(26,22,20,.12)',
    accent: '#C4552E',
    accentInk: '#FFF8F3',
    fontDisplay: "'Fraunces', Georgia, serif",
    fontText: "'Inter', system-ui, sans-serif",
    googleFonts: ['Fraunces:opsz,wght@9..144,400;9..144,600', 'Inter:wght@400;500;600'],
    scaleRatio: 1.333,
    radiusPx: 16,
    density: 'roomy',
    shadow: '0 2px 4px rgba(26,22,20,.04),0 18px 40px rgba(26,22,20,.10)',
    dark: false,
  },
  'clinical-calm': {
    id: 'clinical-calm',
    readsAs: 'Safe, competent, medical',
    bg: '#FFFFFF',
    surface: '#F6FAFC',
    ink: '#0E1B2A',
    inkDim: '#5A6B7C',
    line: 'rgba(14,27,42,.12)',
    accent: '#1E88A8',
    accentInk: '#FFFFFF',
    fontDisplay: "'Inter Tight', system-ui, sans-serif",
    fontText: "'Inter', system-ui, sans-serif",
    googleFonts: ['Inter+Tight:wght@500;600', 'Inter:wght@400;500'],
    scaleRatio: 1.25,
    radiusPx: 12,
    density: 'roomy',
    shadow: '0 2px 4px rgba(14,27,42,.05),0 14px 32px rgba(14,27,42,.08)',
    dark: false,
  },
  'industrial-bold': {
    id: 'industrial-bold',
    readsAs: 'Fast, capable, no nonsense',
    bg: '#0D0D0F',
    surface: '#17171A',
    ink: '#F2F2F0',
    inkDim: '#9A9A97',
    line: 'rgba(242,242,240,.14)',
    accent: '#FF4D14',
    accentInk: '#0D0D0F',
    fontDisplay: "'Archivo', system-ui, sans-serif",
    fontText: "'Archivo', system-ui, sans-serif",
    googleFonts: ['Archivo:wght@500;700;800'],
    scaleRatio: 1.5,
    radiusPx: 4,
    density: 'tight',
    shadow: 'none',
    dark: true,
  },
  'luxe-dark': {
    id: 'luxe-dark',
    readsAs: 'Expensive, quiet, exclusive',
    bg: '#0F0E0C',
    surface: '#171614',
    ink: '#EDE8DF',
    inkDim: '#9C9488',
    line: 'rgba(237,232,223,.14)',
    accent: '#C9A961',
    accentInk: '#0F0E0C',
    fontDisplay: "'Cormorant Garamond', Georgia, serif",
    fontText: "'Jost', system-ui, sans-serif",
    googleFonts: ['Cormorant+Garamond:wght@400;600', 'Jost:wght@400;500'],
    scaleRatio: 1.333,
    radiusPx: 2,
    density: 'roomy',
    shadow: '0 24px 60px rgba(0,0,0,.5)',
    dark: true,
  },
  'fresh-utility': {
    id: 'fresh-utility',
    readsAs: 'Clean, reliable, service',
    bg: '#F4F6F5',
    surface: '#FFFFFF',
    ink: '#101614',
    inkDim: '#5D6B66',
    line: 'rgba(16,22,20,.12)',
    accent: '#0FA36B',
    accentInk: '#FFFFFF',
    fontDisplay: "'General Sans', system-ui, sans-serif",
    fontText: "'General Sans', system-ui, sans-serif",
    googleFonts: ['Public+Sans:wght@400;500;700'],
    scaleRatio: 1.25,
    radiusPx: 10,
    density: 'normal',
    shadow: '0 2px 4px rgba(16,22,20,.05),0 12px 28px rgba(16,22,20,.08)',
    dark: false,
  },
  'gallery-mono': {
    id: 'gallery-mono',
    readsAs: 'Photography leads, UI disappears',
    bg: '#0A0A0A',
    surface: '#141414',
    ink: '#FAFAFA',
    inkDim: '#8E8E8E',
    line: 'rgba(250,250,250,.16)',
    // §3 gives accent == ink for this preset: the UI recedes so photos carry it.
    accent: '#FAFAFA',
    accentInk: '#0A0A0A',
    fontDisplay: "'Satoshi', system-ui, sans-serif",
    fontText: "'Satoshi', system-ui, sans-serif",
    googleFonts: ['Manrope:wght@400;500;700'],
    scaleRatio: 1.5,
    radiusPx: 0,
    density: 'tight',
    shadow: 'none',
    dark: true,
  },
  'heritage-serif': {
    id: 'heritage-serif',
    readsAs: 'Established, trustworthy, old',
    bg: '#F7F4EE',
    surface: '#FFFFFF',
    ink: '#221D18',
    inkDim: '#6E645A',
    line: 'rgba(34,29,24,.14)',
    accent: '#5C4033',
    accentInk: '#F7F4EE',
    fontDisplay: "'Libre Baskerville', Georgia, serif",
    fontText: "'Karla', system-ui, sans-serif",
    googleFonts: ['Libre+Baskerville:wght@400;700', 'Karla:wght@400;500'],
    scaleRatio: 1.25,
    radiusPx: 6,
    density: 'roomy',
    shadow: '0 2px 4px rgba(34,29,24,.05),0 14px 30px rgba(34,29,24,.10)',
    dark: false,
  },
  'soft-rounded': {
    id: 'soft-rounded',
    readsAs: 'Friendly, family, approachable',
    bg: '#FFF9F5',
    surface: '#FFFFFF',
    ink: '#2A211D',
    inkDim: '#7A6B63',
    line: 'rgba(42,33,29,.12)',
    accent: '#F2724C',
    accentInk: '#FFFFFF',
    fontDisplay: "'Bricolage Grotesque', system-ui, sans-serif",
    fontText: "'Nunito Sans', system-ui, sans-serif",
    googleFonts: ['Bricolage+Grotesque:wght@500;700', 'Nunito+Sans:wght@400;600'],
    scaleRatio: 1.333,
    radiusPx: 24,
    density: 'normal',
    shadow: '0 2px 6px rgba(42,33,29,.06),0 16px 36px rgba(42,33,29,.10)',
    dark: false,
  },
  'corporate-navy': {
    id: 'corporate-navy',
    readsAs: 'Structured, professional, safe',
    bg: '#FFFFFF',
    surface: '#F6F8FC',
    ink: '#0B1F3A',
    inkDim: '#56657C',
    line: 'rgba(11,31,58,.12)',
    accent: '#2E6BE6',
    accentInk: '#FFFFFF',
    fontDisplay: "'Sora', system-ui, sans-serif",
    fontText: "'Inter', system-ui, sans-serif",
    googleFonts: ['Sora:wght@500;600', 'Inter:wght@400;500'],
    scaleRatio: 1.25,
    radiusPx: 8,
    density: 'normal',
    shadow: '0 2px 4px rgba(11,31,58,.05),0 14px 30px rgba(11,31,58,.09)',
    dark: false,
  },
  'neon-night': {
    id: 'neon-night',
    readsAs: 'Modern, energetic, young',
    bg: '#08090C',
    surface: '#12141A',
    ink: '#EAEEF5',
    inkDim: '#8C93A3',
    line: 'rgba(234,238,245,.14)',
    accent: '#C1FE00',
    accentInk: '#08090C',
    fontDisplay: "'Space Grotesk', system-ui, sans-serif",
    fontText: "'Space Grotesk', system-ui, sans-serif",
    googleFonts: ['Space+Grotesk:wght@400;500;700'],
    scaleRatio: 1.5,
    radiusPx: 6,
    density: 'tight',
    shadow: 'none',
    dark: true,
  },
};

/**
 * Type steps from the modular scale. Step 0 is body size; negative steps are
 * small print. Returned as a clamp() so pages are fluid without media queries.
 */
export function typeStep(ad: ArtDirection, step: number): string {
  const min = 1 * Math.pow(ad.scaleRatio, step * 0.82);
  const max = 1 * Math.pow(ad.scaleRatio, step);
  const vw = 0.6 + step * 0.55;
  return `clamp(${min.toFixed(3)}rem,${vw.toFixed(2)}vw + 0.6rem,${max.toFixed(3)}rem)`;
}

/** The Google Fonts stylesheet href — one request per page (G9). */
export function fontHref(ad: ArtDirection): string {
  const families = ad.googleFonts.map((f) => `family=${f}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** The `:root` token block inlined into every generated page (§3). */
export function tokenBlock(ad: ArtDirection): string {
  const gap = DENSITY_GAP[ad.density];
  return `:root{
  --bg:${ad.bg}; --surface:${ad.surface};
  --ink:${ad.ink}; --ink-dim:${ad.inkDim}; --line:${ad.line};
  --accent:${ad.accent}; --accent-ink:${ad.accentInk};
  --font-display:${ad.fontDisplay}; --font-text:${ad.fontText};
  --scale-ratio:${ad.scaleRatio}; --radius:${ad.radiusPx}px;
  --gap-unit:${gap}px; --shadow:${ad.shadow};
  --step--1:${typeStep(ad, -1)}; --step-0:1rem;
  --step-1:${typeStep(ad, 1)}; --step-2:${typeStep(ad, 2)};
  --step-3:${typeStep(ad, 3)}; --step-4:${typeStep(ad, 4)};
  --motion:1;
}
@media(prefers-reduced-motion:reduce){:root{--motion:0}}`;
}

export function artDirection(id: ArtDirectionId): ArtDirection {
  return ART_DIRECTIONS[id];
}
