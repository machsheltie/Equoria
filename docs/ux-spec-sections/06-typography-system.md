# Section 06: Typography System (Layer 3)

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Layer 3 — Typography
**Source:** UX Spec lines 827-859

---

## Font Stack

| Role        | Font           | Fallbacks                            | Weights |
| ----------- | -------------- | ------------------------------------ | ------- |
| **Display** | Cinzel         | Cormorant Garamond, Georgia, serif   | 400-700 |
| **Body**    | Inter          | system-ui, -apple-system, sans-serif | 300-700 |
| **Mono**    | JetBrains Mono | Fira Code, Consolas, monospace       | 400-500 |

**Loading:** Self-hosted via `@font-face` in `/frontend/public/fonts/`. No Google Fonts CDN. `font-display: swap`.

## Type Scale (8px base, 1.25 ratio)

| Token            | Size            | Line Height | Weight | Font   | Usage                                     |
| ---------------- | --------------- | ----------- | ------ | ------ | ----------------------------------------- |
| `--text-display` | 2.441rem (39px) | 1.1         | 700    | Cinzel | Page titles ("My Stable", "Competitions") |
| `--text-h1`      | 1.953rem (31px) | 1.2         | 600    | Cinzel | Section headers                           |
| `--text-h2`      | 1.563rem (25px) | 1.3         | 600    | Cinzel | Card titles, horse names                  |
| `--text-h3`      | 1.25rem (20px)  | 1.4         | 500    | Cinzel | Sub-section headers, tab labels           |
| `--text-body`    | 1rem (16px)     | 1.6         | 400    | Inter  | Body text, descriptions                   |
| `--text-sm`      | 0.875rem (14px) | 1.5         | 400    | Inter  | Secondary text, metadata                  |
| `--text-xs`      | 0.75rem (12px)  | 1.4         | 400    | Inter  | Timestamps, badges, stat labels           |
| `--text-stat`    | 1.125rem (18px) | 1.2         | 600    | Inter  | Stat values, numbers, levels              |

## Typography Rules (Non-Negotiable)

1. **Cinzel is for names and places** — Horse names, page titles, section headers, primary CTA labels. Anything from the celestial world.
2. **Inter is for information** — Stat values, descriptions, timestamps, form labels, body text. Quick, accurate reading.
3. **Gold text (`--text-gold`) only on Cinzel** — Gold body text at small sizes fails contrast. Gold reserved for display/heading sizes where `--gold-primary` passes AA large text.
4. **Body text is always `--text-primary`** — No exceptions. Slate-white on dark navy, 11.5:1 contrast.
5. **Numbers use Inter at `--text-stat` weight 600** — Stats, levels, cooldown timers, prices. Tabular numerals for column alignment.

## What Needs to Change

### Page Titles (h1)

- Font: Cinzel, `--text-display` (39px), weight 700
- Color: `--text-gold` (#c8a84e)
- Letter-spacing: `0.05em` if uppercase, normal if mixed case
- Current state: Using Cinzel but at smaller sizes than spec

### Section Headers (h2)

- Font: Cinzel, `--text-h1` (31px), weight 600
- Color: `--text-gold` or `--text-primary`

### Card Titles / Horse Names (h3)

- Font: Cinzel, `--text-h2` (25px), weight 600
- Color: `--text-gold`

### Body Text

- Font: Inter, `--text-body` (16px), weight 400
- Color: `--text-primary` (#e2e8f0)

### Labels / Captions

- Font: Inter, `--text-sm` (14px) or `--text-xs` (12px)
- Color: `--text-secondary` (#94a3b8)

### Stat Numbers

- Font: Inter, `--text-stat` (18px), weight 600
- Color: `--text-primary`
- `font-variant-numeric: tabular-nums` for column alignment

## Implementation Checklist

- [ ] Self-host Cinzel fonts (subset Latin, ~25KB) in `public/fonts/`
- [ ] Add `@font-face` declarations with `font-display: swap`
- [ ] Preload Cinzel in `<head>` tag
- [ ] Add type scale tokens to `tokens.css`
- [ ] Apply Cinzel to all h1/h2/h3 and page titles
- [ ] Apply Inter to all body text, labels, stats
- [ ] Set page title sizes to spec (39px, not current smaller sizes)
- [ ] Apply gold color to Cinzel headers only
- [ ] Verify body text uses `--text-primary` everywhere
- [ ] Add `font-variant-numeric: tabular-nums` to stat displays
