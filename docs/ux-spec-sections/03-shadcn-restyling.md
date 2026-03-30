# Section 03: shadcn Component Restyling Guide

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Layer 4 (Component Polish)
**Source:** UX Spec lines 1438-1458, 539-548

---

## Overview

13 shadcn components need 100% visual override. Zero corporate DNA survives. Each component keeps its Radix behavioral skeleton but gets Celestial Night visual identity.

---

## Component-by-Component Restyling

### 1. Button

**File:** `frontend/src/components/ui/button.tsx`
**Usage:** All CTAs, confirms, navigation

**Replace:**

- `bg-primary` → Gold gradient: `from-[var(--gold-primary)] to-[var(--gold-light)]`
- `bg-secondary` → Frosted glass: `bg-[var(--glass-bg)] border-[var(--glass-border)]`
- `hover:` states → Gold glow intensification: `hover:shadow-[var(--glow-gold)]`
- `focus-visible:ring-*` → `focus-visible:ring-[var(--gold-bright)] ring-2 ring-offset-2 ring-offset-[var(--bg-deep-space)]`
- Font: Primary buttons use Cinzel, secondary use Inter
- Horseshoe border arcs on primary: `.btn-cobalt::before/::after` (already in index.css from Epic 18-5)

**Variants needed:**

- `gold` (primary action) — gold gradient bg, dark text
- `glass` (secondary) — frosted glass, gold text
- `ghost` (tertiary) — transparent, gold text, underline on hover
- `destructive` — red-tinted glass, white text

### 2. Dialog/Modal

**File:** `frontend/src/components/ui/dialog.tsx`
**Usage:** BaseModal, cinematic overlays

**Replace:**

- `bg-background` → `bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]`
- `border` → `border-[var(--glass-border)]`
- Title → Cinzel font, `text-[var(--text-gold)]`
- Overlay → `bg-black/60 backdrop-blur-sm`
- `rounded-lg` → `rounded-[var(--radius-lg)]`
- Shadow → `shadow-[var(--shadow-floating)]`

### 3. Tabs

**File:** `frontend/src/components/ui/tabs.tsx`
**Usage:** Horse detail, competitions, community

**Replace:**

- Tab list bg → transparent
- Inactive tab → `text-[var(--text-secondary)]`
- Active tab → `text-[var(--text-gold)]` + animated gold underline (2px, transition 200ms)
- Hover → `text-[var(--gold-light)]`
- Font: Cinzel for tab labels
- No background highlight on active — underline only (GoldTabs pattern)

### 4. Progress

**File:** `frontend/src/components/ui/progress.tsx`
**Usage:** XP bars, stat bars, cooldown timers

**Replace:**

- Track → `bg-[var(--bar-bg)]` (rgba(30, 41, 59, 0.8))
- Fill → `bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]` (or `--gradient-stat-bar`)
- `rounded-full` stays
- Add numeric overlay: stat value text centered on bar
- Height: stat bars 8px, XP bars 12px

### 5. Input

**File:** `frontend/src/components/ui/input.tsx`
**Usage:** Search, forms, naming

**Replace:**

- `bg-background` → `bg-[var(--glass-bg)]`
- `border-input` → `border-[var(--glass-border)]`
- Focus → `border-[var(--gold-primary)] ring-1 ring-[var(--gold-primary)]`
- Text → `text-[var(--text-primary)]`
- Placeholder → `text-[var(--text-muted)]`
- `rounded-md` → `rounded-[var(--radius-md)]`

### 6. Select/Dropdown

**File:** `frontend/src/components/ui/select.tsx` (if exists)
**Usage:** Discipline picker, breed picker, filters

**Replace:**

- Trigger → same as Input styling
- Content → `bg-[var(--bg-midnight)] border-[var(--glass-border)] backdrop-blur-xl`
- Item hover → `bg-[var(--bg-twilight)]`
- Item selected → `text-[var(--gold-primary)]`
- Check icon → gold colored

### 7. Card

**File:** `frontend/src/components/ui/card.tsx`
**Usage:** Horse cards, location cards, show cards

**Replace entire component with FrostedPanel pattern:**

- `bg-card` → `bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]`
- `border` → `border-[var(--glass-border)]`
- Hover → `border-[var(--glass-hover)] shadow-[var(--glow-gold)] translateY(-2px)`
- `rounded-lg` → `rounded-[var(--radius-lg)]`
- Padding → `p-[var(--space-5)]` (24px)
- Card title → Cinzel, `text-[var(--text-gold)]`

### 8. Tooltip

**File:** `frontend/src/components/ui/tooltip.tsx`
**Usage:** Stat explanations, discipline descriptions, trait details

**Replace:**

- `bg-primary text-primary-foreground` → `bg-[var(--bg-midnight)] text-[var(--text-primary)] border border-[var(--gold-dim)]`
- `rounded-md` → `rounded-[var(--radius-md)]`
- Shadow → `shadow-[var(--shadow-raised)]`

### 9. Badge

**File:** `frontend/src/components/ui/badge.tsx`
**Usage:** Trait badges, status indicators, personality labels

**Replace:**

- Default → `bg-[var(--bg-twilight)] text-[var(--text-primary)] border-[var(--glass-border)]`
- Variants by rarity:
  - Common: `bg-[var(--bg-twilight)]`
  - Rare: `bg-[rgba(167,139,250,0.2)] text-[var(--status-rare)] border-[rgba(167,139,250,0.3)]`
  - Legendary: `bg-[rgba(245,230,163,0.15)] text-[var(--status-legendary)] border-[rgba(245,230,163,0.3)]`
- `rounded-full` for pills

### 10. Skeleton

**File:** Already built as SkeletonCard (UI-5)
**Status:** Done — verify uses Celestial Night colors

### 11. Toast

**File:** Toast/Sonner config
**Usage:** Notifications, XP gains, action confirmations

**Replace:**

- Background → `bg-[var(--glass-bg)] backdrop-blur-xl`
- Border → `border-[var(--glass-border)]`
- Text → `text-[var(--text-primary)]`
- Success icon → gold colored
- Gold accent strip on left edge

### 12. ScrollArea

**File:** `frontend/src/components/ui/scroll-area.tsx`
**Usage:** Horse lists, competition fields, messages

**Replace:**

- Scrollbar thumb → `bg-[var(--gold-dim)]`
- Scrollbar track → `bg-transparent`
- Thumb hover → `bg-[var(--gold-primary)]`

### 13. Avatar

**Usage:** User profile, horse portraits

**Replace:**

- Border → `ring-2 ring-[var(--gold-primary)]`
- Fallback bg → `bg-[var(--bg-midnight)]`
- Fallback text → `text-[var(--gold-primary)]`
- Shape → `rounded-full`

## Implementation Checklist

- [ ] Button: gold/glass/ghost/destructive variants
- [ ] Dialog: frosted glass overlay
- [ ] Tabs: gold underline animation
- [ ] Progress: gradient fill + numeric overlay
- [ ] Input: glass bg + gold focus ring
- [ ] Select: dark glass dropdown
- [ ] Card: FrostedPanel pattern
- [ ] Tooltip: dark bg + gold border
- [ ] Badge: rarity color variants
- [ ] Skeleton: verify celestial colors
- [ ] Toast: frosted glass + gold accent
- [ ] ScrollArea: gold scrollbar
- [ ] Avatar: gold ring border
