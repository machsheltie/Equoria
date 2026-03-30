# Section 09: Horse Card Design

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Component design (critical visual element)
**Source:** UX Spec focus group requirements, direction-4-hybrid.html, enhancement specs

---

## What This Section Covers

The horse card is the most-seen component in the game. It must be rich, informative, atmospheric, and work equally on mobile and desktop.

## Focus Group Non-Negotiables

1. **Lineage on every card** — "Gen. 2 — Stardust Line" visible without clicking in (Sarah's requirement)
2. **Cooldown timers visible** — Training/breeding cooldowns shown on card (Mike's requirement)
3. **Horse portrait art** — Illustrated portrait (circular, gold-ringed frame). Placeholder silhouette until art assets created
4. **Pagination** — For 20+ horses, 6-12 per page

## Card Layout (from direction-4-hybrid.html)

```
┌─────────────────────────────────────────┐
│  [Portrait]  HORSE NAME (Cinzel)        │
│  (circular,  Breed · Gender · Level     │
│   gold ring) Gen. 2 — Stardust Line     │
│                                          │
│  [Stat mini-bars: Speed|Stam|Agil]      │
│  [Trait chips: Bold, Graceful]          │
│  [Care strip: Fed ✓ | Shod ⚠ | Trained ✓]│
│                                          │
│  "Won 2nd at Dressage Classic" (narrative)│
│  [Cooldown: Training ready in 2d 4h]    │
└─────────────────────────────────────────┘
```

## Card Components Breakdown

### Horse Portrait

- Circular frame with gold ring (`ring-2 ring-[var(--gold-primary)]`)
- Size: 64px on mobile, 80px on desktop
- Placeholder: breed-specific silhouette from `placeholder.svg`
- Future: illustrated portraits by Heirr

### Horse Identity

- **Name**: Cinzel, `--text-h2` (25px), `--text-gold`
- **Breed + Gender + Level**: Inter, `--text-sm`, `--text-secondary`
- **Lineage**: Inter, `--text-xs`, `--text-muted` — "Gen. 2 — Stardust Line"

### Stat Mini-Bars

- Top 3 stats as mini StatBars (from UI-3)
- Height: 6px, width: 60-80px each
- Label + numeric value visible
- Color: `--gradient-stat-bar` (gold gradient)

### Trait Chips

- Small pills showing discovered traits
- Color coded by rarity:
  - Common: `--bg-twilight` border
  - Rare: `--status-rare` tinted
  - Legendary: `--status-legendary` tinted
- Max 3 visible + "+2 more" overflow

### Care Status Strip (already built, UI-6)

- Three indicators: Fed / Shod / Trained
- Color by urgency: green (OK), amber (soon), red (overdue)
- `getCareUrgencyColor()` thresholds: shod/trained 7/14d, fed 1/3d

### Narrative Chip (NarrativeChip component)

- One line of story: "Won 2nd at Dressage Classic", "Training: 2d remaining"
- Inter, `--text-xs`, `--text-secondary`
- Stale (>7 days): fades to `--text-muted`
- New horse: "Just arrived at the stable"

### Cooldown Display

- Training/breeding cooldown inline
- Uses CooldownTimer (compact inline variant)
- Amber when counting down, green when ready

## Card Hover Behavior

```css
.horse-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.horse-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow-gold);
  border-color: var(--glass-hover);
}
```

## Grid/List View Toggle

- **Grid view** (default): visual-first, portrait-dominant cards
- **List view**: sortable table columns: Horse, Level, Top Stat, Traits, Status, Cooldown, Generation
- Toggle control in filter bar above grid

## Implementation Checklist

- [ ] Redesign HorseCard component with spec layout
- [ ] Add circular gold-ringed portrait area
- [ ] Add lineage display ("Gen. X — Line Name")
- [ ] Add stat mini-bars (top 3 stats)
- [ ] Add trait chips with rarity colors
- [ ] Verify care status strip integration
- [ ] Add NarrativeChip component
- [ ] Add inline cooldown timer
- [ ] Add card hover glow + translateY
- [ ] Implement grid/list view toggle
- [ ] Implement pagination (6-12 per page)
- [ ] Test mobile single-column layout
