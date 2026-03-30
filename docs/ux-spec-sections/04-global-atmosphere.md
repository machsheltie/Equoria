# Section 04: Global Atmosphere (Layer 1)

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Layer 1 — Global Background
**Source:** UX Spec lines 70-76, 1479-1491

---

## What This Section Covers

Layer 1 transforms every page from "web app" to "game world" with a single CSS change. This is the highest-impact, lowest-effort layer.

## Requirements

### Body Background

- Replace any white/gray body background with deep navy gradient
- `background: var(--gradient-night-sky)` on root/body
- `min-height: 100vh` ensures full coverage
- `background-attachment: fixed` so gradient doesn't scroll

### StarfieldBackground Component

**Already exists:** `frontend/src/components/layout/StarfieldBackground.tsx`

**Spec requirements:**

- CSS-only animated stars (tiny white dots, varying sizes, subtle twinkle)
- Layered radial gradients (`--bg-deep-space` → `--bg-night-sky` → `--bg-midnight`)
- `aria-hidden="true"` — purely decorative
- No JavaScript animation — pure CSS
- `prefers-reduced-motion`: static stars, no twinkle
- Density variants: `sparse` (content-heavy pages) and `dense` (hub, landing, onboarding)

### Global CSS Changes

Apply to `index.css` or root layout:

```css
body {
  background: var(--gradient-night-sky);
  color: var(--text-primary);
  font-family: var(--font-body);
  min-height: 100vh;
}
```

### What "Done" Looks Like

- Every page has the deep navy gradient visible
- StarfieldBackground renders behind content on atmospheric pages
- No white/light backgrounds anywhere in the app
- Text defaults to `--text-primary` (light on dark)

## Implementation Checklist

- [ ] Set body/root background to `--gradient-night-sky`
- [ ] Set default text color to `--text-primary`
- [ ] Set default font to `--font-body` (Inter)
- [ ] Verify StarfieldBackground renders on hub, onboarding, login
- [ ] Add sparse/dense density prop to StarfieldBackground if missing
- [ ] Verify `prefers-reduced-motion` disables animation
- [ ] Check no page has white/light backgrounds remaining
