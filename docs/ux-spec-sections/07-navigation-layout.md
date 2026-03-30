# Section 07: Navigation & Layout

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Structural (requires DOM changes, not just CSS)
**Source:** UX Spec lines 1828-1858, direction-4-hybrid.html

---

## What This Section Covers

Transform the corporate horizontal navbar into the Hybrid direction's compact top bar with hamburger menu, breadcrumbs, and utility icons.

## Target Layout (from direction-4-hybrid.html)

### Compact Top Bar

```
[hamburger] [EQUORIA logo] [breadcrumb: Home > Stable]     [$1,250] [bell] [avatar]
```

**Components:**

- **Hamburger menu** (mobile + desktop) — opens full nav panel
- **Logo** — "EQUORIA" in Cinzel, gold, links to hub
- **Breadcrumb** — shows current location (Hub > Spoke > Detail)
- **Coins pill** — current balance, links to /bank
- **Notification bell** — unread count badge, links to /messages
- **Avatar** — user avatar, links to /settings or profile

### Full Nav Panel (hamburger opens)

- Overlay/sidebar with all navigation links
- Frosted glass background
- Gold icons + Cinzel labels for each section
- Sections: Home, Stable, Training, Competitions, Breeding, World, Community, Messages, Bank, Settings

### Breadcrumb Rules

- Hub: no breadcrumb shown (you're home)
- Spoke pages: "Home > Training"
- Detail pages: "Home > Stable > MoonDancer"
- Mobile: collapsed to "< Back [Parent Page Name]"
- Each crumb is a link

### Aside Panel (Desktop only, 280px)

On hub/stable pages, a right-side panel shows:

- **Stable Summary** — total horses, average level, balance
- **Cooldown Timers** — next available training/breeding
- **Recent Activity** — last 3-5 events (condensed)

Responsive behavior:

- Desktop (1024px+): always visible, 280px width
- Tablet (768-1023px): collapsible drawer (swipe up)
- Mobile (<768px): bottom sheet (swipe up from edge)

## Hub-and-Spoke Navigation Model

- Hub (dashboard) always reachable via logo click
- Spoke pages one level deep from hub
- Detail pages two levels deep
- **Maximum 3 levels.** Deeper flows use modals, not new pages.

### Tab Navigation (within pages)

- GoldTabs with animated gold underline
- Tab state in URL params (`?tab=pedigree`) — shareable, survives refresh
- Mobile: horizontal scroll with snap if >4 tabs
- Keyboard: arrow keys between tabs, Tab into content

### Bottom Action Bar (Horse Detail only)

- Sticky bottom bar: Feed / Train / Breed / Assign / List
- Mobile: full-width, scrollable
- Desktop: fixed at bottom of detail panel
- Actions are SHORTCUTS to full flows, not one-tap executions

## Current State vs Target

| Element     | Current                              | Target                                |
| ----------- | ------------------------------------ | ------------------------------------- |
| Navigation  | Horizontal navbar with 10 text links | Compact top bar + hamburger           |
| Breadcrumbs | None                                 | Full breadcrumb trail                 |
| Coins       | Not in nav                           | Pill in top bar                       |
| Bell        | In nav as link                       | Icon with badge in top bar            |
| Search      | shadcn Input in navbar               | Move to within-page or hamburger menu |
| Aside panel | "Quick Links" with emoji bullets     | Data-rich: summary, timers, activity  |

## Implementation Checklist

- [ ] Redesign MainNavigation.tsx → compact top bar
- [ ] Add hamburger menu with full nav panel
- [ ] Add breadcrumb component
- [ ] Move coins display to top bar pill
- [ ] Move notification bell to top bar icon
- [ ] Add user avatar to top bar
- [ ] Remove horizontal link list
- [ ] Build aside panel component (hub/stable pages)
- [ ] Implement responsive aside behavior (drawer/sheet)
- [ ] Add bottom action bar to horse detail pages
- [ ] Verify hub-and-spoke navigation model works
