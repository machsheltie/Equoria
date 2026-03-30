# Section 01: Design Tokens

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Foundation (needed by all other sections)
**Source:** UX Spec lines 80-155, 755-960

---

## What This Section Covers

All CSS custom properties that define the Celestial Night visual identity. These tokens go in `frontend/src/styles/tokens.css` and are referenced by every component.

---

## Background Layers (Depth through darkness)

| Token             | Value     | Usage                                       |
| ----------------- | --------- | ------------------------------------------- |
| `--bg-deep-space` | `#0a0e1a` | Body background, outermost layer (the void) |
| `--bg-night-sky`  | `#111827` | Page-level containers, primary background   |
| `--bg-midnight`   | `#1a2236` | Card interiors, secondary panels            |
| `--bg-twilight`   | `#243154` | Hover states, active sections               |

## Frosted Glass System

| Token            | Value                      | Usage                        |
| ---------------- | -------------------------- | ---------------------------- |
| `--glass-bg`     | `rgba(15, 23, 42, 0.6)`    | Panel/card backgrounds       |
| `--glass-border` | `rgba(148, 163, 184, 0.2)` | Default panel borders        |
| `--glass-hover`  | `rgba(148, 163, 184, 0.3)` | Hover border state           |
| `--glass-blur`   | `12px`                     | backdrop-filter blur radius  |
| `--glass-glow`   | `rgba(200, 168, 78, 0.15)` | Gold glow on featured panels |

## Gold Accent System

| Token            | Value     | Contrast on #111827     | Usage                                   |
| ---------------- | --------- | ----------------------- | --------------------------------------- |
| `--gold-primary` | `#c8a84e` | 4.2:1 (AA large text)   | Large headers, icons, borders           |
| `--gold-light`   | `#e8d48b` | 7.1:1 (AAA)             | Body text on dark, readable gold        |
| `--gold-dim`     | `#8b7635` | 2.8:1 (decorative only) | Decorative borders, inactive            |
| `--gold-bright`  | `#f5e6a3` | 9.4:1 (AAA)             | High-emphasis labels, active indicators |

## Text Colors

| Token              | Value     | Contrast              | Usage                     |
| ------------------ | --------- | --------------------- | ------------------------- |
| `--text-primary`   | `#e2e8f0` | 11.5:1 (AAA)          | Primary body text         |
| `--text-secondary` | `#94a3b8` | 5.2:1 (AA)            | Secondary/supporting text |
| `--text-muted`     | `#64748b` | 3.1:1 (AA large only) | Timestamps, metadata      |
| `--text-gold`      | `#c8a84e` | 4.2:1 (AA large)      | Gold accent text, headers |

## Semantic Colors (Game States)

| Token                | Value     | Usage                                |
| -------------------- | --------- | ------------------------------------ |
| `--status-success`   | `#22c55e` | Training complete, healthy, eligible |
| `--status-warning`   | `#f59e0b` | Cooldown active, needs attention     |
| `--status-danger`    | `#ef4444` | Injured, ineligible, error           |
| `--status-info`      | `#3b82f6` | Informational, neutral actions       |
| `--status-rare`      | `#a78bfa` | Rare traits, special discoveries     |
| `--status-legendary` | `#f5e6a3` | Ultra-rare, legendary events         |

## Interactive Colors

| Token                  | Value                     | Usage               |
| ---------------------- | ------------------------- | ------------------- |
| `--btn-primary-bg`     | `rgba(59, 130, 246, 0.3)` | Blue frosted button |
| `--btn-primary-border` | `rgba(59, 130, 246, 0.5)` | Blue button border  |
| `--btn-gold-bg`        | `rgba(200, 168, 78, 0.2)` | Gold frosted button |
| `--btn-gold-border`    | `rgba(200, 168, 78, 0.4)` | Gold button border  |

## Gradient Definitions

```css
--gradient-night-sky: linear-gradient(180deg, #0a0e1a 0%, #111827 50%, #1a2236 100%);
--gradient-glass-panel: linear-gradient(
  135deg,
  rgba(15, 23, 42, 0.7) 0%,
  rgba(15, 23, 42, 0.4) 100%
);
--gradient-gold-accent: linear-gradient(90deg, #8b7635 0%, #c8a84e 50%, #8b7635 100%);
--gradient-stat-bar: linear-gradient(90deg, #c8a84e 0%, #e8d48b 100%);
--gradient-celebration: radial-gradient(
  ellipse at center,
  rgba(200, 168, 78, 0.3) 0%,
  transparent 70%
);
```

## Spacing (8px base)

| Token       | Value | Usage                              |
| ----------- | ----- | ---------------------------------- |
| `--space-1` | 4px   | Icon-to-label gap, badge padding   |
| `--space-2` | 8px   | Stat bar margins, list item gap    |
| `--space-3` | 12px  | Input padding, button padding-y    |
| `--space-4` | 16px  | Card padding, section gap          |
| `--space-5` | 24px  | Between card groups, panel padding |
| `--space-6` | 32px  | Between major sections             |
| `--space-7` | 48px  | Page-level section separation      |
| `--space-8` | 64px  | Hero section padding, page margins |

## Border Radius Tokens

| Token           | Value  | Usage                          |
| --------------- | ------ | ------------------------------ |
| `--radius-sm`   | 6px    | Badges, small pills, stat bars |
| `--radius-md`   | 12px   | Buttons, inputs, small cards   |
| `--radius-lg`   | 16px   | Main content panels, modals    |
| `--radius-xl`   | 24px   | Feature cards, hero panels     |
| `--radius-full` | 9999px | Avatars, circular indicators   |

## Elevation & Glow System

| Token                | Value                            | Usage                    |
| -------------------- | -------------------------------- | ------------------------ |
| `--shadow-subtle`    | `0 1px 3px rgba(0,0,0,0.4)`      | Resting cards            |
| `--shadow-raised`    | `0 4px 12px rgba(0,0,0,0.5)`     | Hovered cards, dropdowns |
| `--shadow-floating`  | `0 8px 24px rgba(0,0,0,0.6)`     | Modals, overlays         |
| `--glow-gold`        | `0 0 20px rgba(200,168,78,0.25)` | Featured items, active   |
| `--glow-gold-strong` | `0 0 30px rgba(200,168,78,0.4)`  | Celebrations, rare       |
| `--glow-celestial`   | `0 0 40px rgba(59,130,246,0.2)`  | Info highlights          |

## Implementation Checklist

- [ ] Audit `tokens.css` — add any missing tokens from above
- [ ] Remove any raw hex values from components (use tokens)
- [ ] Verify contrast ratios match the table above
- [ ] Add gradient definitions if missing
- [ ] Add spacing tokens if using magic numbers
- [ ] Add elevation/glow tokens if missing
