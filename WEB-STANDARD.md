# WEB-STANDARD.md — the FlowDev standard for every website we build

The craft standard for **every** site that ships under the FlowDev name:
generated lead previews, the FlowDev portfolio, and any client build.

It is deliberately opinionated. It gives values, not vibes — if a rule here has
a number, use that number. Deviating is allowed; deviating *by accident* is not.

Where this conflicts with DESIGN.md, **this file wins for websites**.
DESIGN.md remains authoritative for the internal app UI.

**Contents**
1. [Principles](#1-principles) · 2. [Hard rules](#2-hard-rules) · 3. [Type](#3-typography)
4. [Color](#4-color) · 5. [Space & layout](#5-space-and-layout) · 6. [Depth](#6-depth-and-surface)
7. [Motion](#7-motion) · 8. [Imagery](#8-imagery) · 9. [Page anatomy](#9-page-anatomy)
10. [Industry direction](#10-industry-direction) · 11. [Copy](#11-copy)
12. [Accessibility](#12-accessibility) · 13. [Performance](#13-performance)
14. [Anti-patterns](#14-anti-patterns) · 15. [Definition of done](#15-definition-of-done)
16. [Applying this to generated previews](#16-applying-this-to-generated-previews)

---

## 1. Principles

**1.1 A website has one job.** Name it in a sentence before designing anything:
*"A homeowner with a burst pipe finds the phone number in three seconds."*
*"A bride decides this photographer is worth an enquiry."* Every element either
serves that sentence or gets cut.

**1.2 Specific beats beautiful.** "Šišanje, farbanje i nega kose u centru Novog
Sada" outperforms "Frizure koje se pamte." Concrete nouns, real numbers, real
places. Generic copy makes a great layout look cheap; specific copy makes a
plain layout look confident.

**1.3 Design for the emptiest case first.** Build the page assuming no photo, no
rating, no hours. If it only looks good full of content, it is not finished —
because real data is always thinner than the mockup.

**1.4 Density over dilution.** A short dense page beats a long empty one.
Whitespace is only "premium" when it frames something. An empty region larger
than ~25% of the viewport is a bug.

**1.5 Mobile is the design, desktop is the adaptation.** Design at 375px first.
Most visitors arrive on a phone, in daylight, distracted, one-handed.

**1.6 Restraint reads as expensive.** One typeface pairing, one accent, one
shadow, one radius. Every additional variable is a chance to look amateur.

**1.7 It must beat what they have.** For previews especially: the competition is
their current site. "Fine" is a loss.

---

## 2. Hard rules

Non-negotiable on every site. A build that breaks one of these is not shippable.

| # | Rule |
|---|---|
| H1 | Zero horizontal scroll at **320px** and **375px** |
| H2 | Body text contrast **≥ 4.5:1**, large text and UI **≥ 3:1** |
| H3 | Touch targets **≥ 44×44px** with ≥ 8px between them |
| H4 | Visible focus state on every interactive element |
| H5 | `prefers-reduced-motion` disables all non-essential motion |
| H6 | Explicit `width`/`height` or `aspect-ratio` on every image (no layout shift) |
| H7 | **One** typeface pairing (max 2 families, max 3 weights total) |
| H8 | **One** accent color used for actions; never a second competing accent |
| H9 | Semantic HTML: one `<h1>`, ordered headings, real `<button>`/`<a>` |
| H10 | Phone numbers are `tel:` links; emails are `mailto:` links |
| H11 | Nothing invented — no fake prices, hours, credentials, or testimonials |
| H12 | LCP < 2.5s and CLS < 0.1 on a mid-tier phone over 4G |

---

## 3. Typography

Type carries more of the design than anything else. When in doubt, spend effort here.

### 3.1 Scale
Use a modular scale. Pick the ratio by content type and **never freehand a size**.

| Ratio | Use for | Steps (16px base) |
|---|---|---|
| **1.25** minor third | Content-heavy, professional, clinical | 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 |
| **1.333** perfect fourth | Marketing, editorial, most sites | 12 · 14 · 16 · 21 · 28 · 37 · 50 · 67 |
| **1.5** perfect fifth | Bold, sparse, statement pages | 12 · 16 · 24 · 36 · 54 · 81 |

Fluid display type: `clamp(2.25rem, 6vw, 4.5rem)`. Always set a `min` that works
at 320px and a `max` that doesn't overflow at 1440px.

### 3.2 Optical adjustments — the difference between amateur and not

| Size | Letter-spacing | Line-height |
|---|---|---|
| Display (≥ 40px) | `-0.02em` to `-0.03em` | `0.95` – `1.1` |
| Headings (24–39px) | `-0.01em` to `-0.02em` | `1.15` – `1.25` |
| Body (16–18px) | `0` | `1.55` – `1.7` |
| Small (12–14px) | `+0.01em` | `1.4` – `1.5` |
| Uppercase labels | `+0.10em` to `+0.16em` | `1.2` |

Line-height is **inverse to size**. Big type tight, small type loose. Getting
this wrong is the single most common tell of an unconsidered page.

### 3.3 Measure
- Body copy: **60–75 characters** per line (`max-width: 65ch`)
- Display/hero: **20–30 characters** (`max-width: 18ch` on the headline)
- Never let a paragraph run the full width of a 1440px screen.

### 3.4 Pairing
Contrast **structure**, not just style — pair a serif with a grotesque, or a
high-contrast display with a neutral text face. Two faces that are both
"modern sans" will read as a mistake.

Pairings that hold up:

| Display | Text | Reads as |
|---|---|---|
| Fraunces / Playfair | Inter / Söhne | Editorial, warm, crafted |
| Archivo / Anton | Inter | Bold, energetic, sporty |
| Instrument Serif | Geist / Inter | Modern editorial |
| Inter (tight, heavy) | Inter (regular) | Clean, technical, safe |
| GT Sectra / Newsreader | IBM Plex Sans | Considered, authoritative |

Single-family is legitimate — use weight and size for hierarchy instead. Often
the most confident choice.

### 3.5 Loading
- **One** family; two weights max unless there's a reason
- `woff2` only, subset to the character set (Latin Ext for Serbian diacritics)
- `<link rel="preload" as="font" crossorigin>` the single font that renders the LCP
- `font-display: swap` with a metric-matched system fallback to avoid reflow

---

## 4. Color

### 4.1 Build the palette from one decision
Choose **one accent** with intent (the industry table in §10 gives direction),
then derive everything else:

```
--accent      the one action color
--ink         near-black, tinted toward the accent hue
--surface     the page background
--surface-2   one step off the background for grouping
--border      ink at 10–14% opacity
--muted       ink at 55–65% opacity — MUST still pass 4.5:1
```

### 4.2 Never use pure values
| Don't | Do | Why |
|---|---|---|
| `#000000` | `#0A0A0B`, `#101318`, `#12140F` | Pure black is a void; real blacks carry hue |
| `#FFFFFF` on dark | `#F5F5F4`, `#E6EAF2` | Pure white glares against dark |
| `#808080` grey | Tint neutrals toward the accent hue by 2–6% | Untinted greys look muddy and unowned |

### 4.3 The one-accent rule
The accent is for: the primary CTA, and at most one or two small marks. That's
all. A second accent halves the power of the first. Semantic colors
(success/warn/danger) are functional and exempt — but never decorative.

### 4.4 Contrast
- Body text: **≥ 4.5:1** minimum, aim **7:1**
- Large text (≥ 24px or ≥ 19px bold): **≥ 3:1**
- UI borders and icons: **≥ 3:1**
- Check the dim/muted grey first — it fails more often than anything else.

### 4.5 Dark surfaces
Dark themes need *more* care: reduce pure-white text, lift borders to ~14%,
lower shadow reliance (shadows barely read on dark — use borders and lighter
surfaces for elevation instead).

---

## 5. Space and layout

### 5.1 Spacing scale
4px base. **Only these values:**

```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160
```

No `13px`, no `27px`. If a value between two steps feels needed, the layout is
wrong, not the scale.

### 5.2 Proximity
Space *within* a group must be visibly smaller than space *between* groups —
usually a 1:2 or 1:3 ratio. This is what makes a page feel organized. Label to
value: `8`. Group to group: `32`. Section to section: `96`.

### 5.3 Section rhythm
| Viewport | Section padding (block) | Gutter (inline) |
|---|---|---|
| 375px | `56–64px` | `20–24px` |
| 768px | `72–80px` | `32px` |
| ≥1024px | `96–128px` | `40–48px` |

Vary the rhythm slightly between sections — perfectly equal padding everywhere
reads as a template.

### 5.4 Widths and breakpoints
- Text-led content: `max-width: 1100px`
- Media-led / galleries: `max-width: 1280px`
- Full-bleed allowed only for hero imagery and color bands
- Breakpoints: **375** (design target) · **768** · **1024** · **1440**
- Mobile-first: base styles are the phone; `min-width` queries add from there

### 5.5 Grid
A 12-column grid with a `24px` gutter is the default for desktop. Most sections
are honestly better as flex with a `max-width` — don't reach for grid to prove
you can. Asymmetry (7/5, 8/4) reads as designed; a 6/6 split reads as default.

---

## 6. Depth and surface

Flat plus empty equals cheap. Add depth deliberately and sparingly.

**Preference order:** hairline border → tonal surface shift → soft shadow.

```css
/* Hairline: the default separator */
border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);

/* Elevation: layered, tinted with the surface hue — never pure black */
box-shadow:
  0 1px 2px  color-mix(in srgb, var(--ink) 6%, transparent),
  0 8px 24px color-mix(in srgb, var(--ink) 8%, transparent);
```

Rules:
- **One** elevated element per screen. If everything floats, nothing does.
- Never `box-shadow: 0 0 10px rgba(0,0,0,0.5)` — undirected black haze.
- Radius: pick **one** value per site (`8`, `12`, `16`, or `24`) and use it
  everywhere. Nested radius = outer minus padding, never equal.
- Texture, used at low contrast, beats another gradient: 1–3% noise, a dot grid,
  a hairline rule pattern.

---

## 7. Motion

Motion should be felt, not watched.

| Type | Duration | Easing |
|---|---|---|
| Micro (hover, focus, toggle) | `120–180ms` | `cubic-bezier(0.2, 0, 0, 1)` |
| Entrance / reveal | `200–320ms` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Exit | `120–160ms` | `cubic-bezier(0.4, 0, 1, 1)` |

- Animate **`opacity` and `transform` only** — they run on the compositor.
  Animating `height`, `top`, `width` or `margin` causes jank.
- Entrance: fade + `8–16px` rise. Once, on first view. Never on scroll-back.
- Stagger sibling reveals by `40–60ms`. More than ~5 staggered items feels slow.
- Hover effects inside `@media (hover: hover)` only.
- **Banned:** parallax, autoplaying carousels, scroll-jacking, looping attention
  animations, anything over `400ms`.
- Always:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
  ```

---

## 8. Imagery

Images do more for perceived quality than any CSS. They are also where most
small-business sites fail.

### 8.1 Priority order
1. **Real photos of the actual business** — always wins when available
2. **Curated, niche-appropriate stock** with a consistent grade
3. **A designed graphic surface** — duotone shape, pattern, oversized initial,
   typographic composition
4. **No image at all** — a typography-led layout with no empty slot

> Never ship an empty gradient box where an image was planned. **Option 4 beats
> a placeholder every time.** A missing image is invisible; a placeholder is a
> visible failure.

### 8.2 Treatment
- Pick **one** aspect ratio family per site (`4:3` + `1:1`, or `16:9` + `3:2`)
- Apply a consistent grade across every image: matched warmth, contrast and
  saturation. Mixed grading is what makes stock look like stock.
- Duotone or a subtle accent-tinted overlay unifies mismatched sources
- Crop for the subject, not the frame — art-direct rather than letting
  `object-fit` decide

### 8.3 Technical
```html
<img src="hero-960.webp"
     srcset="hero-640.webp 640w, hero-960.webp 960w, hero-1440.webp 1440w"
     sizes="(max-width: 768px) 100vw, 60vw"
     width="1440" height="960" alt="" loading="lazy" decoding="async">
```
- Hero image: **≤ 150KB**. Below-fold: **≤ 100KB** each.
- `webp`/`avif`, `loading="lazy"` below the fold, **never** lazy-load the LCP image
- Decorative images get `alt=""`; meaningful images get a factual description

### 8.4 Never
- Google Places photos (ToS violation)
- Anything scraped from the lead's existing site (SPEC §11)
- Uncredited/unlicensed stock
- Visible watermarks

---

## 9. Page anatomy

Patterns that work, in mobile order.

### 9.1 Hero — the first four seconds
Must answer, without scrolling: **who, what, where, why trust, what next.**

Contents:
1. Business name (real, exact)
2. One line: what they do + where — not a slogan
3. Proof: rating, review count, years, or credential
4. **One** primary CTA (`tel:` for local trades and services; booking for others)
5. A real image, or a deliberate typographic composition

Layouts that hold up: **split** (text/media), **type-led** (oversized headline,
no image), **full-bleed image with gradient scrim**. Centered-text-plus-two-
buttons is the default AI look — avoid unless there's a reason.

### 9.2 Proof strip
Directly under the hero. Horizontal, compact, real data only:
`★ 4.6 (343 recenzije)` · `Otvoreno do 20h` · `Centar, Novi Sad` · `Od 2011.`

Highest trust-per-pixel element on the page.

### 9.3 Services / offer
3–6 items, each a **concrete noun + one clarifying line**. Numbered lists,
bordered rows, or a restrained grid. Never six identical cards with icons and
15 words of filler.

### 9.4 About
50–90 words. Written about *this* business, mentioning the city and the work.
One human detail beats three sentences of positioning.

### 9.5 Social proof
Real reviews with real names, or nothing. **Never invent testimonials.**

### 9.6 Contact / close
Phone, address, hours, map if free. Repeat the CTA. This is often the second
most-visited section — treat it as a destination, not a footer.

---

## 10. Industry direction

The design decisions that actually change by sector. Use this before choosing a
palette or layout.

| Industry | Visitor's real job | Hero must show | Palette direction | Type direction | Primary CTA |
|---|---|---|---|---|---|
| **Restaurants / cafés** | Decide where to eat tonight | Food photo, hours, location | Warm cream/terracotta, or moody dark | Serif display, generous | Menu / Reserve |
| **Bakeries** | Find hours + what's fresh | Product photo, hours | Warm, soft, high-key | Rounded or serif | Directions |
| **Hair / beauty salons** | Judge quality of work | Portfolio image, rating | Warm neutral + one saturated accent | Elegant serif or clean grotesque | Book / Call |
| **Barbershops** | Price and walk-in ability | Interior shot, hours | Dark, high-contrast, vintage marks | Condensed, uppercase | Call |
| **Gyms / fitness** | Trial, schedule, vibe | Space or people in motion | Near-black + loud accent | Heavy grotesque, uppercase | Free trial |
| **Auto repair** | Trust + speed + price | Phone, services, certifications | Dark + safety orange/red | Bold industrial | Call now |
| **Trades** (plumber, electrician) | Emergency response | Phone, service area, response time | High-contrast, utility yellow/blue | Sturdy, plain | Call now |
| **Construction / roofing** | Proof of past work | Project photo, scale of work | Slate, concrete, amber | Strong, squared | Get a quote |
| **Dentists / clinics** | Feel safe, book | Credential, calm space, booking | Soft white/navy/teal | Neutral, generous spacing | Book appointment |
| **Physiotherapy** | Condition match | Treatments, credentials | Calm greens/blues | Clean, warm | Book |
| **Lawyers / notaries** | Authority, practice fit | Practice areas, credentials | Navy/charcoal + restrained gold | Serif or authoritative sans | Consultation |
| **Accountants** | Competence, services | Services, credentials | Cool neutral + one steady accent | Precise, tabular figures | Contact |
| **Hotels / guesthouses** | See rooms, check availability | Room/view photography | Muted, place-driven | Editorial serif | Check availability |
| **Photographers** | Judge the work | The work, full-bleed | Near-monochrome — let photos own color | Minimal, quiet | Enquire |
| **Real estate** | Browse listings | Featured property, area | Clean, cool, premium | Modern, structured | View listings |
| **Wedding services** | Style match | Portfolio, emotion | Soft, warm, low-saturation | High-contrast serif | Enquire |
| **Driving schools** | Price, schedule, pass rate | Pass rate, packages | Bright, friendly, high-contrast | Approachable, rounded | Book lesson |
| **Cleaning services** | Price, area, trust | Coverage area, services | Fresh, light, cool accent | Clean, simple | Get a quote |
| **Veterinary** | Urgency + care | Hours, emergency line | Warm, calm, soft | Friendly humanist | Call |

**Reading the table:** industry sets *emphasis and tone*, not a different rulebook.
Type, space, contrast and motion rules in §3–§7 never change.

---

## 11. Copy

Design and copy fail together. Weak copy cannot be rescued by layout.

- **Lead with the outcome**, not the offering. "Zubar koji prima hitne slučajeve
  istog dana" beats "Kvalitetna stomatološka usluga."
- **Concrete over evocative.** Numbers, places, named services.
- **Ban:** "elevate", "unlock", "seamless", "solutions", "take it to the next
  level", "in today's fast-paced world", "we pride ourselves on".
- **Length caps:** headline ≤ 8 words · subheadline ≤ 20 · about 50–90 ·
  service blurb ≤ 15.
- **Language:** Serbian (latinica) for RS, English otherwise. Never Cyrillic.
  Never machine-literal translation — write natively in the target language.
- **Invent nothing.** No prices, hours, staff, certifications, or years unless
  sourced from real data.
- **One CTA idea per page**, repeated — not five competing asks.

---

## 12. Accessibility

WCAG 2.2 AA is the floor, not the goal.

- Semantic landmarks: `<header> <main> <nav> <footer>`; one `<h1>`; no skipped levels
- Keyboard: every interactive element reachable and operable; logical order
- Focus: visible, ≥ 3:1 against adjacent colors — `:focus-visible` styled, never `outline: none` alone
- Touch: ≥ 44×44px, ≥ 8px apart
- Images: meaningful ones described factually; decorative ones `alt=""`
- Color is never the only carrier of meaning
- Text resizes to 200% without loss of content
- Motion respects `prefers-reduced-motion`
- Language declared: `<html lang="sr-Latn">` or `lang="en"`

---

## 13. Performance

Budgets, measured on the **deployed** URL on a mid-tier phone over 4G:

| Metric | Budget |
|---|---|
| LCP | **< 2.0s** (hard fail > 2.5s) |
| CLS | **< 0.05** (hard fail > 0.1) |
| INP | **< 200ms** |
| Lighthouse mobile Performance | **≥ 95** |
| HTML (single-page sites) | **< 100KB** |
| Hero image | **< 150KB** |
| Total page weight | **< 500KB** |
| Font files | ≤ 2, woff2, subset |
| Blocking JS | **0 bytes** where possible |

Practices: inline critical CSS; preload only the LCP font/image; explicit
dimensions everywhere; no third-party scripts, tag managers, or chat widgets
unless the client insists (and then: deferred).

---

## 14. Anti-patterns

The fastest way to look generated. Avoid all of these.

**Visual**
- Purple→blue gradient on white or dark — the single clearest AI tell
- Default typefaces used by default: Inter, Roboto, Arial, system-ui, Poppins
- Centered hero: eyebrow + headline + subhead + two buttons + abstract 3D blob
- Glassmorphism with no light source to justify it
- Every element with the same border-radius and the same drop shadow
- Six identical feature cards with generic icons
- Full-width gradient text
- Emoji standing in for icons
- Placeholder blocks where content should be

**Structural**
- Long pages of thin content — five sections saying nothing
- Sliders/carousels for content that matters (nobody clicks past slide one)
- Sticky headers eating 20% of a phone screen
- Cookie banners on sites that set no cookies
- Contact forms where a phone number would convert better

**Copy**
- "Welcome to our website"
- Slogan headlines that could belong to any business in the sector
- Invented testimonials, fake counters, fake urgency

---

## 15. Definition of done

Ship checklist. Every box, every site.

**Layout & responsive**
- [ ] Zero horizontal scroll at 320px, 375px, 768px, 1440px
- [ ] No empty region larger than ~25% of the mobile viewport
- [ ] Renders correctly with the **thinnest realistic data** (no image, no rating, no hours)
- [ ] Longest realistic business name doesn't break the hero

**Type & color**
- [ ] All sizes come from the chosen scale
- [ ] Line-height inverse to size; display type has negative tracking
- [ ] Body measure 60–75ch
- [ ] Body contrast ≥ 4.5:1 — muted text verified specifically
- [ ] One accent, used only for actions

**Content**
- [ ] Hero answers who/what/where/trust/next without scrolling
- [ ] Every section says something concrete — or has been deleted
- [ ] Zero invented facts
- [ ] Correct language, correct diacritics, no Cyrillic on Serbian pages

**Interaction & a11y**
- [ ] `tel:`/`mailto:` links dial and open correctly
- [ ] Focus visible everywhere; keyboard path complete
- [ ] Touch targets ≥ 44px
- [ ] `prefers-reduced-motion` honored

**Technical**
- [ ] Lighthouse mobile ≥ 95 on the live URL
- [ ] LCP < 2.0s, CLS < 0.05
- [ ] Full meta: title, description, OG (1200×630), `twitter:card`
- [ ] OG unfurls correctly in WhatsApp and Viber (test, don't assume)
- [ ] Favicon present

---

## 16. Applying this to generated previews

Preview sites at `/p/{slug}` add constraints on top of everything above.

**Extra constraints**
- Single self-contained HTML file: inlined CSS, zero external JS
- `<meta name="robots" content="noindex">` — private pitches, not public pages
- Fixed bottom branding bar: "Concept by FlowDev" + "Book a call" —
  **always English**, dismissible for the session
- Concept-mockup disclaimer in the footer
- No forms, no cookies, no analytics — contact is phone/CTA only
- Views counted server-side by `servePreview`
- Templates live in `workers/templates/{id}.html`; slots filled by
  `workers/src/lib/render.ts` — add a slot to both together
- New template → add to `TemplateId` (`shared/src/types.ts`) and map niches in
  `shared/src/preview.ts`

**Extra bar:** a generated page has no designer reviewing it before it reaches
the lead. So it must look finished across **every** lead in the niche —
including one with a 40-character name, no phone, and no rating. Design for
that lead, not the best one.

**Current gaps (v1), in priority order**
1. Empty gradient hero block — replace with a type-led hero (§8.1 option 4)
2. No proof strip — add rating, reviews, city, hours under the hero (§9.2)
3. No real imagery — load curated niche sets into `niche-images/{niche}/`
4. Copy too poetic — tighten prompts toward §11
5. Opening hours not fetched — add to the Places field mask and surface them
6. One layout per template — a second variant per template so two leads in the
   same niche don't receive identical pages
