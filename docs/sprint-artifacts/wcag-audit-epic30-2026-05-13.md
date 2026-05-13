# WCAG 2.1 AA Accessibility Audit — Epic 30 Post-Implementation

**Date:** 2026-05-13  
**Issue:** Equoria-o5r9  
**Scope:** Frontend components introduced in Epics 22–30

---

## Audit Method

Static code analysis across `frontend/src/` using targeted grep patterns for:

- Icon-only buttons missing `aria-label` (WCAG 4.1.2 Name, Role, Value)
- `<img>` elements missing `alt` attribute (WCAG 1.1.1 Non-text Content)
- Interactive elements not reachable by keyboard / not in focus order (WCAG 2.1.1)
- Focus indicators absent or suppressed by `outline-none` without `focus-visible` replacement (WCAG 2.4.7 Focus Visible)
- Form inputs not associated with labels (WCAG 1.3.1 Info and Relationships)
- Live regions missing `aria-live` for dynamic content (WCAG 4.1.3 Status Messages)

---

## Pre-existing Compliant Patterns (No Action Required)

| Component                                  | Criterion                         | Evidence                                                                        |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------- |
| `DashboardLayout.tsx` skip-to-content link | 2.4.1 Bypass Blocks               | `<a href="#main-content" className="sr-only focus:not-sr-only ...">` at line 86 |
| `CooldownTimer.tsx`                        | 4.1.3 Status Messages             | `role="timer"` + `aria-live={isReady ? 'assertive' : 'polite'}`                 |
| `GoldTabs.tsx` (Radix UI)                  | 4.1.2 Name, Role, Value           | Radix `TabsList/TabsTrigger` provides full ARIA semantics                       |
| `GameDialog` (Radix UI)                    | 2.1.1 Keyboard                    | Radix Dialog provides focus trap, Escape key, ARIA                              |
| `index.css` / `tokens.css`                 | 2.3.3 Animation from Interactions | `prefers-reduced-motion` media query at lines 475, 545 / token line 429         |

---

## Violations Found and Remediated

### Finding 1 — HorseMarketplacePage: Icon-only close button lacks accessible name

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`  
**Criterion:** WCAG 4.1.2 Name, Role, Value (Level A)  
**Severity:** High — screen readers announce "button" with no name  
**Fix:** Added `aria-label="Close"` to the `<button>` wrapping the `X` icon.

---

### Finding 2 — HorseMarketplacePage: Search text input lacks accessible name

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`  
**Criterion:** WCAG 1.3.1 Info and Relationships (Level A), WCAG 2.4.7 Focus Visible (Level AA)  
**Severity:** High — unlabeled input; placeholder is not a substitute for label  
**Fix:** Added `aria-label="Filter by breed"` to the input. Added `focus:border-white/50 focus:ring-1 focus:ring-white/20` focus indicator.

---

### Finding 3 — HorseMarketplacePage: Sort select lacks accessible name and focus indicator

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`  
**Criterion:** WCAG 1.3.1 Info and Relationships (Level A), WCAG 2.4.7 Focus Visible (Level AA)  
**Severity:** High — unlabeled select element  
**Fix:** Added `aria-label="Sort listings"` + `focus:ring-1 focus:ring-white/40` focus indicator.

---

### Finding 4 — HorseMarketplacePage: Advanced filters icon button lacks accessible name

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`  
**Criterion:** WCAG 4.1.2 Name, Role, Value (Level A)  
**Severity:** High — `title` attribute is not an accessible name for interactive elements  
**Fix:** Changed `title="Advanced filters"` to `aria-label="Advanced filters"`.

---

### Finding 5 — HorseMarketplacePage: Advanced filter number inputs lack label association

**File:** `frontend/src/pages/HorseMarketplacePage.tsx`  
**Criterion:** WCAG 1.3.1 Info and Relationships (Level A), WCAG 2.4.7 Focus Visible (Level AA)  
**Severity:** High — number inputs have visual text labels but no programmatic association  
**Fix:** Added `htmlFor={`filter-${key}`}` to `<label>` elements and `id={`filter-${key}`}` + `focus:ring-1 focus:ring-white/40` to each `<input>`.

---

### Finding 6 — FantasyModal: Icon-only close button lacks accessible name

**File:** `frontend/src/components/FantasyModal.tsx`  
**Criterion:** WCAG 4.1.2 Name, Role, Value (Level A)  
**Severity:** High — screen readers announce "button" with no name  
**Fix:** Added `aria-label="Close dialog"` to the `<button>` wrapping the `X` icon.

---

### Finding 7 — EnhancedReportingInterface: Remove-section button lacks accessible name and type

**File:** `frontend/src/components/EnhancedReportingInterface.tsx`  
**Criterion:** WCAG 4.1.2 Name, Role, Value (Level A)  
**Severity:** High — icon-only `×` button has no aria-label; also missing `type="button"` (implicit form submit risk)  
**Fix:** Added `type="button"` and `aria-label={`Remove ${metric?.label || sectionId}`}`.

---

## Summary

| Finding                            | File                       | Criterion    | Severity | Status   |
| ---------------------------------- | -------------------------- | ------------ | -------- | -------- |
| 1 — close button no name           | HorseMarketplacePage       | 4.1.2        | High     | ✅ Fixed |
| 2 — search input no label          | HorseMarketplacePage       | 1.3.1, 2.4.7 | High     | ✅ Fixed |
| 3 — sort select no label           | HorseMarketplacePage       | 1.3.1, 2.4.7 | High     | ✅ Fixed |
| 4 — filter button title→aria-label | HorseMarketplacePage       | 4.1.2        | High     | ✅ Fixed |
| 5 — number inputs not labelled     | HorseMarketplacePage       | 1.3.1, 2.4.7 | High     | ✅ Fixed |
| 6 — FantasyModal close no name     | FantasyModal               | 4.1.2        | High     | ✅ Fixed |
| 7 — remove button no name          | EnhancedReportingInterface | 4.1.2        | High     | ✅ Fixed |

**Total violations found:** 7  
**Total violations remediated:** 7  
**Remaining issues:** 0

---

## What Was NOT Done

- **eslint-plugin-jsx-a11y** is installed but not enabled in `eslint.config.js`. Per CLAUDE.md: "Do not change eslint settings without permission." Enabling this plugin would catch future violations automatically. Filed as a separate follow-up.
- **Automated WCAG scan (axe-core / Playwright accessibility checks)** not added to CI. Manual static analysis only. A full automated audit would require running the app with a browser and axe. This is a recommended future step.
- **Color contrast ratio** was not computed instrumentally (requires browser rendering). Visual inspection of the Celestial Night theme's text-on-background ratios suggests compliance with the dark-blue-on-black palette, but a full contrast audit with a tool like Colour Contrast Analyser is recommended before final beta sign-off.
- **Adjacent components in Epic 22–30 not reachable by grep** (dynamic JSX patterns, server components): no violations found by pattern search, but cannot certify 100% coverage without browser-based axe scan.

---

## Reproduction

```bash
# TypeScript check (clean = no regressions)
cd frontend && npx tsc --noEmit

# Manual browser check: launch dev server, navigate to /marketplace
# Use tab-key navigation to verify all interactive elements are reachable
# Use a screen reader (NVDA/VoiceOver) to verify button/input names are announced
npm run dev
```

---

## Files Modified

| File                                                     | Changes                |
| -------------------------------------------------------- | ---------------------- |
| `frontend/src/pages/HorseMarketplacePage.tsx`            | 6 fixes (Findings 1–5) |
| `frontend/src/components/FantasyModal.tsx`               | 1 fix (Finding 6)      |
| `frontend/src/components/EnhancedReportingInterface.tsx` | 1 fix (Finding 7)      |
