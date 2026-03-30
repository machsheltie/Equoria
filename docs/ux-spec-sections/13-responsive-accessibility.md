# Section 13: Responsive Design & Accessibility

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Cross-cutting (applies to all sections)
**Source:** UX Spec lines 1932-2120

---

## Responsive Strategy

**Equoria is equally playable on phone AND desktop. Neither is secondary.**

### Breakpoints (Tailwind defaults)

| Breakpoint       | Width   | Layout                                     |
| ---------------- | ------- | ------------------------------------------ |
| Default (mobile) | 0-639px | 1 column, hamburger nav, horizontal scroll |
| `sm`             | 640px   | 2-column card grid begins                  |
| `md`             | 768px   | Tablet — aside as collapsible drawer       |
| `lg`             | 1024px  | Desktop — aside visible, 3-column grid     |
| `xl`             | 1280px  | Wide — 4-column grid, expanded spacing     |

### Component Responsive Behaviors

| Component            | Mobile                   | Tablet              | Desktop                 |
| -------------------- | ------------------------ | ------------------- | ----------------------- |
| NextActionsBar       | Horizontal scroll + snap | Wrapped single row  | Wrapped grid (2-3 rows) |
| Aside panel          | Bottom sheet (swipe up)  | Collapsible drawer  | Always visible (280px)  |
| Horse card grid      | 1 column                 | 2 columns           | 3-4 columns             |
| Competition field    | Compact (top 3 + count)  | Compact             | Expanded (all entries)  |
| CompatibilityPreview | Tabbed (one view)        | Tabbed              | Side-by-side tabs       |
| Breadcrumbs          | "< Back [Parent]"        | Full path           | Full path               |
| GoldTabs             | Horizontal scroll + snap | All visible         | All visible             |
| WhileYouWereGone     | Full-screen overlay      | Centered modal (lg) | Centered modal (lg)     |
| Bottom action bar    | Full-width, scroll       | Full-width          | Fixed at panel bottom   |
| DevelopmentTracker   | Card view (stage focus)  | Timeline + card     | Full timeline           |

### Development Rules

- Mobile-first CSS (default = mobile, add with `sm:`/`md:`/`lg:`/`xl:`)
- `rem` for typography and spacing
- `%` and `vw/vh` for layout containers
- Tailwind responsive prefixes exclusively (no custom `@media` unless necessary)
- Verify 44x44px touch targets

---

## Accessibility (WCAG 2.1 Level AA)

### Color & Contrast (enforced by design tokens)

| Element        | Tokens                                 | Ratio  | Level    |
| -------------- | -------------------------------------- | ------ | -------- |
| Body text      | `--text-primary` on `--bg-night-sky`   | 11.5:1 | AAA      |
| Secondary text | `--text-secondary` on `--bg-night-sky` | 5.2:1  | AA       |
| Gold headings  | `--gold-primary` on `--bg-night-sky`   | 4.2:1  | AA large |
| Gold on panels | `--gold-light` on `--bg-midnight`      | 7.1:1  | AAA      |

### Keyboard Navigation

- All interactive elements reachable via Tab
- Arrow keys within components (tabs, radio, dropdowns)
- Escape closes modals/overlays/dropdowns
- Enter/Space activates buttons and links
- Skip link: "Skip to main content" (visible on focus)
- Focus indicators: Gold outline ring (2px solid `--gold-primary`, 2px offset)

### Screen Reader

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`
- ARIA landmarks on all major regions
- `aria-label` on icon-only buttons
- `aria-live="polite"` for dynamic updates (timers, toasts)
- `aria-live="assertive"` for critical alerts (CinematicMoment, errors)
- `role="progressbar"` with `aria-valuenow/min/max` on all progress bars
- `role="dialog"` + `aria-modal="true"` on modals

### Motor Accessibility

- Touch targets: minimum 44x44px
- Touch spacing: minimum 8px between targets
- No hover-only interactions
- Tooltips: hover + long-press + focus

### Motion

- `prefers-reduced-motion` respected globally
- GallopingLoader → static silhouette + "Loading..."
- FenceJumpBar → static gold dot
- CinematicMoment → static gold-bordered card
- StarfieldBackground → static stars
- Transition durations: 200ms default

### Cognitive

- Progressive disclosure (essential first, expand for details)
- Consistent patterns (same action = same look everywhere)
- Clear error messages (what + how to fix)
- No time pressure on decisions
- "No dead ends" — blocked actions suggest alternatives
- Text targets grade 6-8 reading level

---

## Testing Strategy

### Responsive Testing

- Chrome/Firefox DevTools responsive mode — every component
- Real device testing (iPhone, Android, iPad) — per epic
- Cross-browser (Chrome, Firefox, Safari, Edge) — per epic
- Lighthouse responsive audit (CI/CD)

### Accessibility Testing

- Lighthouse (target ≥ 0.85) — CI/CD
- axe-core in dev mode — during development
- Keyboard-only navigation — per component
- Screen reader (NVDA/VoiceOver) — per epic
- Color contrast validation — token changes only
- Reduced-motion emulation — per animation change
- Playwright E2E a11y — CI/CD

## Implementation Checklist

- [ ] Verify mobile-first CSS approach (default = mobile)
- [ ] Test all components at each breakpoint
- [ ] Verify 44x44px touch targets on mobile
- [ ] Add skip-to-content link
- [ ] Verify gold focus rings on all interactive elements
- [ ] Test keyboard-only navigation through all flows
- [ ] Verify `prefers-reduced-motion` alternatives
- [ ] Run Lighthouse a11y audit (target ≥ 0.85)
- [ ] Verify semantic HTML structure
- [ ] Test with screen reader
