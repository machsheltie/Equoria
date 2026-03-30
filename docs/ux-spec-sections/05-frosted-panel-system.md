# Section 05: Frosted Panel System (Layer 2)

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Layer 2 — Container System
**Source:** UX Spec lines 70-76, 520-525, UI-3 reference

---

## What This Section Covers

Every Card, Dialog, Sheet, and Popover gets the frosted glass treatment. This is what makes content feel like it's floating in the celestial world instead of sitting on a white page.

## FrostedPanel CSS Pattern

```css
.frosted-panel {
  background: var(--glass-bg); /* rgba(15, 23, 42, 0.6) */
  backdrop-filter: blur(var(--glass-blur)); /* 12px */
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border); /* rgba(148, 163, 184, 0.2) */
  border-radius: var(--radius-lg); /* 16px */
  padding: var(--space-5); /* 24px */
  box-shadow: var(--shadow-subtle); /* 0 1px 3px rgba(0,0,0,0.4) */
}

.frosted-panel:hover {
  border-color: var(--glass-hover); /* rgba(148, 163, 184, 0.3) */
  box-shadow: var(--glow-gold); /* 0 0 20px rgba(200,168,78,0.25) */
  transform: translateY(-2px);
}
```

## Where to Apply

### Replace ALL Card usages:

- Horse cards (stable grid)
- Location cards (world hub)
- Competition show cards
- Stat summary panels
- Community feature cards
- Aside panel widgets

### Replace ALL Dialog/Sheet backgrounds:

- BaseModal backdrop and content panel
- WhileYouWereGone overlay
- CinematicMoment (already portaled)
- Confirmation dialogs

### Replace ALL Popover backgrounds:

- Dropdown menus
- Tooltip containers
- Date pickers (if any)

## Existing Component: GlassPanel (UI-3)

**File:** Check `frontend/src/components/ui/` for existing glass panel component

- Has `noBlur` option for performance
- Verify it matches the spec pattern above
- If divergent, update to match

## Card Hover Behavior (from direction-4-hybrid.html)

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

## Performance Note

- Use `backdrop-filter` on panels that overlap content (overlays, modals)
- For cards in a grid, solid semi-transparent bg is fine (no performance issue for a sim game)
- `noBlur` option for any performance-sensitive contexts

## Implementation Checklist

- [ ] Audit existing `glass-panel` / `glass-panel-subtle` / `glass-panel-heavy` CSS classes
- [ ] Update to match spec tokens exactly
- [ ] Apply frosted panel to all Card component usages
- [ ] Apply to Dialog/Modal backgrounds
- [ ] Apply to all dropdown/popover content panels
- [ ] Add hover glow + translateY to interactive cards
- [ ] Verify glass effect visible (not just a dark rectangle)
- [ ] Test on content-heavy pages (no blur performance issues)
