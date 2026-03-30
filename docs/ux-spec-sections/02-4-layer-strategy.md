# Section 02: 4-Layer Transformation Strategy

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Architecture (defines implementation order)
**Source:** UX Spec lines 496-562

---

## Design System Choice

**Option 2: Theme shadcn/Radix Primitives + Custom Celestial Night Overlay — Total Visual Replacement**

Keep shadcn/Radix as the behavioral skeleton (focus traps, keyboard navigation, screen reader announcements, portals, animation coordination) but replace **100% of the visual layer** with Celestial Night.

**Non-Negotiable Rule:** Every shadcn default style gets replaced. Zero corporate DNA survives. If a component still has white backgrounds, gray borders, or rounded-md corners after the redesign, it's not done.

## Why Keep shadcn/Radix

1. **Accessibility for free** — Radix handles WCAG-compliant focus management, keyboard nav, ARIA attributes
2. **Total visual control** — Components are headless; every pixel comes from our CSS
3. **Proof by example** — The login page already uses shadcn and looks fully celestial
4. **Development speed** — 18 epics already built on shadcn; ripping out = weeks of rewrites
5. **Game aesthetic guarantee** — The "corporate" look comes exclusively from shadcn DEFAULT classes which we replace

## 4-Layer Transformation

| Layer                          | Scope                                   | What Changes                                           | Risk                      |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------ | ------------------------- |
| **Layer 1: Global Background** | `<body>`, layout wrappers               | Deep navy gradient + starfield particles               | Low — CSS only            |
| **Layer 2: FrostedPanel**      | Every Card, Dialog, Sheet, Popover      | `backdrop-filter: blur(12px)` + glass border + glow    | Medium — many components  |
| **Layer 3: Typography**        | All headings, labels, body text         | Cinzel for headings, Inter for body, gold/slate colors | Low — font + color tokens |
| **Layer 4: Component Polish**  | Buttons, Inputs, Tabs, StatBars, Badges | Gold borders, celestial hover states, game-specific    | Medium — per-component    |

**Deployment:** Each layer independently deployable. Layer 1 alone transforms feel.

## What We Keep (Invisible Behavioral Layer)

- Radix Dialog: focus trap, Escape to close, portal, scroll lock
- Radix Tabs: keyboard arrows, ARIA tab/tabpanel roles
- Radix Select: typeahead, keyboard selection, ARIA listbox
- Radix Tooltip: hover timing, positioning, screen reader
- Radix DropdownMenu: keyboard nav, sub-menus, outside click dismiss

## What We Replace (100% Visual Layer)

- Every `bg-white` → `bg-[var(--bg-deep-space)]` or `bg-[var(--glass-bg)]`
- Every `border-gray-*` → `border-[var(--glass-border)]` or `border-[var(--gold-dim)]`
- Every `rounded-md` → `rounded-xl` or custom radius tokens
- Every `text-gray-*` → `text-[var(--text-primary)]` or `text-[var(--text-gold)]`
- Every `shadow-sm` → `shadow-[0_0_20px_var(--gold-dim)]` celestial glow
- Every `ring-*` focus ring → gold celestial focus ring
- Every hover state → celestial glow intensification

## 8 Core Game Components (Built on Radix where applicable)

1. `FrostedPanel` — Glass card replacing every Card
2. `CelestialButton` — Gold-bordered, glow-on-hover, horseshoe accents
3. `GlassInput` — Frosted input with gold focus ring
4. `GoldTabs` — Underline tabs with gold active indicator
5. `StatBar` — Gradient fill bars for horse stats
6. `SlotGrid` — Stable slot layout for horse management
7. `StarfieldBackground` — Animated particle canvas (prefers-reduced-motion safe)
8. `CrescentDecoration` — Crescent moon accent for section headers

## Implementation Checklist

- [ ] Layer 1: Apply global background gradient + StarfieldBackground
- [ ] Layer 2: Replace all Card usages with FrostedPanel styling
- [ ] Layer 3: Apply Cinzel/Inter fonts, gold/slate color scheme
- [ ] Layer 4: Restyle each shadcn component per Section 03
