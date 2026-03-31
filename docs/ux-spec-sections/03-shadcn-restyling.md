# Section 03: Game Component Library

**Status:** in-progress — see `frontend/src/components/ui/game/`
**Layer:** Layer 4 (Component Polish)
**Source:** UX Spec lines 1438-1458, 539-548
**Course Correction:** 2026-03-31 — shadcn restyling approach ABANDONED. This is a game, not a corporate dashboard. All game-native visual components are built from scratch.

---

## Philosophy

Equoria uses Radix UI for **accessibility primitives only** (keyboard handling, aria attributes, focus management, data-state selectors). Radix provides zero visual styling. All visual identity comes from custom game components.

The shadcn files in `frontend/src/components/ui/` are stripped to naked Radix forwarders. They export the same API (for backward compatibility with existing import sites) but contain no visual className strings.

The game components in `frontend/src/components/ui/game/` provide all visual identity and compose over the naked Radix skeletons where needed.

---

## Component Directory: `frontend/src/components/ui/game/`

### Barrel export: `index.ts`

All 12 components exported from a single barrel:

```typescript
export { FrostedPanel } from './FrostedPanel';
export { GameDialog, GameDialogContent, GameDialogHeader, GameDialogTitle } from './GameDialog';
export { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent } from './GoldTabs';
export { GameBadge } from './GameBadge';
export { GlassInput } from './GlassInput';
export { GlassTextarea } from './GlassTextarea';
export { StatBar } from './StatBar';
export { GameCheckbox } from './GameCheckbox';
export { GameLabel } from './GameLabel';
export { GameTooltip, GameTooltipContent, GameTooltipTrigger } from './GameTooltip';
export { GameScrollArea } from './GameScrollArea';
export { GameCollapsible, GameCollapsibleTrigger, GameCollapsibleContent } from './GameCollapsible';
```

---

## Component Specifications

### 1. FrostedPanel

**File:** `game/FrostedPanel.tsx`
**Replaces visual role of:** `card.tsx`
**Radix dependency:** None (plain div with forwarded ref)

**Visual spec:**

- Background: `bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]` — this IS the blur layer
- Border: `border border-[var(--glass-border)] rounded-[var(--radius-lg)]`
- Hover: `hover:border-[var(--glass-hover)] hover:shadow-[var(--glow-gold)] hover:-translate-y-0.5`
- Padding: `p-[var(--space-5)]` (24px) by default, overridable via `className`
- Title child (if rendered with a heading): Cinzel font, `text-[var(--text-gold)]`

**Props:** `className`, `children`, `as` (default `div`) — no rarity, no variant

**Single-blur-layer note:** FrostedPanel IS the blur layer. Any content inside it uses `.glass-panel-subtle` (solid bg, no blur) if it needs a surface treatment.

---

### 2. GameDialog

**File:** `game/GameDialog.tsx`
**Replaces visual role of:** `dialog.tsx`
**Radix dependency:** `@radix-ui/react-dialog` — composites over the stripped `dialog.tsx` skeleton

**Visual spec:**

- Overlay: `bg-black/85` — dark velvet, no blur on overlay (blur is only on content)
- Content: `.glass-panel-heavy` — higher opacity, `backdrop-blur-[var(--glass-blur-heavy)]`
- Title: Cinzel font, `text-[var(--text-gold)]`, `--text-h2` size
- Description: Inter, `text-[var(--text-secondary)]`
- Entry animation: scale from 0.95 + fade in (CSS `@keyframes`, 200ms, `prefers-reduced-motion` safe)
- Close button: ghost variant of game button (X icon, `--text-muted`, gold on hover)

---

### 3. GoldTabs

**File:** `game/GoldTabs.tsx`
**Replaces visual role of:** `tabs.tsx`
**Radix dependency:** `@radix-ui/react-tabs`

**Visual spec:**

- Tab list: transparent bg, bottom border `1px solid var(--glass-border)`
- Inactive trigger: `text-[var(--text-secondary)]` Inter or Cinzel (configurable via `font` prop)
- Active trigger: `text-[var(--text-gold)]` + gold underline (2px solid `--gold-primary`, animated via CSS transition 200ms ease)
- Hover: `text-[var(--gold-light)]`
- No background highlight on active trigger — underline only

---

### 4. GameBadge

**File:** `game/GameBadge.tsx`
**Replaces visual role of:** `badge.tsx`
**Radix dependency:** None (span)

**Props:** `rarity?: 'common' | 'rare' | 'legendary'`, `className`, `children`

**Visual spec by rarity:**

- `common` (default): `bg-[var(--bg-twilight)] text-[var(--text-primary)] border-[var(--glass-border)]`
- `rare`: `bg-[rgba(167,139,250,0.2)] text-[var(--status-rare)] border-[rgba(167,139,250,0.3)]`
- `legendary`: `bg-[rgba(245,230,163,0.15)] text-[var(--status-legendary)] border-[rgba(245,230,163,0.3)]`
- All: `rounded-full px-2 py-0.5 text-xs font-medium border`

---

### 5. GlassInput

**File:** `game/GlassInput.tsx`
**Replaces visual role of:** `input.tsx`
**Radix dependency:** None (native `<input>` with forwarded ref)

**Visual spec:**

- Background: `bg-[var(--glass-bg)]`
- Border: `border border-[var(--glass-border)] rounded-[var(--radius-md)]`
- Focus: `focus:border-[var(--gold-primary)] focus:ring-1 focus:ring-[var(--gold-primary)] focus:outline-none`
- Text: `text-[var(--text-primary)]`
- Placeholder: `placeholder:text-[var(--text-muted)]`
- Height: `h-10` (input fields are not primary CTAs — 40px acceptable; touch target met by surrounding label+input group)

---

### 6. GlassTextarea

**File:** `game/GlassTextarea.tsx`
**Replaces visual role of:** `textarea.tsx`

**Visual spec:** Identical to GlassInput styling. `resize-y` only. Min height `h-20`.

---

### 7. StatBar

**File:** `game/StatBar.tsx`
**Replaces visual role of:** `progress.tsx`
**Note:** May already exist from Epic 18 with correct styling. Audit first — patch if needed rather than rebuild.

**Visual spec:**

- Track: `bg-[var(--bar-bg)]` (rgba(30,41,59,0.8)), `rounded-full`
- Fill: `bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]`
- At 100%: adds `shadow-[var(--glow-gold)]`
- Heights: `h-2` for stat bars (8px), `h-3` for XP bars (12px) — controlled via `size` prop
- Optional numeric label centered on bar via absolute positioning

---

### 8. GameCheckbox

**File:** `game/GameCheckbox.tsx`
**Replaces visual role of:** `checkbox.tsx`
**Radix dependency:** `@radix-ui/react-checkbox`

**Visual spec:**

- Box: `h-5 w-5 rounded bg-[var(--bg-midnight)] border border-[var(--glass-border)]`
- Checked state: gold SVG checkmark icon as `CheckboxPrimitive.Indicator` child
- Focus ring: `focus-visible:ring-2 focus-visible:ring-[var(--electric-blue-400)]`
- Disabled: opacity-50, cursor-not-allowed

---

### 9. GameLabel

**File:** `game/GameLabel.tsx`
**Replaces visual role of:** `label.tsx`
**Radix dependency:** `@radix-ui/react-label`

**Props:** `smallCaps?: boolean`, `className`, standard label props

**Visual spec:**

- Font: Inter, `text-[var(--text-secondary)]`, `--text-sm` size (14px)
- `smallCaps` prop: adds `font-variant: small-caps`
- No gold color — labels are informational, not decorative

---

### 10. GameTooltip

**File:** `game/GameTooltip.tsx`
**Replaces visual role of:** `tooltip.tsx`
**Radix dependency:** `@radix-ui/react-tooltip` — required for positioning, portal, and accessibility

**Visual spec (content panel):**

- Background: `bg-[var(--bg-midnight)]`
- Border: `border border-[var(--gold-dim)]`
- Text: `text-[var(--text-primary)]` Inter `--text-sm`
- Border radius: `rounded-[var(--radius-md)]`
- Shadow: `shadow-[var(--shadow-raised)]`
- No `backdrop-filter` on tooltip — would violate single-blur-layer rule when shown over FrostedPanel

---

### 11. GameScrollArea

**File:** `game/GameScrollArea.tsx`
**Replaces visual role of:** `scroll-area.tsx`
**Radix dependency:** `@radix-ui/react-scroll-area`

**Visual spec:**

- Scrollbar thumb: `bg-[var(--gold-dim)] rounded-full`
- Thumb hover: `bg-[var(--gold-primary)]`
- Track: `bg-transparent`
- Scrollbar width: 6px
- Fade masks at top/bottom optional via `showFades` prop

---

### 12. GameCollapsible

**File:** `game/GameCollapsible.tsx`
**Replaces visual role of:** `collapsible.tsx`
**Radix dependency:** `@radix-ui/react-collapsible`

**Visual spec:**

- Trigger: chevron-down icon, rotates 180° when `data-state="open"` (CSS `transform: rotate(180deg)`, `transition: 200ms ease`, `prefers-reduced-motion` safe)
- Content area: `.glass-panel-subtle` surface (solid bg, no blur — nested inside FrostedPanel which provides the blur)
- Trigger label: Inter `--text-body`, `--text-primary`

---

## What Happens to the Old shadcn Files

Each of the 12 stripped files is reduced to its Radix primitive skeleton. Retain:

- The named export (same name, backward-compatible import sites)
- The `forwardRef` / `displayName` pattern
- The Radix primitive import and composition
- `data-slot` attributes (for accessibility tooling)

Remove:

- All `cn(...)` calls with visual Tailwind classes
- All `cva` variant definitions (move to game component if needed)
- All default `className` strings with visual meaning

`button.tsx` is NOT stripped — it keeps its full `cva` system and gains `.celestial`-scoped styles.

---

## Implementation Checklist

- [ ] Create `frontend/src/components/ui/game/` directory
- [ ] Create barrel `frontend/src/components/ui/game/index.ts`
- [ ] Sub-PR 1: FrostedPanel, GameDialog, GoldTabs, GameBadge
- [ ] Sub-PR 2: GlassInput, GlassTextarea, StatBar (audit), GameCheckbox
- [ ] Sub-PR 3: GameLabel, GameTooltip, GameScrollArea, GameCollapsible
- [ ] Strip 12 shadcn source files to Radix skeletons (in same PRs, one per game component)
- [ ] Update all import sites in pages/components that used old shadcn components — point to `game/` barrel
- [ ] Run `npm run lint` in `frontend/` — zero errors
- [ ] Run `npm test` — zero regressions in existing component tests
- [ ] WCAG AA audit: axe-core on each game component (contrast ≥ 4.5:1 text, ≥ 3:1 UI)
