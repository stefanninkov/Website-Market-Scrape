# DESIGN.md — Website Market Scrape

Two design systems live in this repo and must never mix:
1. **App UI** — the internal tool Stefan uses. Dark, dense, fast.
2. **Preview templates** — the one-page sites sent to leads. Polished, modern, client-facing.

---

## Part 1 — App UI

### Principles
- Internal tool for one power user. Density over whitespace, tables over cards (desktop), everything reachable in ≤2 clicks.
- Mobile is a first-class citizen: Stefan triages leads and sends emails from his phone.

### Tokens (Tailwind v4 `@theme` in index.css)

```css
@theme {
  --color-bg: #0B0E14;          /* app background */
  --color-surface: #131722;     /* cards, table rows, drawer */
  --color-surface-2: #1B2130;   /* hover, inputs */
  --color-border: #262D3D;
  --color-text: #E6EAF2;
  --color-text-dim: #8B93A7;
  --color-accent: #C1FE00;      /* primary actions, brand lime */
  --color-accent-ink: #0B0E14;  /* text on accent */
  --color-info: #5AA9FF;
  --color-warn: #FFB454;
  --color-danger: #FF5C7A;
  --color-success: #3DDC97;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;  /* scores, counts, URLs */
}
```

- Radius: 8px inputs/buttons, 12px cards/drawer. Shadows minimal, borders do the separation work.
- Score badge colors: 80-100 accent, 60-79 warn, <60 text-dim.
- Stage colors: new info, qualified accent, contacted warn, replied success, won success (filled), lost/ignored text-dim.

### Layout
- **Desktop (≥1024px)**: fixed left sidebar 220px (logo, nav: Dashboard, Sweeps, Leads, Pipeline, Settings), content max-w none, tables full width. Lead drawer slides from right, 480px.
- **Tablet (768-1023px)**: sidebar collapses to icon rail 64px.
- **Mobile (<768px)**: bottom nav bar, 5 icons, safe-area padding. Lead drawer becomes full-screen sheet sliding from bottom. Filters collapse into a filter sheet triggered by one button.

### Tables → cards on mobile
Leads table on mobile renders as a card list: name + score badge on line 1, niche · city · websiteType chip on line 2, stage chip + quick actions (generate email, ignore) on line 3. Virtualize the list (leads can be thousands).

### Components
- Score badge (mono font, colored per range)
- websiteType chips: none (danger), facebook/instagram (warn), real (dim)
- "New business" badge: accent dot + label
- Kanban: columns horizontal-scroll on mobile, long-press to drag
- Toasts for job status (sweep started, draft ready, email sent)
- Empty states with the single obvious next action as a button

### Interaction rules
- Optimistic UI on stage changes and notes.
- All destructive actions (ignore, delete sweep) confirm once.
- Respect prefers-reduced-motion: transitions ≤150ms and none for reduced motion.

---

## Part 2 — Preview templates

> **See [WEB-STANDARD.md](WEB-STANDARD.md)** — the craft standard for every
> website we build (previews, the FlowDev portfolio, client work): type scales,
> color, spacing, motion, imagery, per-industry direction, accessibility,
> performance budgets, anti-patterns and the ship checklist. Where the two
> disagree, WEB-STANDARD.md wins for websites. This section stays as the quick
> visual reference for the four preview variants.

Client-facing one-pagers. These sell Stefan's work, quality bar is a real agency landing page. Self-contained HTML files (inlined CSS from a Tailwind build step, zero external JS, system font stack fallback with one Google Font per template).

### Shared structure (all 4 templates)
1. **Hero**: business name, {{headline}}, {{subheadline}}, CTA button (tel: link with {{phone}}), niche hero image or gradient
2. **Services**: 3-6 cards from {{services}}
3. **About**: {{about}} + rating block (star icons + "{{rating}} ★ · {{reviewCount}} recenzija/reviews on Google") shown only if rating ≥ 4.0
4. **Contact**: phone (tel: link), address, static map optional (skip if it adds complexity)
5. **Footer**: business name + concept disclaimer line
6. **Branding bar**: fixed bottom, small: "Concept by FlowDev" + button "Book a call" → {{calLink}}. Always in English regardless of lead country. Dismissible ✕ (session only).

All copy slots come from the PreviewCopy contract (SPEC §8). Serbian for RS leads, English otherwise, for content strings (CTA, services, disclaimer). The branding bar is the one exception: always English.

### Non-negotiables
- Flawless at 375px and 1440px. These pages demonstrate mobile competence to leads whose sites fail at exactly that.
- Lighthouse mobile ≥ 95. Inline critical CSS, preload the one font, images lazy-loaded and properly sized (~150KB max hero).
- Full meta: title, {{metaDescription}}, OG title/description/image (1200x630 generated per preview), twitter:card summary_large_image.
- No external analytics, no cookies, no forms (contact = phone/CTA only). Views tracked server-side by servePreview.

### The 4 variants

**1. minimal-light** (default: professional services, photographers, real estate)
- White #FFFFFF background, ink #101318 text, one restrained accent #2D5BFF
- Font: Inter. Generous whitespace, thin 1px dividers, small caps section labels
- Hero: no image, oversized headline (clamp 2.5-4.5rem), subtle dot-grid pattern
- Services as a clean 3-col grid (1-col mobile), numbered 01/02/03

**2. bold-dark** (gyms, auto repair, car detailing, trades)
- Background #0A0A0B, text #F5F5F4, loud accent per niche (gym #C1FE00, auto #FF4D2E, trades #FFB300)
- Font: a heavy grotesk (e.g. Archivo). Uppercase headline, tight tracking
- Hero: full-bleed niche image with dark gradient overlay, diagonal section divider
- Services as bordered cards with big index numbers, hover lift (desktop only)

**3. warm-local** (restaurants, cafes, bakeries, salons, guesthouses)
- Cream #FAF6EF background, warm ink #2B2118, terracotta accent #C4572E
- Font: serif display (e.g. Fraunces) for headings, Inter for body
- Hero: image with soft rounded mask (border-radius 24px), slight organic feel
- Rating block prominent (locals trust reviews), services as a cozy 2-col list with icons

**4. corporate-clean** (lawyers, clinics, dentists, accountants, notaries)
- White background, navy ink #12233D, muted teal accent #1F8A70
- Font: Inter throughout. Conservative, trustworthy, zero playfulness
- Hero: split layout, text left / image right (stacks on mobile)
- Services as bordered rows with checkmark icons, About emphasizes experience and trust

### Niche → template mapping (defaults, overridable per lead)
- corporate-clean: dentists, lawyers, accountants, notaries, clinics, physiotherapists, veterinary
- warm-local: restaurants, cafes, bakeries, hair/beauty salons, barbershops, hotels, guesthouses, wedding services
- bold-dark: gyms, auto repair, car detailing, construction, roofing, fencing, electricians, plumbers, landscaping
- minimal-light: everything else

### OG image
Generated per preview: template accent color background, business name large, niche + city small, subtle FlowDev mark bottom-right. Same visual language as the chosen template.
