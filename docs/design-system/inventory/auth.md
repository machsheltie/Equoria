# Design-System Inventory — Auth Family

The auth family comprises six routed pages (LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, OnboardingPage) plus four shared foundation files in `frontend/src/components/auth/` (AuthLayout, PasswordStrength, ProtectedRoute, OnboardingGuard). The family has a clear Celestial Night visual identity — full-bleed atmospheric background via `PageBackground`/`usePageBackground`, glassmorphism `glass-panel` cards, `celestial-input` form controls, and shared `Button` for CTAs — but **no page uses the `AuthLayout` wrapper** that was purpose-built for this family; it sits unused. There is also a systematic split between pages that hardcode `© 2025` in a bespoke footer and the `AuthLayout.AuthFooter` which uses `new Date().getFullYear()` correctly. Raw `rgb()`/`rgba()` colour literals appear heavily in ForgotPasswordPage, ResetPasswordPage, and VerifyEmailPage, diverging from the CSS-variable conventions used by LoginPage and RegisterPage. OnboardingPage is visually distinct: it uses `glass-panel-heavy`, the `'default'` background scene instead of `'auth'`, no bespoke h1 Equoria wordmark, and no footer at all.

---

## Summary Table

| File                   | Uses AuthLayout? | Header type             | Container max-w | Own footer?             | Copyright | Hardcoded rgb/rgba count | Raw `<button>` count |
| ---------------------- | ---------------- | ----------------------- | --------------- | ----------------------- | --------- | ------------------------ | -------------------- |
| LoginPage.tsx          | No               | Bespoke h1 "Equoria"    | `max-w-sm`      | No — "Version 1.0" line | —         | 0                        | 1 (password toggle)  |
| RegisterPage.tsx       | No               | Bespoke h1 "Equoria"    | `max-w-sm`      | No                      | —         | 0                        | 2 (password toggles) |
| ForgotPasswordPage.tsx | No               | Bespoke Link "Equoria"  | `max-w-sm`      | Yes — hardcoded 2025    | `© 2025`  | ~8                       | 0                    |
| ResetPasswordPage.tsx  | No               | Bespoke Link "Equoria"  | `max-w-sm`      | Yes — hardcoded 2025    | `© 2025`  | ~10                      | 2 (password toggles) |
| VerifyEmailPage.tsx    | No               | Bespoke Link "Equoria"  | `max-w-sm`      | Yes — hardcoded 2025    | `© 2025`  | ~7                       | 0                    |
| OnboardingPage.tsx     | No               | Bespoke h1 in card      | `max-w-md`      | No                      | —         | ~10                      | 0                    |
| AuthLayout.tsx         | (is the layout)  | `AuthHeader` h1 Equoria | `max-w-md`      | Dynamic `getFullYear()` | Dynamic   | ~2                       | 0                    |
| PasswordStrength.tsx   | No               | —                       | —               | —                       | —         | ~2                       | 0                    |

---

## LoginPage.tsx

**Path:** `frontend/src/pages/LoginPage.tsx`

### 1. Header

Bespoke, not PageHero. Line 72–74: `<div className="text-center select-none"><h1 className="fantasy-title text-5xl tracking-widest">Equoria</h1></div>`. No `AuthLayout` usage.

### 2. Container

`max-w-sm` (line 69). Wrapped with `w-full px-4`.

### 3. Outer padding

`px-4` on the content wrapper (line 69). The root div has no additional horizontal padding; `px-4` is the card gutter, not a duplicate of shell gutters (page is outside DashboardLayout).

### 4. Background

`usePageBackground({ scene: 'auth' })` applied via `style={bgStyle}` on root div (lines 60, 63–66). `<PageBackground scene="auth" />` rendered as the layered fixed overlay (line 67). Correct dual-pattern usage.

### 5. Surfaces

Single `glass-panel` card (line 76): `className="glass-panel w-full px-6 py-7 space-y-4"`. No nested panels. No `backdrop-blur` usage (glass-panel class likely carries blur in CSS; none applied directly).

### 6. Radii

No `rounded-*` utilities visible on card — card relies on glass-panel CSS class definition. Password toggle icon area has no explicit rounding.

### 7. Buttons

- **Shared `Button` component:** used at lines 167 (`type="submit"`) and 173 (`asChild` wrapping a `<Link>`).
- **Raw `<button>`:** 1 instance (line 143) — password visibility toggle, using raw Tailwind classes `absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--icon-accent)] hover:text-white transition-colors`. Not a command button.
- **Duplicate primary actions:** Two `Button` components with no `variant` prop (both default/primary): "Enter" (submit, line 167) and "Create an Account" (line 173). Both render as the same gold primary style on a single card — a dual-CTA violation.

### 8. Tabs

None.

### 9. Forms

All inputs use `className="celestial-input"` (lines 113, 140). Inline `style={{ paddingLeft: '2.5rem' }}` on each input overrides padding directly rather than using a utility class.

### 10. Dialogs/modals

None.

### 11. Async states

- Loading: `{isPending ? 'Entering…' : 'Enter'}` text swap in Button (line 168). No spinner.
- Error: Bare `<p className="text-red-400 text-sm text-center">` (line 89) — raw paragraph, not `AuthError` component.
- Empty: N/A.

### 12. Direct colours

Raw Tailwind palette: `text-red-400` (lines 89, 118, 153). `text-white` appears on toggle hover via `hover:text-white`. No raw `rgb()` or `rgba()` literals; design tokens used elsewhere (`var(--icon-accent)`, `var(--text-secondary)`, `var(--gold-500)`). Approximate direct palette count: **3**.

### 13. Mobile fixed elements

None.

---

## RegisterPage.tsx

**Path:** `frontend/src/pages/RegisterPage.tsx`

### 1. Header

Bespoke h1 (line 131–133): `<h1 className="fantasy-title text-5xl tracking-widest">Equoria</h1>`. Structurally identical to LoginPage header. No `AuthLayout` usage.

### 2. Container

`max-w-sm` (line 129). `w-full px-4`.

### 3. Outer padding

`py-8` on the root min-h-screen div (line 124). `px-4` on the content wrapper (line 129). No DashboardLayout gutters to conflict with.

### 4. Background

`usePageBackground({ scene: 'auth' })` + `<PageBackground scene="auth" />` — identical pattern to LoginPage (lines 121, 123–127).

### 5. Surfaces

Single `glass-panel` card (line 136): `className="glass-panel w-full px-6 py-6 space-y-4"`. No nested panels. No backdrop-blur.

### 6. Radii

`rounded-full` on password strength bar (lines 321, 325). Inline `style={{ borderRadius: '0.5rem' }}` on firstName, lastName, dateOfBirth inputs (lines 173, 195, 248) — bypasses Tailwind utilities for the same visual outcome as `rounded-lg`.

### 7. Buttons

- **Shared `Button`:** 1 instance — submit "Begin Your Journey" (line 393).
- **Raw `<button>`:** 2 instances — password visibility toggles at lines 303 and 374. Both use raw class strings `absolute right-3.5 ... text-[var(--icon-accent)] hover:text-white`.
- **Duplicate primary actions:** Only one primary Button; no duplication on this page.

### 8. Tabs

None.

### 9. Forms

All inputs use `className="celestial-input"`. Some additionally receive inline `style={{ paddingLeft }}` or `style={{ borderRadius }}`. The inline `borderRadius: '0.5rem'` (lines 173, 195, 248) is inconsistent with inputs that don't set it (email, password).

### 10. Dialogs/modals

None.

### 11. Async states

- Loading: text swap `{isPending ? 'Creating Account...' : 'Begin Your Journey'}` (line 394).
- Error: Bare `<p className="text-red-400 text-sm text-center">` (line 149) — not using `AuthError`.
- Inline field errors: bare `<p className="text-red-400 text-xs">`.

### 12. Direct colours

`text-red-400` appears ~8 times (error messages). `X` icon uses `text-red-400` (line 115). `Check` icon uses inline style `color: 'var(--gold-500)'` (line 113). `border-[rgba(30,55,100,0.5)]` on the bottom link separator (line 399). Approximate direct palette count: **9**.

### 13. Mobile fixed elements

None.

---

## ForgotPasswordPage.tsx

**Path:** `frontend/src/pages/ForgotPasswordPage.tsx`

### 1. Header

Bespoke `<Link to="/">` with `className="fantasy-title text-5xl tracking-widest ..."` (line 54–58). The brand wordmark is a hyperlink rather than a plain `<h1>` — diverges from LoginPage/RegisterPage pattern (those use a plain h1). No `AuthLayout`.

### 2. Container

`max-w-sm` (line 51). `px-4` gutter.

### 3. Outer padding

Root div has no outer padding beyond the flex centering. `px-4` on content wrapper.

### 4. Background

`usePageBackground({ scene: 'auth' })` + `<PageBackground scene="auth" />` (lines 43, 44–48). Same correct dual-pattern.

### 5. Surfaces

Single `glass-panel` card (line 63): `className="glass-panel w-full px-6 py-7"`. No nested panels. No backdrop-blur.
Success state includes a `rounded-full` icon badge (line 69) with an inline `background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)'` — same pattern repeated on all auth pages (not extracted to a shared component).

### 6. Radii

`rounded-full` on success badge icon (line 69).

### 7. Buttons

- **Shared `Button`:** "Try Another Email" with `variant="secondary"` (line 96), "Return to Login" (line 104), "Send Reset Link" (line 166). Three Button instances, two on the success state simultaneously (secondary + primary) — acceptable since they are alternate actions.
- **Raw `<button>`:** 0.

### 8. Tabs

None.

### 9. Forms

Single `celestial-input` for email (line 157). Icon uses raw `text-[rgb(100,130,165)]` class instead of `text-[var(--icon-accent)]` (line 148) — raw rgb diverges from LoginPage/RegisterPage which use CSS variables.
Label uses `text-slate-400` (line 143) instead of `text-[var(--text-secondary)]`.

### 10. Dialogs/modals

None.

### 11. Async states

- Loading: text swap `{isPending ? 'Sending...' : 'Send Reset Link'}` (line 167).
- Error: Bare `<p className="text-red-400 text-sm text-center">` (line 133) — not using `AuthError`.
- Success: Full inline success state panel rendered within the card.

### 12. Direct colours

Raw `rgb()`: `text-[rgb(220,235,255)]` (line 83), `text-[rgb(100,130,165)]` (lines 148, 186). Raw `rgba()`: `border-[rgba(30,55,100,0.5)]` (line 172). Raw `rgb()` link: `text-[rgb(212,168,67)]` (line 176) — should use `var(--link-gold)` or `var(--gold-500)`. `text-slate-400` × ~4. `text-red-400` × 1. **Approximate direct colour count: ~11**.

### 13. Mobile fixed elements

None.

### Notable violation

Hardcoded copyright: line 187 `&copy; 2025 Equoria. All rights reserved.` — will stale in future years. `AuthFooter` uses dynamic `getFullYear()`.

---

## ResetPasswordPage.tsx

**Path:** `frontend/src/pages/ResetPasswordPage.tsx`

### 1. Header

Bespoke `<Link to="/">` inside a `pageShell` helper function (lines 100–106), class `"fantasy-title text-5xl tracking-widest hover:opacity-90 transition-opacity"`. Identical approach to ForgotPasswordPage. No `AuthLayout`.

### 2. Container

`max-w-sm` (line 99). `px-4`.

### 3. Outer padding

`py-8` on root div (line 95). `px-4` on content wrapper.

### 4. Background

`usePageBackground({ scene: 'auth' })` + `<PageBackground scene="auth" />` (lines 92, 94–98). Consistent.

### 5. Surfaces

`glass-panel` card in `pageShell` (line 108): `className="glass-panel w-full px-6 py-7"`. Icon badge circles (lines 122, 161) use `rounded-full` with inline gradient backgrounds. No nested panels. No backdrop-blur.

### 6. Radii

`rounded-full` for icon badges and password strength bar (lines 122, 161, 244, 248). No rounded-\* on card or inputs.

### 7. Buttons

- **Shared `Button`:** Used throughout all three states. "Request New Reset Link" (line 139), "Return to Login" secondary (line 143–148), "Go to Login" (line 179), "Reset Password" submit (line 311).
- **Raw `<button>`:** 2 instances — password/confirm visibility toggles (lines 226, 297). Both use `text-[rgb(100,130,165)] hover:text-white` instead of `text-[var(--icon-accent)]`.
- **No-token state (line 117–153):** Two simultaneous `Button` elements — "Request New Reset Link" (default/primary) and "Return to Login" (secondary). Acceptable as alternate actions.

### 8. Tabs

None.

### 9. Forms

Inputs use `celestial-input` class (lines 223, 289). Inline `style={{ paddingLeft: '2.5rem' }}`.
`RequirementCheck` sub-component (lines 81–90) uses `text-forest-green` class (non-standard; comment on line 80 explains it's asserted by tests) and `text-red-400` — different from RegisterPage's version which uses `var(--gold-500)` for met state.
Labels use `text-slate-400` instead of `text-[var(--text-secondary)]`.

### 10. Dialogs/modals

None.

### 11. Async states

- Loading: text swap `{isPending ? 'Resetting...' : 'Reset Password'}` (line 312).
- Error: Bare `<p className="text-red-400 text-sm text-center">` (line 199).
- Three full states rendered by `pageShell`: no-token, success, form.

### 12. Direct colours

`text-[rgb(100,130,165)]` × 4 (icon, toggle buttons, labels). `text-[rgb(220,235,255)]` × 3. `text-[rgb(212,168,67)]` × 1. `text-slate-400` × ~4. `text-red-400` × 4. `border-[rgba(30,55,100,0.5)]` × 1. `text-forest-green` × 2 (custom class for tests). **Approximate direct colour count: ~19**.

### 13. Mobile fixed elements

None.

### Notable violations

- Hardcoded `© 2025` footer (line 110).
- `RequirementCheck` met-state uses `text-forest-green` (Tailwind extension or custom class) while RegisterPage uses `var(--gold-500)` — two different visual treatments for the same UI component on sibling pages.
- `PasswordStrength` component in `components/auth/` is never used by ResetPasswordPage or RegisterPage; both duplicate inline requirement-check logic.

---

## VerifyEmailPage.tsx

**Path:** `frontend/src/pages/VerifyEmailPage.tsx`

### 1. Header

Bespoke `<Link to="/">` in `pageShell` helper (lines 81–87), class `"fantasy-title text-5xl tracking-widest hover:opacity-90 transition-opacity"`. Identical to ForgotPasswordPage/ResetPasswordPage. No `AuthLayout`.

### 2. Container

`max-w-sm` (line 80). `px-4`.

### 3. Outer padding

`py-8` on root div (line 76). `px-4` on content wrapper.

### 4. Background

`usePageBackground({ scene: 'auth' })` + `<PageBackground scene="auth" />` (lines 73, 74–80). Consistent.

### 5. Surfaces

`glass-panel` card in `pageShell` (line 89): `className="glass-panel w-full px-6 py-7"`. Icon badge circles (lines 103, 139, 163, 202, 265) are `rounded-full` with inline `background` gradient styles. No nested panels. No backdrop-blur.

### 6. Radii

`rounded-full` on icon badges only (5 occurrences for 5 state variants).

### 7. Buttons

All CTA buttons use shared `Button` component. Multiple states use two simultaneous Buttons (e.g. idle authenticated state: "Resend Verification Email" primary + "Continue to Home" secondary at lines 284/307–313). All secondary/ghost variants are explicitly declared. No raw `<button>` elements.

### 8. Tabs

None.

### 9. Forms

No form inputs — this is a confirmation/action page only.

### 10. Dialogs/modals

None.

### 11. Async states

Five distinct visual states: `'idle'`, `'verifying'` (shows Loader2 spinner, line 144), `'success'`, `'error'`, `'already-verified'`. The verifying state uses `<Loader2 className="w-8 h-8 text-white animate-spin" />` inside the icon badge — the only spinner in the auth family. Error recovery shows resend button when authenticated.

### 12. Direct colours

`text-[rgb(220,235,255)]` × 5 (body text across states). `text-[rgb(100,130,165)]` × 1 (footer). `text-white` × 5 (icon fills). `text-red-400` × 2 (error messages). `text-slate-400` × 2. `var(--celestial-primary)` × 2 (inline style). **Approximate direct colour count: ~15**.

### 13. Mobile fixed elements

None.

### Notable violations

- Hardcoded `© 2025` footer (line 91).
- `text-[rgb(220,235,255)]` literal used 5 times across state variants — should be a CSS variable like `var(--text-body-blue)` or similar.
- `pageShell` is a local helper function (defined inline at line 74) — identical pattern is duplicated in ResetPasswordPage. Should be extracted to a shared component.

---

## OnboardingPage.tsx

**Path:** `frontend/src/pages/OnboardingPage.tsx`

### 1. Header

No standalone `<h1>` or `<h2>` outside the card. Within the main card (lines 374–397), an `<h1>` is rendered with step title text: `className="text-2xl sm:text-3xl font-bold text-[var(--gold-400)] tracking-wide"` with inline `fontFamily: 'var(--font-heading)'` and multi-layer `textShadow` inline style. A second `<p>` renders subtitle below. Neither uses PageHero. No AuthLayout.

### 2. Container

`max-w-md` (line 346) — different from all other auth pages which use `max-w-sm`. Content wrapper: `w-full max-w-md relative z-10`.

### 3. Outer padding

`p-4` on root div (line 343) — single padding on the entire page, not a duplicate of shell gutters.

### 4. Background

`usePageBackground({ scene: 'default' })` (line 340) — uses `'default'` scene, NOT `'auth'` like all other auth-family pages. No `<PageBackground>` JSX component alongside it (no layered fixed div rendered). This means OnboardingPage has a different atmospheric background from every other auth page.

### 5. Surfaces

`glass-panel-heavy` (line 372): `className="glass-panel-heavy rounded-2xl p-6 shadow-2xl border border-[rgba(201,162,39,0.18)]"`. Note: `rounded-2xl` is applied directly on the card element alongside `glass-panel-heavy` — implies the CSS class itself may not set border-radius, unlike `glass-panel` which may. Additional inline surfaces in `ReadyStep`: `rounded-2xl bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.25)]` (line 153) and `rounded-xl bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.15)]` (line 202). No backdrop-blur.

### 6. Radii

`rounded-2xl` on main card (line 372) and horse-details badge (line 153). `rounded-xl` on images (lines 55, 84, 109, 147) and next-step list items (line 202). `rounded-full` on progress dots (line 360). Multiple explicit rounded utilities — richer than other auth pages.

### 7. Buttons

- **Shared `Button`:** Primary CTA "Continue"/"Let's Go!" (line 413–436, `size="lg"`); "Skip intro" ghost button (line 441–449, `variant="ghost" size="sm"`). Only one primary `Button` visible at a time; no dual-primary issue.
- **Raw `<button>`:** 0.
- Progress dots use `<div role="tab">` not buttons (lines 353–368) — correct for ARIA but could be keyboard-unfriendly if not supplemented.

### 8. Tabs

Progress dots use `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA pattern (lines 349, 353, 400) — manual implementation, not CelestialTabs/GoldTabs/Radix Tabs.

### 9. Forms

No direct form inputs in OnboardingPage itself. `BreedSelector` component handles step 1 form fields. `BreedSelectorSkeleton` used for loading state (line 116).

### 10. Dialogs/modals

None.

### 11. Async states

- Loading (breeds): `BreedSelectorSkeleton` shown while breeds fetch (line 116).
- Error (breeds): Bare `<p className="text-sm text-[var(--text-muted)] ..." role="alert">` (line 119–123).
- Mutation loading: `<Loader2>` spinner inside Button label (line 421).
- Error (submit): `toast.error(message)` via Sonner (line 317) — different async-error pattern from all other auth pages which use inline `<p>`.

### 12. Direct colours

`bg-[rgba(201,162,39,0.1)]`, `border-[rgba(201,162,39,0.25)]`, `shadow-[0_0_18px_rgba(201,162,39,0.08)]` (line 153). `bg-[rgba(10,22,50,0.5)]`, `border-[rgba(100,130,165,0.15)]` (line 202). `bg-[rgba(201,162,39,0.45)]`, `bg-[rgba(100,130,165,0.25)]` (lines 364–365). `border-[rgba(201,162,39,0.18)]` (line 372). Multiple `rgba()` literals in `textShadow` inline styles. `text-[var(--gold-400)]`, `text-[var(--cream)]`, `text-[var(--text-muted)]` — CSS variables correctly used for text. **Approximate raw rgba/colour count: ~10**.

### 13. Mobile fixed elements

None.

### Notable violations

- Uses `scene: 'default'` instead of `scene: 'auth'` — visually inconsistent with the rest of the auth flow.
- `glass-panel-heavy` with explicit `rounded-2xl` — other pages use `glass-panel` without explicit radius.
- `toast.error()` for submit failure vs inline `<p>` error pattern elsewhere.
- Manual ARIA tab pattern for progress dots — not a reusable step-indicator component.
- No footer/copyright, no Equoria brand wordmark — only auth page without a brand anchor at top.
- `max-w-md` vs `max-w-sm` for all other auth pages.

---

## AuthLayout.tsx (Foundation Component)

**Path:** `frontend/src/components/auth/AuthLayout.tsx`

### Usage by pages

**Not used by any routed page.** All six pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Onboarding) build their own shells. `AuthLayout` was extracted (Story 1.1 Task 2) but never adopted by the pages it was designed for.

### 1. Header

`AuthHeader` sub-component (lines 56–69): `<header>` with `background: var(--glass-surface-heavy-bg)` and `borderColor: var(--border-default)`. Inner `<h1 className="fantasy-title text-3xl">` — note `text-3xl`, while all pages use `text-5xl` for the wordmark. Different size.

### 2. Container

`max-w-md` (line 172) — matches OnboardingPage, not the `max-w-sm` used by five other auth pages.

### 3. Outer padding

`p-4 py-8` on `<main>` (line 171). No outer px duplication.

### 4. Background

None — AuthLayout provides no background; callers must provide their own. This is a structural gap: using AuthLayout requires adding `usePageBackground` manually, which pages would need to do themselves anyway.

### 5. Surfaces

`glass-panel p-6 space-y-6` on the auth card (line 174). Sub-component `AuthError` uses `bg-[rgba(239,68,68,0.1)] border border-red-500/30 rounded-lg` (line 112) — only place in the auth family where a styled error box exists; pages bypass this component.

### 6. Radii

`rounded-full` on `AuthCardHeader` icon badge (line 89). `rounded-lg` on `AuthError` box (line 112).

### 7. Buttons

No Button usage in AuthLayout itself — it is a slot-based layout.

### 8. Tabs

None.

### 9. Forms

None — slot-based, delegates to children.

### 10. Dialogs/modals

None.

### 11. Async states

`AuthError` component (lines 105–116) provides a styled error box — but no page uses it.

### 12. Direct colours

`bg-[rgba(239,68,68,0.1)]` and `border-red-500/30` in `AuthError` (line 112). `text-red-400` inside same (line 113). `text-[var(--text-muted)]` in `AuthFooter` (line 78). `text-[var(--gold-primary)]` in `AuthCardHeader` (line 97). `text-[var(--text-primary)]` in icon (line 94). Approximate direct palette count: **3**.

### Notable violation

`AuthFooter` (lines 74–80) computes `{new Date().getFullYear()}` dynamically — correct. However, since no page uses `AuthLayout`, the three pages that have footers (ForgotPassword, ResetPassword, VerifyEmail) all hardcode `© 2025`.

---

## PasswordStrength.tsx (Foundation Component)

**Path:** `frontend/src/components/auth/PasswordStrength.tsx`

### Usage by pages

**Not used by RegisterPage or ResetPasswordPage.** Both pages duplicate inline `RequirementCheck` sub-components. The shared `PasswordStrength` component was also extracted (Story 1.1) but never adopted.

### Notable design issues

- `RequirementCheck` uses `text-emerald-400` (line 53) for the check icon and `text-[rgb(37,99,235)]` (line 57) for met-state label text. These are raw palette colours (blue-600 equivalent) — semantically incorrect for the "met" indicator on a gold-themed UI.
- Strength bar background uses `bg-[rgba(37,99,235,0.2)]` (line 111) — a raw blue rgba, not a design token.
- Direct colour count: **~4** (text-emerald-400, text-[rgb(37,99,235)], bg-[rgba(37,99,235,0.2)], text-slate-400).

---

## ProtectedRoute.tsx (Foundation Component)

**Path:** `frontend/src/components/auth/ProtectedRoute.tsx`

### Notable design issues

`DefaultLoading` spinner (lines 20–30) uses:

- `bg-background` — Tailwind/shadcn semantic token; OK.
- `border-burnished-gold` (line 25) — custom Tailwind colour extension; not a CSS variable.
- `border-t-transparent` (line 25) — raw utility.
- `text-aged-bronze` (line 27) — custom Tailwind colour extension; not a CSS variable.
- Loading is text-only with spinner; no skeleton. Not consistent with async states on other pages.

---

## Cross-Cutting Findings

### Unused shared components

1. `AuthLayout` — purpose-built, exported, never consumed by any auth page.
2. `PasswordStrength` — purpose-built, exported, never consumed; RegisterPage and ResetPasswordPage both duplicate the logic inline with divergent styling.
3. `AuthError` — lives inside AuthLayout; never used directly.
4. `AuthFooterLink` — lives inside AuthLayout; never used directly (pages hand-write their own footer links).

### Copyright year split

| Component                     | Copyright value                        |
| ----------------------------- | -------------------------------------- |
| AuthLayout.AuthFooter         | `{new Date().getFullYear()}` (dynamic) |
| ForgotPasswordPage (line 187) | `2025` (hardcoded)                     |
| ResetPasswordPage (line 110)  | `2025` (hardcoded)                     |
| VerifyEmailPage (line 91)     | `2025` (hardcoded)                     |

### Duplicate inline pageShell pattern

`ResetPasswordPage` and `VerifyEmailPage` both define a local `pageShell` function (identical structure) that wraps children in the standard auth background + brand link + card + footer. This should be extracted once.

### Dual-primary CTA on LoginPage

LoginPage renders two `Button` components with no `variant` prop (both default/primary gold) on the same card surface — "Enter" (submit) at line 167 and "Create an Account" at line 173. Both render identically, violating the one-primary-CTA-per-surface convention.

### Background scene mismatch

OnboardingPage uses `scene: 'default'`; all other auth pages use `scene: 'auth'`. The onboarding step is part of the same new-user registration funnel, so the atmospheric break is jarring.

### Raw rgb()/rgba() literal spread

ForgotPasswordPage, ResetPasswordPage, and VerifyEmailPage use `text-[rgb(220,235,255)]`, `text-[rgb(100,130,165)]`, `text-[rgb(212,168,67)]` as raw literals for body text, icon accent, and link gold respectively. LoginPage and RegisterPage use `var(--text-secondary)`, `var(--icon-accent)`, `var(--link-gold)` correctly. The three newer/reset pages were written without aligning to the token system.

### RequirementCheck inconsistency

| File                       | Met icon colour                    | Met text colour                        |
| -------------------------- | ---------------------------------- | -------------------------------------- |
| RegisterPage inline        | `var(--gold-500)` (inline style)   | `var(--gold-500)` (inline style)       |
| ResetPasswordPage inline   | `text-forest-green` (custom class) | `text-forest-green`                    |
| PasswordStrength component | `text-emerald-400`                 | `text-[rgb(37,99,235)]` (wrong — blue) |

Three implementations, three different colour schemes.
