# Design-System Inventory: settings-profile family

The **settings-profile** family comprises two routed pages — `SettingsPage` and `ProfilePage` — plus five sub-components extracted from the Settings container: `AccountSection`, `NotificationsSection`, `DisplaySection`, `SoundSection`, `DeleteAccountModal`, and the shared `constants.tsx` (which supplies the reusable `Toggle` switch component). Both pages open with the shared `PageHero` component (mood `"default"`, gold icon). Their surface language differs in one notable way: `SettingsPage` uses a bespoke sidebar-nav + content-panel layout while `ProfilePage` is a narrow single-column card page. No `CelestialTabs`, `GoldTabs`, or `GameDialog` are used anywhere in this family; the delete-account dialog is a hand-built fixed overlay; all toggle switches are a custom `button[role="switch"]` component rather than a Radix Switch primitive; and all text inputs inside `AccountSection` are raw `<input>` elements with inline Tailwind classes rather than the shared `celestial-input` class used in `ProfilePage`.

---

## Summary Table

| File                     | Header                  | Container max-w | Outer px                                        | Surfaces                                           | Backdrop-blur        | Raw inputs               | Shared Button     | Raw `<button>`             | Direct palette colors |
| ------------------------ | ----------------------- | --------------- | ----------------------------------------------- | -------------------------------------------------- | -------------------- | ------------------------ | ----------------- | -------------------------- | --------------------- |
| SettingsPage.tsx         | PageHero (mood default) | max-w-4xl       | px-4 sm:px-6 lg:px-8 (duplicates layout gutter) | none (no glass-panel directly)                     | 0                    | 0                        | 0                 | 4 (sidebar nav)            | ~4                    |
| ProfilePage.tsx          | PageHero (mood default) | max-w-md        | px-4 sm:px-6 lg:px-8 (duplicates layout gutter) | glass-panel + multiple glass-panel-subtle (nested) | 0                    | 0 (uses celestial-input) | 2 (Save + Cancel) | 0                          | ~3                    |
| AccountSection.tsx       | `<h2>` bespoke          | —               | —                                               | glass-panel                                        | 0                    | 5 raw inputs             | 5 shared Button   | 0                          | ~6                    |
| NotificationsSection.tsx | `<h2>` bespoke          | —               | —                                               | glass-panel                                        | 0                    | 0                        | 0                 | 0                          | ~3                    |
| DisplaySection.tsx       | `<h2>` bespoke          | —               | —                                               | glass-panel                                        | 0                    | 0                        | 0                 | 0                          | 0                     |
| SoundSection.tsx         | `<h2>` bespoke          | —               | —                                               | glass-panel                                        | 0                    | 0                        | 0                 | 6 preview buttons          | ~3                    |
| DeleteAccountModal.tsx   | bespoke `<h3>`          | max-w-md        | —                                               | glass-panel-heavy                                  | 1 (backdrop overlay) | 1 raw input              | 2 shared Button   | 0                          | ~3                    |
| constants.tsx (Toggle)   | —                       | —               | —                                               | —                                                  | 0                    | —                        | —                 | 1 `<button role="switch">` | ~3                    |

---

## SettingsPage.tsx

**Path:** `frontend/src/pages/SettingsPage.tsx`

### 1. Header

Uses `<PageHero>` (line 322–327):

```
<PageHero
  title="Settings"
  subtitle="Manage your account preferences and application settings."
  mood="default"
  icon={<Settings className="w-7 h-7 text-[var(--gold-400)]" />}
/>
```

Standard shared component; no custom overrides.

### 2. Container

Line 329: `max-w-4xl mx-auto` in a `grid grid-cols-1 md:grid-cols-4 gap-6`. No arbitrary width class.

### 3. Outer Padding

Line 329: `px-4 sm:px-6 lg:px-8 pb-12` on the main content wrapper. This duplicates the responsive gutter already applied by `DashboardLayout` — a likely double-gutter violation.

### 4. Background

No `PageBackground` import. No local background image, gradient, or banner. The outer div is `min-h-screen` (line 321) with no background class — relies on the body/layout background.

### 5. Surfaces

No `glass-panel` or similar class directly in this file; surfaces live in section sub-components. The outer wrapper and grid divs are unstyled (`min-h-screen`, `md:col-span-1`, `md:col-span-3`).

### 6. Radii

Sidebar nav buttons use `rounded-lg` (line 341).

### 7. Buttons

Zero `<Button>` component imports or uses at this level. The sidebar navigation uses 4 raw `<button>` elements with manual Tailwind classes (lines 337–355):

- Active state: `bg-white/10 text-celestial-gold border border-white/10`
- Inactive state: `text-white/60 hover:text-[var(--text-primary)] hover:bg-white/5`

These are command-level navigation controls, not the shared `Button` component.

### 8. Tabs

None. Uses a custom sidebar `<nav>` with `<button>` elements to swap sections — not `CelestialTabs` or any Radix Tab primitive.

### 9. Forms

No form elements directly in this file; delegated to section components.

### 10. Dialogs/Modals

`DeleteAccountModal` is conditionally rendered inline (lines 409–418); it is a **page-local fixed overlay** (not `GameDialog` or `BaseModal`). Escape-key dismiss is wired via a `useEffect` keydown listener (lines 259–271) in the page container rather than inside the modal component.

### 11. Async States

- Loading: shown only as disabled button text in sections ("Saving…", "Changing…", "Deleting…"). No global spinner or skeleton at page level.
- Error: surfaces via `toast.error()` — no on-page ErrorCard.
- Empty: not applicable.

### 12. Direct Colors

- Line 326: `text-[var(--gold-400)]` — CSS-var, acceptable.
- Line 343: `text-celestial-gold` — Tailwind semantic token, acceptable.
- Line 343: `border-white/10`, `bg-white/10`, `text-white/60`, `hover:bg-white/5` — raw opacity-based color classes (~4 instances).

### 13. Mobile Fixed Elements

None. No fixed bars or sticky toolbars.

---

## ProfilePage.tsx

**Path:** `frontend/src/pages/ProfilePage.tsx`

### 1. Header

Uses `<PageHero>` (lines 158–163):

```
<PageHero
  title={UI_TEXT.profile.title}
  subtitle="View and edit your profile information"
  mood="default"
  icon={<User className="w-7 h-7 text-[var(--gold-400)]" />}
/>
```

Standard shared component; consistent with SettingsPage header shape.

### 2. Container

- Main wrapper (line 166): `max-w-md` (448 px) — significantly narrower than `max-w-4xl` used in SettingsPage.
- Error state glass panel (line 147): `glass-panel px-6 py-5 max-w-md text-center`.
- No arbitrary width classes.

### 3. Outer Padding

Line 165: `px-4 sm:px-6 lg:px-8 pb-8` on the `<main>` wrapper — same responsive gutter pattern as SettingsPage, duplicating `DashboardLayout` gutters.

### 4. Background

No `PageBackground` usage. The outer div is `min-h-screen` (lines 128, 146, 157) with no additional background class. A bespoke `<footer>` at the bottom (line 372) uses `border-color: var(--border-muted)` via inline style — unusual; other pages do not add a footer directly.

### 5. Surfaces

Heavy nesting of glass surfaces — violation:

- Outer container: `glass-panel px-6 py-6` (line 168) — the primary card.
- Inside that, multiple `glass-panel-subtle` nested panels (lines 188, 196, 205, 256, 270) for email, XP, currency, rank history, and activity feed.
- Error fallback: `glass-panel px-6 py-5` (line 147).
- This creates `glass-panel > glass-panel-subtle` nesting on every subsection — panel-inside-panel throughout.

### 6. Radii

- `rounded-full` for avatar circle (line 173) and loading spinner (line 131).
- `rounded-lg` for all `glass-panel-subtle` sub-sections (lines 188, 196, 205, 256, 270).

### 7. Buttons

Two shared `<Button>` components (lines 347–365):

- `variant="secondary"` for Cancel (with `<X>` icon).
- Default variant for Save (with `<Save>` icon).
- Both co-exist on one surface — acceptable primary + secondary pair.
- No raw command `<button>` elements.

### 8. Tabs

None.

### 9. Forms

- Username `<input>` (line 298–309): uses `className="celestial-input"` with inline `style={{ paddingLeft: '2.5rem' }}` for icon offset. Acceptable shared class but the padding override bypasses the shared class padding definition.
- Bio `<textarea>` (lines 325–336): uses `className="celestial-input min-h-[100px] resize-vertical"` with inline `style={{ paddingLeft: '2.5rem', paddingTop: '0.625rem' }}`. Same issue: arbitrary inline padding overrides.
- Validation errors: raw `<p className="text-red-400 text-xs">` (lines 311, 341).

### 10. Dialogs/Modals

None.

### 11. Async States

- Loading (page-level, lines 127–141): bespoke centered spinner using `animate-spin border-t-transparent` with `style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--celestial-primary)' }}`. Not a shared Skeleton or Spinner component. Inline styles mix CSS variables directly on the element.
- Error (page-level, lines 144–154): bespoke `glass-panel` centered panel with `text-red-400`. Not an `ErrorCard` component.
- Sub-component loading: delegated to `StatisticsCard`, `CurrencyDisplay`, `XPLevelDisplay`, `ActivityFeed`, and `RankHistoryChart` via `isLoading` props.
- Empty: `ActivityFeed` receives `emptyMessage` when activity or rank history errors.

### 12. Direct Colors

- Lines 148, 311, 341: `text-red-400` — raw Tailwind palette (3 instances).
- Line 179: `text-white` on avatar icon.
- Line 134: `borderColor: 'var(--border-default)'` + `borderTopColor: 'var(--celestial-primary)'` inline styles for spinner — not direct palette classes but bypasses Tailwind.
- Line 176: inline gradient `linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)` — CSS variable refs inside inline style.

### 13. Mobile Fixed Elements

None. Footer is static, not fixed.

---

## AccountSection.tsx

**Path:** `frontend/src/pages/settings/AccountSection.tsx`

### 1. Header

Bespoke `<h2>` (line 57): `text-lg font-semibold text-[var(--text-primary)]` — "Account Settings".
Sub-sections use bespoke `<h3>` elements:

- Line 102: `text-sm font-medium text-white/70` — "Change Password".
- Line 185: `text-sm font-medium text-red-400` — "Danger Zone".

### 2. Container

`glass-panel` div (line 56) with `space-y-6`. No max-w class.

### 3. Outer Padding

No outer px-\* class; uses glass-panel's own padding (defined in the design-system CSS class).

### 4. Background

None.

### 5. Surfaces

Single `glass-panel` (line 56). No nested glass surfaces.

### 6. Radii

All inputs use `rounded-lg` (lines 73, 87, 131, 148, 165).

### 7. Buttons

Five shared `<Button>` components:

- Line 91–98: "Save Changes" (default variant, primary action).
- Line 105–111: "Update Password" (default variant — second primary action visible when password form is hidden).
- Lines 169–175: "Change Password" submit (default variant).
- Line 176–178: "Cancel" (`variant="secondary"`).
- Line 189–191: "Delete Account" trigger (default variant — danger action using default styling, not a destructive variant).

Notable: The Danger Zone delete trigger (line 189) uses the default `<Button>` variant. There is no `variant="destructive"` applied, so the button is styled identically to the "Save Changes" button above it — no visual differentiation for a destructive action.

### 8. Tabs

None.

### 9. Forms

Five raw `<input>` elements (lines 67–74, 81–88, 124–132, 142–149, 158–166), all with identical inline Tailwind classes:

```
w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm
text-[var(--text-primary)] placeholder:text-white/30
focus:outline-none focus:ring-1 focus:ring-celestial-gold/50
```

None use the shared `celestial-input` class (contrast with `ProfilePage`). This is inconsistent with the form in `ProfilePage.tsx`.

### 10. Dialogs/Modals

None (modal is rendered by the parent `SettingsPage`).

### 11. Async States

- Loading: inline text swap `isSavingAccount ? 'Saving…' : 'Save Changes'` (line 97) and `isChangingPassword ? 'Changing…' : 'Change Password'` (line 174). No spinner.
- Error: none in-component; errors surface as toasts in the parent.
- Empty: not applicable.

### 12. Direct Colors

- Line 63: `text-white/70` (label).
- Line 73, 87, 131, 148, 165: `bg-white/5 border-white/10 text-white/30 focus:ring-celestial-gold/50` per input (~5 occurrences of multiple opacity classes).
- Line 102: `text-white/70` (h3).
- Lines 121, 137, 154: `text-white/60` (password sub-labels).
- Line 184: `border-red-900/30` (danger section divider).
- Line 185: `text-red-400` (Danger Zone heading).
- Line 186: `text-white/40` (danger description).
  Total raw palette/opacity classes: ~18 distinct instances. Direct palette colors (non-white-opacity): `text-red-400`, `border-red-900/30` — 2.

### 13. Mobile Fixed Elements

None.

---

## NotificationsSection.tsx

**Path:** `frontend/src/pages/settings/NotificationsSection.tsx`

### 1. Header

Bespoke `<h2>` (line 22): `text-lg font-semibold text-[var(--text-primary)]` — "Notification Preferences".
Two subsection `<h3>` elements (lines 25, 52): `text-xs uppercase tracking-widest text-white/40 font-medium`.

### 2. Container

`glass-panel space-y-6` (line 21). No max-w class.

### 3–4. Outer Padding / Background

None.

### 5. Surfaces

Single `glass-panel`. No nesting.

### 6. Radii

None in this component directly; radii inside `Toggle` component.

### 7. Buttons

None; all interaction via `Toggle` components.

### 8. Tabs

None.

### 9. Forms

No form inputs; uses `Toggle` component exclusively.

### 10. Dialogs/Modals

None.

### 11. Async States

None. Toggles are optimistic (persisted via mutation in parent).

### 12. Direct Colors

- Lines 25, 52: `text-white/40`, `border-white/5` (~4 instances total).

### 13. Mobile Fixed Elements

None.

---

## DisplaySection.tsx

**Path:** `frontend/src/pages/settings/DisplaySection.tsx`

### 1. Header

Bespoke `<h2>` (line 19): `text-lg font-semibold text-[var(--text-primary)]` — "Display Settings".

### 2. Container

`glass-panel space-y-6` (line 18). No max-w.

### 3–13

No outer padding, no background, single glass-panel surface, no radii locally, no buttons, no tabs, no dialogs. Uses only `Toggle` components. Zero direct palette colors. No async states or fixed elements.

---

## SoundSection.tsx

**Path:** `frontend/src/pages/settings/SoundSection.tsx`

### 1. Header

Bespoke `<h2>` (line 37): `text-lg font-semibold text-[var(--text-primary)]` — "Sound Settings".

### 2. Container

`glass-panel space-y-6` (line 36). No max-w.

### 3–4. Outer Padding / Background

None.

### 5. Surfaces

Single `glass-panel`. No nesting.

### 6. Radii

Preview buttons use `rounded-md` (line 63).

### 7. Buttons

Zero shared `<Button>` components. Six raw `<button>` elements for sound previews (line 60–67), each using:

```
px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10
border border-white/10 text-white/70 transition-colors
```

These are raw hand-styled command buttons, not using the shared `Button` component.

### 8. Tabs

None.

### 9. Forms

No inputs; uses `Toggle` for the master switch.

### 10. Dialogs/Modals

None.

### 11. Async States

None.

### 12. Direct Colors

- Line 39: `text-white/50`.
- Line 57: `text-white/40`.
- Line 63: `bg-white/5 hover:bg-white/10 border-white/10 text-white/70` (~4 opacity classes per button × 6 = repeated pattern but same 4 class names).

### 13. Mobile Fixed Elements

None.

---

## DeleteAccountModal.tsx

**Path:** `frontend/src/pages/settings/DeleteAccountModal.tsx`

### 1. Header

Bespoke `<h3>` (line 62): `text-lg font-semibold text-red-400` — "Delete account permanently?".
Referenced via `aria-labelledby="delete-account-title"`.

### 2. Container

`max-w-md w-full` inner panel (line 61). Outer overlay is `fixed inset-0`.

### 3. Outer Padding

`p-4` on the outer overlay (line 37) for mobile clearance; `p-6` on the inner panel (line 61).

### 4. Background

Outer: `bg-black/70` full-screen overlay (line 37).

### 5. Surfaces

`glass-panel-heavy rounded-xl` (line 61) — the modal inner panel. Single surface, no nesting.

### 6. Radii

- Outer panel: `rounded-xl` (line 61).
- Confirm input: `rounded-lg` (line 82).
- Username code inline: `rounded` (line 71 — via `px-1 py-0.5 rounded bg-white/10`).

### 7. Buttons

Two shared `<Button>` components (lines 86–101):

- Cancel: `variant="secondary"` (correct).
- Confirm delete: default variant (line 94–101) — **no destructive variant applied** to the permanently-destructive action. The button is disabled until the username matches, but visually it defaults to the standard primary style.

### 8. Tabs

None.

### 9. Forms

One raw `<input type="text">` (lines 74–84) with inline Tailwind classes:

```
w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm
text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-red-500/50
```

Uses raw styling consistent with `AccountSection` inputs (not `celestial-input`). Focus ring uses `ring-red-500/50` — direct palette color.

### 10. Dialogs/Modals

This IS the modal implementation — a **page-local fixed overlay**, not `GameDialog` or `BaseModal`. ARIA role `dialog` and `aria-modal` are set (lines 38–39). Escape dismiss is handled by the parent via `useEffect` in `SettingsPage` (not inside this component). Backdrop-click dismiss uses custom `mousedown`/`mouseup` guard (lines 51–59).

### 11. Async States

- Loading: inline text swap `isDeleting ? 'Deleting…' : 'Delete account permanently'` (line 100). No spinner.
- Error: parent handles via toast.

### 12. Direct Colors

- Line 37: `bg-black/70` (overlay background — direct opacity class).
- Line 61: `border-red-500/30`.
- Line 62: `text-red-400`.
- Line 71: `bg-white/10 text-celestial-gold`.
- Line 82: `bg-white/5 border-white/10 focus:ring-red-500/50`.
  Direct palette colors: `text-red-400`, `border-red-500/30`, `focus:ring-red-500/50` — 3 instances.

### 13. Mobile Fixed Elements

Overlay uses `fixed inset-0` (line 37) — standard modal pattern, not a persistent fixed bar.

---

## constants.tsx (Toggle + shared config)

**Path:** `frontend/src/pages/settings/constants.tsx`

### Toggle Component

A bespoke `button[role="switch"]` (lines 38–57) implemented from scratch rather than using Radix UI Switch or a shared design-system primitive:

- Track: `h-5 w-9 rounded-full`, color `bg-celestial-gold` (checked) / `bg-white/20` (unchecked).
- Thumb: `h-4 w-4 rounded-full bg-[var(--bg-night-sky)]`.
- Focus ring: `focus-visible:ring-2 focus-visible:ring-celestial-gold/50`.
- Used by `NotificationsSection` (6 instances), `DisplaySection` (3), and `SoundSection` (1) — 10 Toggle instances total across the family.

### Direct Colors

- Line 35: `text-white/90` (label text).
- Line 36: `text-white/50` (description text).
- Line 46: `bg-celestial-gold` / `bg-white/20`.
- Line 52: `bg-[var(--bg-night-sky)]` (CSS var, acceptable).

---

## Cross-Family Findings

### Notable Violations

1. **Raw inputs in AccountSection vs celestial-input in ProfilePage** (AccountSection lines 73, 87, 131, 148, 165; ProfilePage lines 298, 334): Two pages in the same family use different form input patterns. AccountSection uses 5 raw `<input>` elements with manually repeated Tailwind class strings; ProfilePage uses the `celestial-input` design-system class. DeleteAccountModal's confirm input also uses the raw pattern. Total raw inputs in family: 6.

2. **Double-gutter outer padding** (SettingsPage line 329; ProfilePage line 165): Both pages apply `px-4 sm:px-6 lg:px-8` on their top-level content wrapper, duplicating the responsive padding provided by `DashboardLayout`. This produces wider-than-intended gutters on all breakpoints.

3. **No destructive variant on danger actions** (AccountSection line 189; DeleteAccountModal line 94): The "Delete Account" trigger button and the modal's "Delete account permanently" confirmation button both use the default `<Button>` variant. No `variant="destructive"` is applied, so they are visually indistinguishable from save/update actions.

4. **Bespoke modal overlay instead of GameDialog** (DeleteAccountModal.tsx): The family invents its own `fixed inset-0 bg-black/70 backdrop-blur-sm` modal pattern. Other pages (`InventoryPage`, `HorseEquipPage`) use `GameDialog`. The backdrop-blur `backdrop-blur-sm` is used here (line 37) — the only backdrop-blur in the settings-profile family.

5. **Panel-inside-panel nesting in ProfilePage** (lines 168, 188, 196, 205, 256, 270): A `glass-panel` outer card wraps six `glass-panel-subtle` sub-panels. This double-glass nesting may produce unintended visual layering.

6. **Bespoke Toggle switch** (constants.tsx lines 38–57): All preference toggles across the settings family use a hand-crafted `button[role="switch"]` rather than Radix UI's `Switch` primitive or a shared design-system component. This duplicates accessible-switch logic and risks divergence from keyboard/ARIA behavior.

7. **Bespoke sidebar nav as tab substitute** (SettingsPage lines 331–357): 4 raw `<button>` elements in a `<nav>` replicate tabbed-section switching. The codebase has `CelestialTabs` available for exactly this pattern (used in FarrierPage, TackShopPage, VeterinarianPage, MyStablePage).

8. **Bespoke page-level loading/error states in ProfilePage** (lines 127–154): The loading spinner and error card are hand-built inline rather than using shared components, and the spinner uses inline `style` with direct CSS variable references on `borderColor` / `borderTopColor` — bypassing Tailwind entirely.

9. **ProfilePage renders a `<footer>` element** (line 372): No other authenticated page in the codebase adds its own footer inside the route component. This produces an additional footer below the layout's own footer (or is redundant with it).

10. **Raw preview `<button>` elements in SoundSection** (lines 60–67): 6 sound-preview buttons are raw `<button>` elements with manually repeated Tailwind classes; they are not using the shared `Button` component even at `size="sm"` or `variant="ghost"`.
