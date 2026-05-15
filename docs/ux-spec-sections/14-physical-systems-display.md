# Section 14: Physical Systems Display

**Status:** spec authored — implementation pending per system (Equoria-m4k6)
**Layer:** Component design (HorseDetailPage tabs + HorseCard chips)
**Source:** Equoria-m4k6 (readiness report §4 W1 gap); Epics 31B–31F shipped backend; this section establishes the UX guidance for the corresponding frontend integrations.

---

## What This Section Covers

The physical systems shipped in Epics 31B–31F expose rich biological data on each horse: conformation scores, gait quality, temperament, coat color genotype/phenotype, breeding color predictions, and conformation-show participation. This section defines:

1. The visual treatment for each system (Celestial Night-compatible).
2. The data shape consumed from the API.
3. Empty / error / unknown-data states.
4. Mobile responsiveness.
5. Accessibility (WCAG AA).

Use this section when implementing or reviewing UI for any of the six subsystems below.

---

## 14.1 Conformation Display (8-Region Radar Chart)

**Where shown:** HorseDetailPage → "Conformation" tab. Optional compact bar on HorseCard hover.

**Data shape (from `/api/v1/horses/:id/conformation`):**

```ts
type Conformation = {
  head: number; // 0-100
  neck: number;
  shoulders: number;
  back: number;
  hindquarters: number;
  legs: number;
  hooves: number;
  topline: number;
  overall: number; // 0-100 weighted average (display-only)
};
```

**Visual treatment:**

- 8-region radar chart, FrostedPanel container.
- Axis labels in Cinzel small caps (12px), values rendered at the axis tip in Inter 11px.
- Stroke: gold accent (#c9a44d at 80% opacity).
- Fill: gold gradient at 25% opacity so the panel atmosphere shows through.
- Center text: `overall` score in Cinzel 22px gold + label "Conformation".
- Comparison overlay (optional): faded second polygon for breed average, in muted lavender at 40% opacity.

**Empty state:** "Conformation not yet evaluated — visit a conformation judge". CTA chip linking to conformation-shows page.

**Error state:** Replace polygon with skeleton octagon outline. Toast "Conformation data unavailable" with retry chip.

**Unknown-region state:** If a single region is null (e.g. a yearling whose hindquarters aren't yet judged), render axis label dimmed (50%) and skip that polygon vertex (use the adjacent two regions to interpolate, rendered as a dashed gold line). Tooltip on the dim label explains "Not yet assessed".

**Mobile:** Drops to 240px wide, axis labels stay 12px (no rotation), values move below axis labels in 10px Inter so they don't clip.

**Accessibility:**

- `role="img"` with `aria-label="Conformation radar: head 78, neck 82, shoulders 75, back 70, hindquarters 80, legs 85, hooves 88, topline 79, overall 79"`.
- For non-visual users, render a `<dl>` below the chart inside a `<details>` element ("View as table"). Each region is a `<dt>` / `<dd>` pair.
- Focus ring: 2px gold offset when chart receives keyboard focus; arrow keys cycle through axis tooltips.

---

## 14.2 Gait Quality Display

**Where shown:** HorseDetailPage → "Conformation" tab (subsection below the radar) and on `/horses/:id/gait` standalone view.

**Data shape (from `/api/v1/horses/:id/gait`):**

```ts
type Gait = {
  walk: number; // 0-100
  trot: number;
  canter: number;
  gallop: number;
  named: { name: string; quality: number }[]; // Breed-specific named gaits, 0–N entries
};
```

**Visual treatment:**

- Horizontal bar group, one row per gait. Bar height 8px, full-width within panel.
- Bar fill: rose-pink gradient (`var(--color-coral)` → `var(--color-rose)`) for canonical 4 gaits.
- Named gaits (e.g. Tennessee Walker's "running walk") rendered below with a `Gaited` icon chip prefix and the same bar style but in gold tone to distinguish.
- Bar values rendered on the right in Inter 12px tabular-nums.

**Empty state (no named gaits):** Don't render the "Named Gaits" subsection at all — just the 4 standard gaits. The absence is informative, not an error.

**Error state:** Bars render at zero with a subtle shimmer; toast "Gait scores unavailable".

**Mobile:** Bars stay full-width. Labels move above bars when viewport < 480px.

**Accessibility:**

- Each bar is a `progressbar` role with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`, and `aria-label` ("Walk quality: 82 out of 100").
- Color is not the only differentiator between standard and named gaits — the chip prefix carries the meaning.

---

## 14.3 Temperament Badge

**Where shown:** HorseCard (compact badge), HorseDetailPage header (full badge with description).

**Data shape (already on `horse.temperament` string field — see PRD-04 §1.2):**

```ts
type Temperament = 'calm' | 'nervous' | 'aggressive' | 'docile' | 'fiery' | ...;
```

**Visual treatment (compact badge on HorseCard):**

- 22px high pill, Cinzel small caps 11px, padding 0 8px.
- Background: temperament-specific gradient tint at 20% opacity over the FrostedPanel.
- Border: 1px temperament accent color at 60% opacity.
- Examples:
  - `calm` → silver-blue gradient, border `#7a8fa8`
  - `nervous` → muted yellow, border `#c9a44d` (matches gold accent)
  - `aggressive` → muted red, border `#a06058`
  - `docile` → soft green, border `#5e8866`
  - `fiery` → coral-orange, border `#d97a5a`

**Visual treatment (full badge on HorseDetailPage header):**

- 32px high pill (more padding), Cinzel 14px.
- Right of pill: 1-sentence description in Inter 12px italic gray-100. Pulled from a static `TEMPERAMENT_DESCRIPTIONS` map.
- Tooltip on hover shows the full compatibility-implication text (e.g. "Pairs well with patient trainers").

**Empty state:** If `temperament === null`, render "Temperament unknown" with a dimmed neutral border and italic gray-300 text. No CTA — temperament resolves naturally during foalhood (see PRD-04 §1.3) so it should not be presented as user-actionable.

**Mobile:** Compact badge unchanged. Full badge on detail page collapses description below the pill (not to the right) when viewport < 640px.

**Accessibility:**

- Color is supplemented by the temperament label itself. Tooltip is keyboard-focusable.
- High-contrast mode: borders darken to 100% opacity, gradient drops to solid color matching border. (Equoria-tjai tracks the HorseCard surface; this section provides the spec it must match.)

---

## 14.4 Coat Color Display

**Where shown:** HorseCard chip (small), HorseDetailPage → "Coat" tab (detail card).

**Data shape (from `horse.phenotype` JSONB — see Equoria-tkyx for /horses list, Equoria-7l75 for /horses/trainable list):**

```ts
type Phenotype = {
  colorName: string;        // 'Bay', 'Chestnut', 'Black', 'Grey', 'Palomino', 'Buckskin', ...
  shade?: string;           // 'mahogany' | 'liver' | 'flaxen' | ...
  markings?: {
    face?: 'star' | 'stripe' | 'snip' | 'blaze' | 'bald' | null;
    legs?: { fr?: 'sock' | 'stocking' | null; fl?: ...; hr?: ...; hl?: ... };
  };
};
```

**HorseCard chip:**

- 22px high pill, neutral panel-border styling. Color-name in Cinzel small caps 11px.
- Optional 6px-diameter swatch dot to the LEFT of the text, filled with an approximation of the actual coat color (e.g. Bay = `#7a4d2e`, Grey = `#a8a8a8`).
- Tooltip shows full phenotype: "Bay (mahogany) · Star face · 2 socks".

**HorseDetailPage "Coat" tab (FrostedPanel detail card):**

- Top section: large illustrated silhouette of the horse, tinted to match coat color + shade. Markings (face/legs) overlaid as semi-transparent shapes.
- Below silhouette: 3-line summary in Cinzel: color name, shade, marking summary.
- Optional "Show genotype" toggle (collapsed by default) revealing `colorGenotype` JSONB underneath in monospace. Hidden behind a toggle because genotype is data-dense and most users want phenotype only.

**Empty state (no phenotype):**

- HorseCard: no chip rendered (do NOT show a "Color unknown" chip — would be visual noise on cards where art is the primary signal).
- HorseDetailPage Coat tab: render silhouette in a neutral grey with a banner "Coat color not yet determined".

**Error state:** Same as empty state with a small "Retry" chip.

**Mobile:** HorseCard chip unchanged. Coat tab silhouette scales to viewport width, markings overlay scales proportionally.

**Accessibility:**

- The colored swatch dot is decorative — color name in text is the source of truth.
- For low-vision users: the markings overlay on the silhouette must have ≥ 3:1 contrast with the silhouette tint, OR be supplemented with a labelled marking diagram in a `<details>` element below.
- `aria-label` on the chip: "Coat: Bay, mahogany shade, star face, 2 white socks".

---

## 14.5 Breeding Color Prediction Probability Chart

**Where shown:** Breeding pairing UI → "Coat prediction" section. Triggered after sire+dam are selected.

**Data shape (from `/api/v1/breeding/color-prediction`):**

```ts
type ColorPrediction = {
  possibleColors: {
    colorName: string;
    probability: number;       // 0–1
    percentage: string;        // e.g. "37.5%"
  }[];
  warnings?: {
    type: 'lethal_white' | 'rare_combination' | ...;
    message: string;
  }[];
};
```

(Algorithm reference: `.claude/rules/PATTERN_LIBRARY.md` § Per-Locus Probability.)

**Visual treatment:**

- Horizontal stacked bar at the top, with each color segment proportional to its probability.
- Below the bar: ordered list, most-probable first. Each row:
  - 8px swatch dot (filled with approximate coat color)
  - Color name in Cinzel 14px
  - Percentage in Inter tabular-nums right-aligned

**Warning treatment:**

- If a `lethal_white` warning is present, render a parchment-style alert above the chart with a faint red border. Heading: "Lethal-white risk detected". Body: warning message + link to "Learn more" pointing at PRD-03 §3.2 (Breeding).
- See Equoria-wrm5 (lethal-white E2E spec) for the test that exercises this UI.

**Empty state:** Initially the chart is hidden — only renders after a valid sire+dam pair is selected. Show a CTA: "Select a sire and dam to preview offspring coat probabilities".

**Error state:** "Coat prediction unavailable" — retry chip. Preserve current selection so user doesn't lose state.

**Mobile:** Chart stays full-width. Ordered list is full-width below it. Lethal-white alert stays above chart with the same parchment treatment.

**Accessibility:**

- The chart is a `figure` with a `figcaption` summarizing the top 3 outcomes ("Most likely: Bay 37%, Chestnut 28%, Black 15%").
- Each color segment has an `aria-label` with the color name and percentage.
- Warning alerts have `role="alert"` (announced when they appear post-selection).

---

## 14.6 Conformation Show Entry & Results

**Where shown:** Conformation-shows page; HorseDetailPage → "Achievements" tab for results.

**Entry flow (FrostedPanel modal):**

1. Step 1: select horse from eligible list (filtered by age + breed eligibility per `conformationShowService.mjs`).
2. Step 2: confirm entry fee.
3. Step 3: submit → show running state with a brief animation, then result.

**Results display:**

- Per-region score breakdown (8 regions × score) in a table.
- Overall placement large number in Cinzel 32px gold.
- Comparison to breed average (lavender bar overlay).
- Judge's comment in Inter 14px italic (1-2 lines, generated server-side).

**Empty state:**

- No eligible horses: "No horses of the right age/breed for this show".
- No prior shows entered: "Enter your first conformation show".

**Error state:** Toast on entry failure; modal stays open with the current horse selected.

**Mobile:** Modal becomes full-screen sheet. Step indicator at top stays.

**Accessibility:**

- Multi-step form: each step has an `aria-current="step"` indicator.
- Result screen: focus moves to the placement headline on submission. Screen readers announce "1st place in Bay Stallion class, overall score 87".

---

## Implementation Roadmap

Each subsection is independently implementable. Recommended order:

1. **14.4 Coat Color Display** — HorseCard chip already partly wired (Equoria-tkyx + 7l75 expose phenotype). Detail tab pending.
2. **14.3 Temperament Badge** — Equoria-tjai tracks HorseCard surface. Use this section as the spec.
3. **14.1 Conformation Display** — Backend conformation API exists (Epic 31B). UI pending.
4. **14.2 Gait Quality Display** — Backend gait scores exist (Epic 31C). UI pending.
5. **14.6 Conformation Show Entry & Results** — Backend complete (Epic 31D). UI pending.
6. **14.5 Breeding Color Prediction** — Backend complete (Epic 31E per PATTERN_LIBRARY.md). UI partial (lethal-white spec lives at frontend/tests/e2e/lethal-white-warning.spec.ts).

Track each UI implementation as a separate bd issue. Reference this section in the AC.

---

## Cross-References

- PRD-04 §1.2 (Temperament categories)
- PRD-03 §3.2 (Breeding mechanics — lethal white)
- `.claude/rules/PATTERN_LIBRARY.md` § Per-Locus Probability (breeding color algorithm)
- Section 09 (Horse Card Design) — base card pattern that 14.3 and 14.4 chips slot into
- Section 11 (Button Feedback Patterns) — used by 14.6 entry flow
- Section 13 (Responsive Accessibility) — base a11y requirements; this section adds system-specific guidance

---

## Open Questions

Filed during Equoria-m4k6:

1. Should the conformation radar (14.1) auto-render the comparison overlay or require a user toggle?
2. For 14.4 coat color, should we show the approximate swatch on every HorseCard, or only on hover? (Current spec: always show.)
3. Should the breeding color prediction (14.5) cache the result client-side, or re-fetch on every visit to the pairing modal?

These are non-blocking. Resolve as part of the individual UI implementation tickets.
