# PREVIEW-SYSTEM.md, preview generation v2

Authoritative for how a generated one-pager at `/p/{slug}` is composed, styled,
and filled. Replaces DESIGN.md Part 2 and the four fixed templates.

WEB-STANDARD.md still wins on craft rules (type, colour, spacing, motion,
accessibility, performance, the hard rules H1 to H12). This file describes the
machine that produces pages which obey them.

---

## 1. Why v1 looks generated

Four monolithic templates, one per broad category, chosen by a keyword match on
niche. That design has three failure modes and all three are visible:

1. **Sameness.** Every hair salon in the database receives the same page with a
   different name in the headline. A lead who forwards it to a friend in the same
   trade is a lost deal.
2. **Empty heroes.** With no imagery pipeline, the hero is a gradient. A gradient
   with a headline on it is the single most recognisable "this was generated"
   signal on the web. WEB-STANDARD §16 already lists this as gap 1.
3. **Copy that floats.** Without opening hours, real services, or real review
   text, the AI writes atmosphere. "Frizure koje se pamte" instead of "Šišanje i
   farbanje, radnim danima do 20h, centar Novog Sada". WEB-STANDARD 1.2 covers
   this and v1 violates it constantly.

None of these are fixed by making the four templates prettier. They are fixed by
changing what the generator is: from **template filling** to **composition**.

### 1.1 On borrowing designs

Reusing someone's template or Figma file for a commercial lead tool is a
licensing problem (most are single-project or non-redistributable, and a
generated page you send to a prospect is a distribution), and it does not solve
sameness anyway, it just changes which page everyone gets.

If a shortcut is wanted, the properly licensed routes are: HTML5 UP (CC BY 3.0,
attribution required), Tailwind UI or Tailwind Plus (paid, licence explicitly
permits use inside your own products), Cruip (free tier MIT, paid tier
commercial), and anything MIT on GitHub. Read the licence, keep the attribution
where required.

The recommendation here is different: build the system below once. It is roughly
the same effort as adapting two templates and it produces thousands of distinct
pages instead of four.

---

## 2. The model

A page is not a template. A page is a **composition spec**, resolved against
**available data**, rendered through a **section library**, styled by an
**art direction preset**.

```
ArtDirection  (how it looks)   ×
Sections      (what is on it)  ×
Data          (what is true)   =  one page
```

Ten art directions times a section library with variants times real per-business
data means two salons never receive the same page, and every page is still built
from parts that were designed once and reviewed once.

```ts
interface CompositionSpec {
  artDirection: ArtDirectionId;
  sections: SectionInstance[];     // ordered
  primaryModule: 'book' | 'reserve' | 'call';
  imagePlan: ImagePlan;
  language: 'sr' | 'en';
}

interface SectionInstance {
  type: SectionType;
  variant: string;
  data: Record<string, unknown>;   // resolved, never nullable at render time
}
```

Rendering is pure: spec plus data in, single self-contained HTML out. Same spec
plus same data always produces the same bytes. That makes it testable and makes
regeneration safe.

---

## 3. Layer A, art direction presets

Ten presets in `workers/src/preview/art-directions.ts`. Each is a complete visual
system, not a colour swap. All fonts listed are free for commercial use (Google
Fonts or Fontshare).

| id | Palette (bg / ink / accent) | Display / Text | Ratio | Radius | Density | Reads as |
|---|---|---|---|---|---|---|
| `editorial-warm` | `#FBF7F0` / `#1A1614` / `#C4552E` | Fraunces / Inter | 1.333 | 16px | roomy | Considered, local, warm |
| `clinical-calm` | `#FFFFFF` / `#0E1B2A` / `#1E88A8` | Inter Tight / Inter | 1.25 | 12px | roomy | Safe, competent, medical |
| `industrial-bold` | `#0D0D0F` / `#F2F2F0` / `#FF4D14` | Archivo Expanded / Archivo | 1.5 | 4px | tight | Fast, capable, no nonsense |
| `luxe-dark` | `#0F0E0C` / `#EDE8DF` / `#C9A961` | Cormorant Garamond / Jost | 1.333 | 2px | roomy | Expensive, quiet, exclusive |
| `fresh-utility` | `#F4F6F5` / `#101614` / `#0FA36B` | General Sans / General Sans | 1.25 | 10px | normal | Clean, reliable, service |
| `gallery-mono` | `#0A0A0A` / `#FAFAFA` / `#FAFAFA` | Satoshi / Satoshi | 1.5 | 0px | tight | Photography leads, UI disappears |
| `heritage-serif` | `#F7F4EE` / `#221D18` / `#5C4033` | Libre Baskerville / Karla | 1.25 | 6px | roomy | Established, trustworthy, old |
| `soft-rounded` | `#FFF9F5` / `#2A211D` / `#F2724C` | Bricolage Grotesque / Nunito Sans | 1.333 | 24px | normal | Friendly, family, approachable |
| `corporate-navy` | `#FFFFFF` / `#0B1F3A` / `#2E6BE6` | Sora / Inter | 1.25 | 8px | normal | Structured, professional, safe |
| `neon-night` | `#08090C` / `#EAEEF5` / `#C1FE00` | Space Grotesk / Space Grotesk | 1.5 | 6px | tight | Modern, energetic, young |

Each preset resolves to a token block inlined at the top of the page:

```css
:root {
  --bg; --surface; --ink; --ink-dim; --line;
  --accent; --accent-ink;
  --font-display; --font-text;
  --scale-ratio; --radius; --gap-unit; --shadow;
  --motion: 1 | 0;   /* 0 under prefers-reduced-motion, set by media query */
}
```

Hard constraints, from WEB-STANDARD H7 and H8: max 2 families, max 3 weights
total, exactly one accent. A preset that needs a second accent is a new preset.

### 3.1 Choosing the preset

```
weighted map: niche → [preset, weight][]      (config/previewArtDirection)
tiebreak:     hash(placeId) picks within the weighted set
override:     Stefan can pin a preset per lead, and it survives regeneration
```

Weighted rather than fixed, so the same niche in the same city produces variety.
Hashed rather than random, so regeneration is deterministic and a link already
sent to a lead never changes appearance.

Starting map (extend in Settings, do not hardcode):

- hair, beauty, wedding, photographer: `editorial-warm`, `gallery-mono`, `luxe-dark`
- barber, gym, auto, tattoo: `industrial-bold`, `neon-night`, `gallery-mono`
- dentist, clinic, physio, vet: `clinical-calm`, `soft-rounded`, `corporate-navy`
- lawyer, accountant, notary: `corporate-navy`, `heritage-serif`, `clinical-calm`
- restaurant, cafe, bakery, konoba: `editorial-warm`, `heritage-serif`, `soft-rounded`
- trades, construction, roofing, cleaning: `fresh-utility`, `industrial-bold`
- hotel, guesthouse, real estate: `luxe-dark`, `editorial-warm`, `gallery-mono`
- driving school, childcare: `soft-rounded`, `fresh-utility`

Each row already gives WEB-STANDARD §10 its palette and type direction. This
table is the implementation of that table.

---

## 4. Layer B, section library

`workers/src/preview/sections/`. Each section is a function
`(data, tokens, lang) => string` returning an HTML fragment. Each declares the
data it requires and the data it can use if present.

| Section | Variants | Requires | Optional |
|---|---|---|---|
| `hero` | `photo-full`, `split-photo`, `type-led`, `card-stack` | name, headline, primary CTA | image, rating, hours |
| `proofstrip` | `inline`, `banded` | at least 2 facts | rating, review count, years, city, open-now |
| `services` | `numbered`, `icon-grid`, `price-cards`, `editorial-rows` | 3 to 6 services | prices, blurbs |
| `gallery` | `masonry`, `strip`, `duo` | 3+ images | captions |
| `about` | `text-portrait`, `stat-row`, `quote-led` | about copy | portrait, stats |
| `reviews` | `cards`, `single-pull` | 2+ real reviews | author, rating |
| `hours` | `week-table`, `open-now-pill` | opening hours | holiday note |
| `location` | `map-split`, `address-band` | address | static map image, directions link |
| `primaryModule` | `book`, `reserve`, `call` | per §10.1 of WEB-STANDARD | hours for slot logic |
| `faq` | `accordion`, `two-col` | 3+ Q/A | none |
| `ctaBand` | `full-bleed`, `boxed` | CTA label, phone | none |
| `footer` | `standard` | name, address, phone | socials |

**Rule: no section renders with placeholder content.** If required data is
missing, the section is not in the spec. This is WEB-STANDARD 1.3 enforced by the
composer rather than hoped for by the designer.

### 4.1 The hero decision

The most important single choice on the page.

```
has 1+ good business photo (>= 1200px wide)      → photo-full or split-photo
has photos but all weak/low-res                  → split-photo with the best one, cropped
has no photos, has rating >= 4.5 and 20+ reviews → card-stack (review-led)
has nothing                                      → type-led
```

`type-led` is a real design, not a fallback: oversized fluid display type,
generous negative space, accent rule, the primary action immediately below. It is
the answer to WEB-STANDARD §16 gap 1. **A gradient behind a headline is never a
hero.** Delete that path.

### 4.2 The primary module

Implement all three from WEB-STANDARD §10.1, including its rules: slots come from
real opening hours, closed days disabled and labelled, no hours means no module,
same-day slots respect a lead time.

On a preview specifically: submitting confirms the *selection*, states plainly
that nothing was sent to the business, and hands off to the phone number. Someone
waiting for an appointment that nobody received is the worst outcome this system
can produce.

---

## 5. Layer C, imagery

The largest single quality lever, and the one gap that no amount of layout work
compensates for.

### 5.1 A compliance constraint that shapes the whole section

The obvious idea is to use the business's own photos from Google Places. It is
not available. Google Maps Platform terms prohibit pre-fetching, caching or
storing Places content, with place IDs as the only broad exception, and any
displayed Places photo must carry its `authorAttributions` plus Google Maps
attribution. A self-contained preview HTML file with a base64 photo embedded in
it is exactly the warehousing the terms forbid.

The existing rule in CLAUDE.md ("No Google Places photos in previews") was
correct and stays. Do not reintroduce it.

The same rule cuts the other way on lead data generally: names, ratings, hours
and phone numbers stored indefinitely in Firestore are outside the caching
exception too. For a single-user private tool this is a low-exposure risk, but it
is a real one, and it is the reason nothing in this system should ever become a
public directory or a resold dataset.

Also unchanged: no scraping images from the lead's existing website into their
preview. Their photos are their copyright, and a lead who spots their own hero
image in an unsolicited mockup reacts badly even when flattered.

### 5.2 Source priority, first hit wins

1. **Pexels API.** Free, commercial use permitted, no attribution legally
   required (give it anyway). Best coverage for trades, services, food, fitness.
2. **Unsplash API.** Free for commercial use. Attribution is required by their
   guidelines and their API terms require serving through their CDN, which
   conflicts with the single-file constraint. Use Unsplash only where the image
   can be hotlinked, or skip it and lean on Pexels.
3. **Openverse** for CC-licensed material. Store the licence string per image and
   render the required attribution.
4. **Texture or pattern**, generated, never a flat gradient.
5. **No image.** Compose a `type-led` hero and omit the gallery. This is a good
   page, not a degraded one.

Once a lead becomes a client, their real photos arrive from them and the built
site uses those. The preview's job is to prove the design, not to be the final
asset.

### 5.3 Curation, not raw search

Raw stock search returns the same twelve overused images everyone has seen. Curate
once per niche into Storage `niche-images/{niche}/` (20 to 40 images), review them
by eye, and let the composer pick from the reviewed set. Refresh quarterly. This
is the one manual step worth keeping, and it is cheap because it is per niche and
not per lead.

Rejection criteria when curating: visible foreign-language signage, obvious
American or Asian architecture for European leads, watermarks, faces in sharp
focus (they date fast and read as stock), anything with an obviously staged
handshake.

### 5.4 Processing and selection

- Max 1600px wide, WebP with a JPEG fallback, EXIF stripped
- 300KB data-URI cap retained, single-file constraint retained
- Deterministic pick by `hash(placeId + sectionIndex)`, so two businesses in the
  same niche do not get the same photo and regeneration does not reshuffle
- A licence record is written per image on the preview doc: source, url, licence,
  attribution. If it cannot be recorded, the image is not used

### 5.5 Opening hours

The booking module needs real hours (WEB-STANDARD §10.1) and hours fall under the
same caching restriction as photos. So: fetch them with a live Places Details
call at preview generation time, use them in that render, and do not warehouse
them as a permanent field. No hours available means no booking module, which is
already the rule.

## 6. Layer D, copy

Extend `PreviewCopy` and tighten the prompt toward WEB-STANDARD §11.

```ts
interface PreviewCopy {
  headline: string;          // <= 8 words, must name the trade and the place
  subheadline: string;       // <= 20 words, concrete offer or coverage
  about: string;             // 50-80 words
  services: Array<{ title: string; blurb: string; price?: string }>;
  proofFacts: string[];      // 2-4, each traceable to data
  ctaLabel: string;
  faq?: Array<{ q: string; a: string }>;
  metaDescription: string;
  altTexts: Record<string, string>;   // one per image slot, required
}
```

Prompt rules, stated as hard constraints and validated where possible:

- Name the trade and the city in the headline. "Frizerski salon u centru Novog
  Sada" beats anything evocative.
- Every number, price, credential, and year comes from `research`. Nothing is
  invented, per WEB-STANDARD H11. A validator rejects copy containing digits that
  do not appear anywhere in the source data.
- No superlatives without evidence. "Najbolji" is banned outright. "Ocena 4.8 iz
  213 recenzija" is the same claim with a source.
- FAQ questions come from `reviewThemes.complained` and the real questions that
  niche gets, not from the model's imagination.
- Serbian for RS leads, English otherwise, branding bar always English. Unchanged.

---

## 7. Quality gates

Automated, run on every render, before the preview is marked ready.

| Gate | Check | Fail action |
|---|---|---|
| G1 | No horizontal scroll at 320 and 375 (H1) | block |
| G2 | Every text/background pair >= 4.5:1, UI >= 3:1 (H2) | block |
| G3 | Every `img` has width/height or aspect-ratio (H6) | block |
| G4 | Exactly one `h1`, headings ordered (H9) | block |
| G5 | Phone is `tel:`, email is `mailto:` (H10) | block |
| G6 | No unfilled `{{slot}}` remains | block |
| G7 | Max 2 font families, max 3 weights (H7) | block |
| G8 | No digit in rendered copy absent from source data (H11) | block |
| G9 | Page weight under 500KB, one render-blocking font request | warn |
| G10 | No empty region above 25% of the 375px viewport (1.4) | warn, feeds agent critique |
| G11 | Every image has a licence record and required attribution | block |

G1 to G8 and G11 are deterministic and belong in code, in
`workers/src/preview/gates.ts`, running headless against the rendered HTML. They
run whether or not the preview agent is enabled. G10 is judged by A4 in the
critique loop (AGENTS.md §7.1).

---

## 8. Migration from v1

The four templates are not deleted on day one. Order:

1. Build art directions, tokens, and the section library. Compose
   `minimal-light` out of sections as a proof that the library can express what
   exists today.
2. Add gates. Run them against current v1 output and record what fails. That
   list is the honest baseline.
3. Add the imagery pipeline. This alone is the biggest visible jump, and it
   works with v1 templates too.
4. Switch `templateForNiche` to `artDirectionForNiche` plus the composer.
   `TemplateId` becomes `ArtDirectionId`. Keep a mapping for old slugs so
   previews already sent still resolve.
5. Delete `workers/templates/*.html` once the composer covers every section they
   had.

Slugs never change and view counters never reset, same rule as today.

---

## 9. What this buys

- Two leads in the same niche and city receive visibly different pages.
- No page ships with a placeholder hero, an invented fact, or a contrast failure,
  because those are blocking gates rather than review notes.
- Real photography of the actual business where it exists.
- A booking, reserve, or call module that matches what the visitor came to do.
- One place to raise the bar for every future page: add a section variant or an
  art direction, and every subsequent preview can use it.
