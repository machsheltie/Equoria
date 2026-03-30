# Section 08: Hub Dashboard

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Page restructure (requires DOM + new components)
**Source:** UX Spec lines 563-754, direction-4-hybrid.html

---

## What This Section Covers

The hub dashboard (Index page, `/`) is the center of the hub-and-spoke constellation. It must answer: "What can I do right now?"

## Hub Layout (from direction-4-hybrid.html)

```
[Compact Top Bar — Section 07]

[Page Header: "My Stable" in Cinzel display size]

[NextActionsBar — 3-5 narrative suggestion chips]

[Horse Card Grid — 2-3 columns with rich horse cards]

[Aside Panel (desktop) — Stable Summary / Cooldown Timers / Recent Activity]
```

## NextActionsBar Component

**Purpose:** Primary driver of the daily loop. Surfaces 3-5 most relevant suggestions with narrative flavor text.

**Content examples:**

- "Luna is eager to train after resting for 3 days"
- "3 Dressage shows close tomorrow"
- "Stardust x Luna — 87% compatibility match"

**Behavior:**

- Tap/click any chip → navigate to relevant page with context pre-loaded
- Category tags ensure never 3 of same category consecutively
- Day-1 mode: discovery-oriented suggestions for accounts < 24h old
- Should never be empty (always at least 3 suggestions)

**Responsive:**

- Mobile: horizontal scroll with snap
- Desktop: wrapped grid (2-3 rows max)

**Accessibility:** `role="navigation"`, `aria-label="Suggested next actions"`, each chip focusable link

## WhileYouWereGone Overlay

**Trigger:** First login after 4+ hours of inactivity

**Content (max 8 items):**

1. Exciting news (wins, milestones, rank changes)
2. Actionable items (cooldowns expired, new shows)
3. Background updates (community stats, groom events)
4. ONE surprising flavor element per summary

**Behavior:**

- Overlay appears BEFORE hub loads
- Dismiss: tap outside, "Go to Stable" button, or Escape
- Each item tappable → navigates to relevant page
- "View all updates" link if >8 items
- Does NOT trigger on first-ever login
- Does NOT trigger if away < 4 hours

**Visual:** Full-viewport frosted glass panel over starfield, gold header "While You Were Gone..."

## Horse Card Grid

See **Section 09** for detailed horse card design.

Grid layout:

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3-4 columns
- 16px gap between cards
- Pagination for 20+ horses (6-12 per page)

## Aside Panel Content (Desktop)

### Stable Summary Widget

- Total horses count
- Average horse level
- Current balance (linked to /bank)
- Active competitions count

### Cooldown Timers Widget

- Next training available: horse name + countdown
- Next breeding available: horse name + countdown
- Uses CooldownTimer component (Section 10)

### Recent Activity Widget

- Last 3-5 events (training, competitions, breeding)
- Each event: icon + horse name + description + timestamp
- "View all" link to activity page

## Current State vs Target

| Element       | Current (Index.tsx)                    | Target                                       |
| ------------- | -------------------------------------- | -------------------------------------------- |
| Header        | "Welcome" with Star icon               | "My Stable" in Cinzel display                |
| Next Actions  | None                                   | NextActionsBar with narrative chips          |
| Horse display | Flat mini-cards with Star placeholders | Rich horse cards with stats/traits/care      |
| Sidebar       | "Quick Links" with emoji bullets       | Data-rich widgets: summary, timers, activity |
| WYAG          | None                                   | Frosted glass overlay on return              |
| Grid          | Basic card grid                        | Responsive with pagination                   |

## Implementation Checklist

- [ ] Build NextActionsBar component
- [ ] Build WhileYouWereGone overlay component
- [ ] Redesign Index.tsx layout to match hybrid mockup
- [ ] Replace "Quick Links" sidebar with aside panel widgets
- [ ] Add Stable Summary widget
- [ ] Add Cooldown Timers widget
- [ ] Add Recent Activity widget
- [ ] Implement horse card grid with pagination
- [ ] Add "My Stable" Cinzel display header
- [ ] Connect NextActionsBar to real data endpoints
- [ ] Connect WYAG to events-since-last-login endpoint
