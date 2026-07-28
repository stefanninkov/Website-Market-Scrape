# PREVIEW-GUIDE.md — building the one-page preview sites

The authoritative guide for the client-facing preview sites at `/p/{slug}`.
Expands DESIGN.md §Part 2 — where the two disagree, **this file wins** for
preview sites. DESIGN.md remains authoritative for the internal app UI.

---

## 1. What this page actually is

It is **not** a website. It is a **sales asset with one job**:

> A salon owner in Novi Sad, on her phone, between clients, taps a link in a
> cold email from a stranger. In about four seconds she decides whether this
> person is worth replying to.

Everything follows from that sentence:

- **Phone first.** She is on a 375px screen. Desktop is the afterthought.
- **Four seconds.** The value has to land above the fold, not after scrolling.
- **She must feel seen.** The page has to look *made for her business*, not
  generated. The instant it smells like a template, the reply rate dies.
- **It must beat what she has.** Her current site (or Facebook page) is the
  competition. Looking "fine" is a loss — it must look obviously better.

The success metric is not aesthetics. It is: **does she reply.**

---

## 2. The bar — and where v1 falls short

Honest assessment of the first version (`warm-local`, live at
`/p/hair-up-wux9`), because naming the problems is how they get fixed:

| Problem | Why it kills the pitch |
|---|---|
| **Empty gradient block** takes ~50% of the mobile hero | Reads as a broken image. Worse than no image at all. |
| **Nothing proves the business is real** above the fold | No hours, no address, no reviews, no map. Feels like lorem ipsum. |
| **Generic headline** ("Frizure koje se pamte") | Could be any salon on earth. Zero personalization signal. |
| **Vast dead whitespace** with nothing in it | Whitespace only reads as "premium" when it frames *something*. |
| **No navigation, no sections visible** | Looks like an unfinished draft, not a site. |
| **Flat surfaces** — no depth, texture, shadow, or detail | Nothing to look at. The eye slides off. |
| **Missing what salons actually need** | Hours, price list, booking, gallery, map, Instagram. |

**The rule going forward:** if a section has nothing concrete to say, **delete
the section**. A short dense page beats a long empty one. Every screen must
earn its scroll.

---

## 3. Anatomy of a preview that converts

Order matters. This is the mobile sequence.

### 3.1 Hero — the four seconds
Must contain, visible without scrolling:
1. **Business name** — real, prominent, spelled exactly as on Google
2. **One line of what they do + where** — "Frizerski salon u centru Novog Sada"
3. **Proof** — `4.6 ★ · 343 recenzije` — their real numbers, from Places
4. **One CTA** — `tel:` button, thumb-reachable
5. **A real image** — the business, the niche, or a rich designed surface

> Never ship an empty gradient as the only visual. If there's no image, the
> hero becomes **typography-led**: oversized name, tight leading, a textured
> or duotone background, and the rating badge doing the visual work.

### 3.2 Proof strip
Immediately under the hero. Horizontal, compact, scannable:
`★ 4.6 (343)` · `Otvoreno do 20h` · `Centar, Novi Sad` · `10+ godina`

This is the highest-trust-per-pixel element on the page. Everything here comes
from real Places data — never invented.

### 3.3 Services
3–6 items. Each is a **name + one concrete line**. No filler adjectives.
If prices are unknown, say nothing about price — never invent numbers.

### 3.4 About
50–80 words. Written to *her*, about *her* business. Mentions the city and the
niche. Should read like a person wrote it, not a brochure.

### 3.5 Contact
Phone (tel:), address, hours if known, map if it's free. Repeat the CTA.

### 3.6 Footer + branding bar
Concept disclaimer, then the fixed FlowDev bar with "Book a call".
**Always English**, even on Serbian pages.

---

## 4. Design direction

### 4.1 Typography — do the heavy lifting here
Because imagery is unreliable, **type carries the design**.

- **Hero name/headline:** `clamp(2.25rem, 8vw, 4.5rem)`, line-height `0.95–1.05`,
  letter-spacing `-0.02em`. Big enough to feel deliberate.
- **Body:** 16–18px, line-height `1.6`, max width `62ch`.
- **Section labels:** 11–12px, uppercase, letter-spacing `0.14em`, dimmed.
- **Two families maximum.** One display + one text. Never three.
- Load **one** font file per template. `preload` it. System stack as fallback.

### 4.2 Color
- One background, one ink, **one** accent. That's it.
- Accent is used for: the CTA, one or two small marks. Nothing else.
- Text contrast **≥ 4.5:1** always. Check the dim greys — they fail most often.
- Never a purple-to-blue gradient. Never a full-width rainbow. Never neon on white.

### 4.3 Space and rhythm
- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`. Nothing between.
- Section padding: `64px` mobile, `96–120px` desktop.
- **Whitespace must frame content.** An empty half-screen is a bug, not a style.

### 4.4 Depth and detail
Flat + empty = cheap. Add texture cheaply and tastefully:
- A hairline border (`1px`, 8–12% ink) instead of a heavy shadow
- One soft shadow on the single most important element only
- Subtle background: dot grid, noise, or a 2-stop gradient at **low** contrast
- Border radius consistent per template: pick `8`, `16`, or `24` and never mix

### 4.5 Motion
- Entrance: fade + 8px rise, `180ms`, `ease-out`. Once. Never loop.
- Hover effects on **desktop only** (`@media (hover: hover)`).
- Respect `prefers-reduced-motion` — disable everything.
- No parallax, no carousels, no autoplay.

### 4.6 Imagery — the biggest open gap
Priority order:
1. **Curated niche photos** in Storage `niche-images/{niche}/` (best; not yet loaded)
2. **A designed graphic surface** — duotone shape, pattern, large initial letter
3. **Typography-led hero with no image slot at all** (delete the box)

Rules: max ~150KB, `loading="lazy"` below the fold, explicit `width`/`height`
to stop layout shift, `object-fit: cover`.

> ⛔ **Never** use Google Places photos (ToS), and **never** scrape images or
> copy from the lead's existing site (SPEC §11).

---

## 5. The four templates

| Template | Niches | Character |
|---|---|---|
| `minimal-light` | professional services, photographers, real estate | White, restrained, editorial. Type-led. |
| `bold-dark` | gyms, auto, trades | Near-black, loud niche accent, uppercase grotesk, high energy. |
| `warm-local` | restaurants, cafés, salons, hotels | Cream, serif display, terracotta. Human and inviting. |
| `corporate-clean` | lawyers, clinics, dentists, accountants | Navy/teal, conservative, trust-first. Zero playfulness. |

Auto-selected by niche (`templateForNiche`), overridable per lead in the drawer.

**A template is only done when it looks finished with the *least* data we might
have** — no image, no rating, no hours. Design for the empty case first.

---

## 6. Copy rules

Generated by Claude against the SPEC §8 contract. Non-negotiable:

- **Serbian (latinica)** when `country == 'RS'`, English otherwise. Branding bar always English.
- **Invent nothing.** No prices, no hours, no staff names, no years-in-business,
  no certifications — unless it came from Places data.
- Address weaknesses **only** implicitly ("easy to find on your phone"), never
  "your current site is outdated."
- Headline ≤ 8 words. Subheadline ≤ 20. About 50–80. Service blurb ≤ 15.
- Specific beats clever. "Šišanje, farbanje i nega kose u centru Novog Sada"
  outperforms "Frizure koje se pamte."

---

## 7. Technical constraints

- **Single self-contained HTML file.** Inlined CSS, zero external JS, no build step at runtime.
- **Lighthouse mobile ≥ 95.** Measure on the deployed URL, not locally.
- **Flawless at 375px and 1440px.** Zero horizontal overflow — this is checked in the render test.
- Full meta: `title`, `description`, OG title/description/image (1200×630), `twitter:card`.
- `<meta name="robots" content="noindex">` — these are private pitches, not public pages.
- No cookies, no analytics, no forms. Contact is phone + CTA only.
- Views are counted server-side by `servePreview`.

---

## 8. Ship checklist

Before a template is considered done:

- [ ] Looks finished **with no image, no rating, and no hours**
- [ ] Above-the-fold at 375px shows: name, what+where, proof, CTA
- [ ] Zero horizontal scroll at 375px
- [ ] No empty block larger than ~25% of the mobile viewport
- [ ] Every section contains something concrete — or is removed
- [ ] Contrast ≥ 4.5:1 on all text, including dim greys
- [ ] `tel:` link actually dials the real number
- [ ] Branding bar present, English, dismissible
- [ ] Concept disclaimer present
- [ ] OG image renders and unfurls (test in WhatsApp/Viber)
- [ ] Lighthouse mobile ≥ 95 on the live URL
- [ ] Serbian version has no Cyrillic and no broken diacritics

---

## 9. Improvement roadmap

Ordered by impact on reply rate:

1. **Kill the empty hero block.** Typography-led hero when no image exists.
2. **Add the proof strip** (rating, reviews, city, hours) directly under the hero.
3. **Load real niche imagery** into `niche-images/{niche}/` — the single biggest
   visual upgrade available.
4. **Tighten copy prompts** toward specific over poetic.
5. **Add opening hours** to the Places field mask and surface them.
6. **Per-niche section sets** — salons get a price-ish service list; restaurants
   get hours prominently; trades get a service-area line.
7. **Add a second layout per template** so two leads in the same niche don't get
   identical-looking pages.

## 10. Changing or adding a template

- Files live in `workers/templates/{id}.html` with `{{slot}}` placeholders.
- Slots are filled by `workers/src/lib/render.ts` — add a slot there and in the template together.
- New template → add the id to `TemplateId` in `shared/src/types.ts` and map niches in `shared/src/preview.ts`.
- Always re-render all four and screenshot at 375 and 1440 before shipping.
- Test the **worst case**: a business with no phone, no rating, and a 40-character name.
