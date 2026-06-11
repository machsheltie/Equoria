# Auth Family — Post-Migration Completion Record

**Status:** Migrated (pilot family)
**Pages:** LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, OnboardingPage
**Replaces:** the 2026-06-09 pre-migration scan (which found zero AuthLayout usage, hardcoded `© 2025` footers, and heavy rgb()/rgba() literals).

## What is canonical now

- **Shell:** all five auth pages render inside `components/auth/AuthLayout`
  (verified: Login/Register/ForgotPassword/ResetPassword/VerifyEmail all import
  it) — one wordmark header, one `getFullYear()` footer, one card width owned
  by AuthLayout per DECISIONS §1/§2. The bespoke inline shells and copy-pasted
  `pageShell` helpers are gone.
- **Forms:** Login/Register/ForgotPassword/ResetPassword use `ui/form/*`
  (FormField + Input/PasswordInput) — the single `fieldStyles.ts` recipe
  replaces per-page `celestial-input` + raw-input mixes.
- **Background:** auth scene painted once by the layout (the double-paint via
  `usePageBackground()` AND `<PageBackground/>` is resolved).
- **Onboarding:** intentionally not on AuthLayout — it is a post-auth wizard
  using `usePageBackground({ scene: 'default' })` with a `glass-panel-heavy`
  panel (see `pages/OnboardingPage.tsx` header comment).

## Family commits

`6bcd5b3c3` — authentication pilot, all 5 auth pages onto AuthLayout
(Equoria-o5hub.16) · `cd6c5ac3a` — auth forms to FormField + canonical
controls (Equoria-o5hub.12).

## Remaining known residue (baseline-tracked)

- `pages/VerifyEmailPage.tsx:232,297` — two `text-red-400` error lines
  (palette-classes burn-down; should become `text-role-danger`).
- `pages/OnboardingPage.tsx:153,372` — two `rounded-2xl` panels
  (unsupported-radius; should be `--radius-modal`/`--radius-panel`).
- `components/onboarding/BreedSelector.tsx` — `text-white/70` lore captions
  (x2) and `celestial-input` search/select (x2); part of the onboarding
  polish burn-down.

## Pointers

DECISIONS §1/§2/§7 (`../DECISIONS.md`) · `../MOTION.md` · `../EXCEPTIONS.md` ·
`node scripts/design-audit/check-design-system.mjs --report`
