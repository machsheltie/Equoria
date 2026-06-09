# Community-Messaging Family — Design System Inventory

**Audit date:** 2026-06-09
**Auditor:** Claude Code (file-search specialist)
**Scope:** `frontend/src/pages/CommunityPage.tsx`, `ClubsPage.tsx`, `MessageBoardPage.tsx`, `MessageThreadPage.tsx`, `MessagesPage.tsx`, `frontend/src/pages/clubs/` (5 files), `frontend/src/pages/messages/` (4 files + constants)
**Total files audited:** 14

---

## Family Overview

The community-messaging family covers the Community hub, two forum pages (board list and thread view), the direct-messaging inbox, and the clubs system. All five routed pages share the same structural skeleton: `PageHero` header → `max-w-5xl` (or `max-w-4xl`) centred container → page content. Tab navigation is implemented identically in every page that uses it: a manual `<button role="tab">` row styled with `bg-white/5 border border-white/10 rounded-xl`, with the active state expressed as `bg-white/10 text-white/90 shadow-sm`. No Radix Tabs, CelestialTabs, or GoldTabs are used anywhere in the family.

The biggest consistency risks are: (a) **two divergent form-field styling systems** — most fields use the raw `bg-white/5 border border-white/10 focus:border-violet-500/40` recipe while `ComposeModal` uses a completely different `bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.25)] focus:border-[rgba(200,168,78,0.4)]` recipe, meaning a single family has two competing aesthetics for the same control type; (b) **two divergent modal implementations** — `MessageBoardPage` uses a bare `fixed inset-0 bg-black/60` overlay with no shared component while `ComposeModal` wraps its own overlay with `backdrop-blur-sm` and `z-[var(--z-modal)]`, and `TransferLeadershipModal` adds a third variant with `backdrop-blur-sm` and `z-50`; (c) **unread badge inconsistency** — the inbox tab badge uses `bg-red-500/80` while the notifications tab badge uses `bg-blue-500/80`; (d) **raw `<button>` usage** in every tab navigation, close controls, and list-item expand buttons, totalling more than 20 raw command buttons across the family.

---

## Summary Table

| File                          | PageHero               | Container   | Tab impl              | Dialogs/Modals             | Raw `<input/select/textarea>`           | Raw `<button>` count (est.) | Direct colour classes |
| ----------------------------- | ---------------------- | ----------- | --------------------- | -------------------------- | --------------------------------------- | --------------------------- | --------------------- |
| CommunityPage                 | Yes (`mood="default"`) | `max-w-5xl` | None                  | None                       | 0                                       | 0                           | ~25                   |
| ClubsPage                     | Yes (`mood="default"`) | `max-w-5xl` | Manual `<button>` row | None                       | 0                                       | 3                           | ~10                   |
| MessageBoardPage              | Yes (`mood="default"`) | `max-w-5xl` | Manual `<button>` row | Page-local `fixed` overlay | 2 (`<input>`, `<textarea>`)             | 8                           | ~30                   |
| MessageThreadPage             | Yes (`mood="default"`) | `max-w-4xl` | None                  | None                       | 1 (`<textarea>`)                        | 0                           | ~20                   |
| MessagesPage                  | Yes (`mood="default"`) | `max-w-4xl` | Manual `<button>` row | ComposeModal (separate)    | 0                                       | 3                           | ~20                   |
| clubs/ClubGrid                | None                   | None        | None                  | None                       | 0                                       | 0                           | ~10                   |
| clubs/MyClubTab               | None                   | None        | None                  | TransferLeadershipModal    | 3 (`<input>`, `<select>`, `<textarea>`) | 0                           | ~15                   |
| clubs/ClubElectionsSection    | None                   | None        | None                  | None                       | 0                                       | 0                           | 0                     |
| clubs/ElectionCard            | None                   | None        | None                  | None                       | 1 (`<input>`)                           | 0                           | ~10                   |
| clubs/TransferLeadershipModal | None                   | None        | None                  | Page-local `fixed` overlay | 1 (`<select>`)                          | 1                           | ~8                    |
| messages/ComposeModal         | None                   | None        | None                  | Page-local `fixed` overlay | 3 (`<input>` ×2, `<textarea>`)          | 3                           | ~0 (uses CSS vars)    |
| messages/MessageRow           | None                   | None        | None                  | None                       | 0                                       | 1 (expand toggle)           | ~15                   |
| messages/MessageDetailPanel   | None                   | None        | None                  | None                       | 0                                       | 1 (close X)                 | ~10                   |
| messages/GameNotifRow         | None                   | None        | None                  | None                       | 0                                       | 0                           | ~8                    |

---

## CommunityPage (`pages/CommunityPage.tsx`)

### 1. Header

`PageHero` with `title="Community"`, `subtitle="Connect with stable owners…"`, `mood="default"`, `icon={<Globe className="w-7 h-7 text-[var(--gold-400)]" />}`. Breadcrumb passed as `children`.

### 2. Container

`div.max-w-5xl.mx-auto.px-4.sm:px-6.lg:px-8.pb-8` (line 124). No arbitrary widths.

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` applied at the page-level wrapper — this mirrors the responsive gutter convention used by `PageHero` (`max-w-7xl px-4 sm:px-6 lg:px-8`) so gutters stack if the outer layout already provides its own horizontal padding.

### 4. Background

No local background. Relies on `PageHero`'s inline `radial-gradient` orbs and the ambient CSS background of the shell.

### 5. Surfaces

- `glass-panel` used on community cards (line 131), stats banner items (line 190), and the activity feed wrapper (line 201).
- The activity feed wrapper adds redundant explicit `p-6 rounded-2xl` on top of the `glass-panel` token (line 201) — `glass-panel` already carries its own padding and rounding from the global CSS, making this a double-padding violation.
- No `glass-card` or `backdrop-blur` here.

### 6. Radii

`rounded-xl` (icon badge, line 140), `rounded-full` (badge pill, line 135), `rounded-2xl` (activity section, line 201). The activity section's `rounded-2xl` duplicates what `glass-panel` presumably already sets.

### 7. Buttons

No `<button>` elements. All interactive elements are `<Link>` components acting as cards. No Button component instances.

### 8. Tabs

None.

### 9. Forms

None.

### 10. Dialogs/Modals

None.

### 11. Async States

- `isActivityLoading` propagated to `ActivityFeed` via prop (line 213). Loading and empty handled inside `ActivityFeed`, not inline.
- `useThreads` total is shown as `'…'` when zero (line 61). `useUnreadCount` and `useClubs` have no explicit error or loading state shown on this page.

### 12. Direct Colors

Approx. 25 raw Tailwind palette classes:

- `text-violet-400` (line 56), `text-celestial-gold` (line 69), `text-emerald-400` (line 83), `text-amber-400` (line 97)
- `bg-violet-500/10 border-violet-500/30` (line 57), `bg-celestial-gold/10 border-celestial-gold/30` (line 70), `bg-emerald-500/10 border-emerald-500/30` (line 84), `bg-amber-500/10 border-amber-500/30` (line 97)
- `hover:border-violet-500/50`, `hover:border-celestial-gold/50`, `hover:border-emerald-500/50`, `hover:border-amber-500/50` (lines 58, 71, 85, 99)
- `bg-celestial-gold/20 text-celestial-gold border border-celestial-gold/30` (line 135, badge)
- `text-white/90`, `text-white/80`, `text-white/70`, `text-white/60`, `text-white/50`, `text-white/40`, `text-white/30` (numerous lines) — 7 distinct white-opacity steps in one file

### 13. Mobile Fixed Elements

None.

---

## ClubsPage (`pages/ClubsPage.tsx`)

### 1. Header

`PageHero` with `title="Clubs"`, `subtitle="Join discipline associations and breed clubs"`, `mood="default"`, `icon={<Users className="w-7 h-7 text-[var(--gold-400)]" />}`. Breadcrumb plus a clubs-count pill passed as `children`.

### 2. Container

`div.max-w-5xl.mx-auto.px-4.sm:px-6.lg:px-8.pb-8` (line 65).

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` at the page wrapper — same pattern as CommunityPage.

### 4. Background

No local background.

### 5. Surfaces

- `glass-panel rounded-lg px-3 py-1.5` on the clubs-count badge in PageHero children (line 58). This adds explicit rounding and padding on top of `glass-panel`, which is the same double-specification pattern seen in CommunityPage.

### 6. Radii

`rounded-xl` (tab container, line 68), `rounded-lg` (individual tab buttons, line 79; count badge, line 58).

### 7. Buttons

Manual `<button role="tab">` elements in the tab nav (lines 75–89). Three buttons, each styled with the bespoke active/inactive class-string. Uses shared `Button` component nowhere in this file (delegated to sub-components).

**Notable:** The tab buttons carry `aria-selected` and `role="tab"` so they are semantically reasonable, but they are not backed by a shared CelestialTabs or GoldTabs abstraction — any future tab visual changes require coordinated edits across at least 3 page files (ClubsPage, MessageBoardPage, MessagesPage).

### 8. Tabs

Manual `<button>` tab row (lines 67–90). Three tabs: Discipline Clubs, Breed Clubs, My Club. Active state: `bg-white/10 text-white/90 shadow-sm`. Inactive: `text-white/40 hover:text-white/70`. Container: `bg-white/5 border border-white/10 rounded-xl`. **Not** using Radix Tabs.

### 9. Forms

None in this file (form fields live in `MyClubTab`).

### 10. Dialogs/Modals

None in this file (modal lives in `TransferLeadershipModal`, rendered inside `MyClubTab`).

### 11. Async States

Loading state for discipline/breed grids delegated to `ClubGrid`. No error UI for the `allData` query (used for total count). If `allData` fails, the count silently renders `0 clubs total`.

### 12. Direct Colors

`text-[var(--cream)]/60`, `text-[var(--cream)]` (CSS vars, not raw palette). Tab states use `bg-white/5`, `bg-white/10`, `text-white/90`, `text-white/40`, `text-white/70`. Approx. 10 raw palette/opacity classes.

### 13. Mobile Fixed Elements

None.

---

## MessageBoardPage (`pages/MessageBoardPage.tsx`)

### 1. Header

`PageHero` with `title="Message Board"`, dynamic subtitle showing thread count and section name, `mood="default"`, `icon={<MessageSquare className="w-7 h-7 text-[var(--gold-400)]" />}`. Breadcrumb + `Button` ("New Post") passed as children.

### 2. Container

`div.max-w-5xl.mx-auto.px-4.sm:px-6.lg:px-8.pb-8` (line 149).

### 3. Outer Padding

Same `px-4 sm:px-6 lg:px-8` pattern as the other pages.

### 4. Background

No local background.

### 5. Surfaces

- `glass-panel` on each thread row (via `ThreadRow`, line 312).
- `glass-panel-heavy rounded-xl p-6` on the new-thread modal panel (line 258). `glass-panel-heavy` is a variant token; it also stacks explicit `rounded-xl p-6` on top.
- Loading skeletons use `glass-panel animate-pulse` (line 189).
- No `backdrop-blur` at this layer (the overlay is `bg-black/60` only, no blur).

### 6. Radii

`rounded-xl` (modal panel, line 258), `rounded-lg` (raw input/textarea, lines 263, 271), `rounded-full` (pinned badge, line 135 via `ThreadRow`), `rounded` (tag chips, line 345 via `ThreadRow`).

### 7. Buttons

- Shared `Button` component: "New Post" (line 138), pagination Prev/Next (lines 231, 242), Cancel/Post Thread inside modal (lines 279, 288).
- **0 raw `<button>` elements** at the page level (all tab `<button>` elements are in the section tab row, lines 160–176, which are raw `<button role="tab">`). Counting the raw tab buttons: **5 raw `<button>` elements** (one per section).
- Total primary-ish actions visible simultaneously: New Post (hero) + Prev + Next + Post Thread + Cancel = 5 `Button` instances at various states.

### 8. Tabs

Manual `<button role="tab">` row for 5 forum sections (general, art, sales, services, venting), lines 151–177. Same container styling as ClubsPage (`bg-white/5 border border-white/10 rounded-xl`) and same active/inactive class recipe. `overflow-x-auto` added for mobile.

### 9. Forms

Modal compose form (lines 255–301):

- Raw `<input>` for thread title (line 262): `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40`
- Raw `<textarea>` for content (line 270): identical recipe, `resize-none h-32`

**No shared input component.** The focus ring is `focus:border-violet-500/40` — raw violet palette, not a design-token focus colour.

### 10. Dialogs/Modals

Page-local `fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4` overlay (line 257). No `backdrop-blur-sm`. No `GameDialog` or `BaseModal`. Dismissal: Cancel button only (no click-outside, no Escape key handler). This is inconsistent with `ComposeModal`, which has click-outside dismissal and `backdrop-blur-sm`.

### 11. Async States

- **Loading:** `animate-pulse` skeleton rows (lines 187–194). Present.
- **Error:** `text-center py-12 text-rose-400/70` (line 198). Present.
- **Empty:** `text-center py-12 text-white/30` (line 204). Present.
- Pagination handles 0-page edge case via `Math.max(1, ...)`.

### 12. Direct Colors

Approx. 30 raw Tailwind palette classes:

- Section accent map: `bg-violet-500/10 border-violet-500/30 text-violet-400`, `bg-pink-500/10…`, `bg-emerald-500/10…`, `bg-amber-500/10…`, `bg-rose-500/10…` (lines 66–71)
- `text-rose-400/70` (error), `text-celestial-gold/70`, `text-celestial-gold` (pinned badge)
- `focus:border-violet-500/40` on raw inputs
- `text-white/90`, `/80`, `/70`, `/60`, `/50`, `/40`, `/30`, `/20` (8 distinct opacity steps)

### 13. Mobile Fixed Elements

None. The modal overlay is fixed but is not a persistent UI element.

---

## MessageThreadPage (`pages/MessageThreadPage.tsx`)

### 1. Header

`PageHero` with dynamic `title` (thread title or "Loading…"), dynamic `subtitle` (post count + section), `mood="default"`, `icon={<MessageSquare className="w-7 h-7 text-[var(--gold-400)]" />}`. Breadcrumb passed as children.

### 2. Container

`div.max-w-4xl.mx-auto.px-4.sm:px-6.lg:px-8.pb-8` (line 113). Narrower than the other pages in this family (`max-w-4xl` vs `max-w-5xl`).

**Violation:** `max-w-4xl` vs the family's dominant `max-w-5xl` — produces a misaligned content column width compared to siblings.

### 3. Outer Padding

Same `px-4 sm:px-6 lg:px-8` convention.

### 4. Background

No local background.

### 5. Surfaces

- `glass-panel` on thread metadata bar (line 123), each post card (line 30 via `PostCard`), and the reply box (line 170).
- `PostCard` avatar: `w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30` (line 34) — raw violet palette for avatar background.
- Loading: `glass-panel animate-pulse h-24` (line 147).
- No `backdrop-blur` anywhere.

### 6. Radii

`rounded-full` (avatar, line 34), `rounded-lg` (textarea in reply box, line 173), `rounded` (tag chip, line 131 inside thread metadata).

### 7. Buttons

- Shared `Button`: "Post Reply" (line 183). One primary action.
- **0 raw `<button>`** elements (the back-link is a `<Link>`, not a button).

### 8. Tabs

None.

### 9. Forms

Reply box inline (lines 172–179):

- Raw `<textarea>` with the standard `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none` recipe.

### 10. Dialogs/Modals

None.

### 11. Async States

- **Loading:** 3× `glass-panel animate-pulse h-24` skeletons (lines 145–148).
- **Error:** `text-center py-12 text-rose-400/70` (line 152).
- **Not found:** `text-center py-12 text-white/30` (line 158).
- Reply box is hidden until thread loads (gated on `!isLoading && thread`).

### 12. Direct Colors

Approx. 20 raw Tailwind palette classes:

- `bg-violet-500/20 border border-violet-500/30 text-violet-300` (avatar, line 34)
- `bg-violet-500/15 text-violet-400 border border-violet-500/20` (OP badge, line 41)
- `text-celestial-gold/60` (pinned icon, line 124)
- `text-rose-400/70` (error state)
- `focus:border-violet-500/40`
- `text-white/80`, `/70`, `/60`, `/50`, `/40`, `/30`, `/20`, `/15` (8 opacity steps)

### 13. Mobile Fixed Elements

None.

---

## MessagesPage (`pages/MessagesPage.tsx`)

### 1. Header

`PageHero` with `title="Messages"`, dynamic subtitle (unread count or "All caught up"), `mood="default"`, `icon={<Mail className="w-7 h-7 text-[var(--gold-400)]" />}`. Breadcrumb + Compose `Button` as children.

### 2. Container

`div.max-w-4xl.mx-auto.px-4.sm:px-6.lg:px-8.pb-8` (line 111).

**Note:** Uses `max-w-4xl` like `MessageThreadPage` — the inbox/DM context is semantically narrower, which may be intentional. But it creates an inconsistency with CommunityPage and ClubsPage (`max-w-5xl`).

### 3. Outer Padding

`px-4 sm:px-6 lg:px-8` standard. The info panel at the bottom (line 258) uses the same container.

### 4. Background

No local background.

### 5. Surfaces

- `glass-panel` for loading skeletons and the info panel at bottom (line 258).
- `MessageRow` wraps each message in a `glass-panel`-bearing `<button>` (see MessageRow).
- The info panel has explicit `p-5 rounded-xl glass-panel` — again stacking explicit padding/radius on the token (line 258).

### 6. Radii

`rounded-xl` (tab container line 114, info panel line 258), `rounded-lg` (individual tab buttons line 127/148/165).

### 7. Buttons

- Shared `Button`: "Compose" in hero (line 98).
- Raw `<button role="tab">` for Inbox, Sent, Notifications (lines 119, 141, 160) — **3 raw tab buttons**.
- Unread badge inside inbox tab: `bg-red-500/80 text-white rounded-full` (line 136).
- Unread badge inside notifications tab: `bg-blue-500/80 text-white rounded-full` (line 175).

**Inconsistency:** Two different badge colours (`red-500/80` vs `blue-500/80`) for the same visual purpose (unread count indicator) within the same tab row.

### 8. Tabs

Manual `<button role="tab">` row (lines 113–180). Three tabs: Inbox, Sent, Notifications. Same structural recipe as ClubsPage and MessageBoardPage. `w-fit` on the container. No Radix Tabs.

### 9. Forms

None in the page file itself. All form fields live in `ComposeModal`.

### 10. Dialogs/Modals

`ComposeModal` rendered conditionally (line 109): `{composeOpen && <ComposeModal onClose={...} />}`. The modal brings its own `fixed` overlay. No `GameDialog` or `BaseModal`.

### 11. Async States

- **Loading:** `glass-panel animate-pulse` skeletons for both message list and notification list (lines 187–197, 219–229).
- **Empty (messages):** Centred icon + text (lines 232–241).
- **Empty (notifications):** Centred icon + text (lines 200–208).
- No explicit error state for inbox or sent list failures (missing `error` handling from the hooks).

### 12. Direct Colors

Approx. 20 raw Tailwind palette classes:

- `bg-red-500/80 text-white` (unread badge, line 136)
- `bg-blue-500/80 text-white` (notifications badge, line 175)
- `text-white/90`, `/80`, `/70`, `/60`, `/50`, `/40`, `/30`, `/20` (throughout)
- `bg-white/5`, `bg-white/10`, `text-white/40`, `text-white/70` (tab states)
- `text-[var(--cream)]`, `text-[var(--text-muted)]` (CSS vars — correct)

### 13. Mobile Fixed Elements

None.

---

## clubs/ClubGrid (`pages/clubs/ClubGrid.tsx`)

### 1. Header / 2. Container / 3. Outer Padding / 4. Background

None (sub-component, no independent layout).

### 5. Surfaces

- `glass-panel` on each club card (line 55), loading skeleton panels (line 32).
- Member status display: hardcoded `w-full py-2 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400` div (line 84) — this is a bespoke "Member" indicator rather than a shared Badge component.

### 6. Radii

`rounded-lg` (member indicator div, line 84).

### 7. Buttons

- Shared `Button` with `size="sm" className="w-full"` for Join Club (line 88).
- **0 raw `<button>`** elements.

### 8–10. Tabs / Forms / Dialogs

None.

### 11. Async States

- Loading: 4× `glass-panel animate-pulse h-40` skeletons (line 32).
- Empty: Centred `Users` icon + `text-sm` message (lines 40–45).
- No error state.

### 12. Direct Colors

`bg-emerald-500/10 border-emerald-500/20 text-emerald-400` (member badge), `text-celestial-gold/60` (leader crown icon), `text-white/90`, `/70`, `/50`, `/40`. Approx. 10 raw palette classes.

---

## clubs/MyClubTab (`pages/clubs/MyClubTab.tsx`)

### 1–4. Header / Container / Padding / Background

None (sub-component).

### 5. Surfaces

- `glass-panel flex items-center gap-3` on each membership row (line 63).
- `glass-panel` on each leaderboard row (line 204).
- Empty state: `p-6 rounded-xl bg-white/3 border border-white/8 text-center` (line 87) — **not** using `glass-panel`, uses a raw background value `bg-white/3` (an arbitrary opacity). This is inconsistent with the `glass-panel` used everywhere else in the family.
- Create-club form: `glass-panel` (line 125).

### 6. Radii

`rounded-xl` (empty state card, line 87), `rounded-lg` (form fields, lines 128, 137, 145, 153).

### 7. Buttons

- Shared `Button`: "Transfer" (line 70), "Create a new club" toggle (line 115), Cancel + Create Club (lines 161, 168).
- **0 raw `<button>`** elements.

### 8. Tabs

None.

### 9. Forms

Create-club inline form (lines 124–186):

- Raw `<input>` (club name, line 127): `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40`
- Raw `<select>` (club type, line 136): same recipe minus placeholder classes
- Raw `<input>` (category, line 144): same recipe as club name
- Raw `<textarea>` (description, line 152): same recipe, `resize-none h-20`

Three raw form controls, none using a shared input component.

### 10. Dialogs/Modals

`TransferLeadershipModal` rendered inline when `transferMembership` is set (line 223). Not using `GameDialog` or `BaseModal`.

### 11. Async States

- No explicit loading or error state for `useMyClubs` in this tab.
- Create-club pending state shown via button label change (`'Creating…'`).

### 12. Direct Colors

`text-celestial-gold/40`, `text-celestial-gold`, `text-white/70`, `/80`, `/60`, `/40`, `/30`, `bg-white/3`, `border-white/8`. Approx. 15 raw palette/opacity classes.

### 13. Mobile Fixed Elements

None.

---

## clubs/ClubElectionsSection (`pages/clubs/ClubElectionsSection.tsx`)

### 1–10. Header through Dialogs

No layout elements, tabs, forms, or modals. A pure pass-through that renders `ElectionCard` per active election with minimal wrapper markup.

### 11. Async States

No explicit loading (relies on `useClubElections` returning `[]` before data arrives — no skeleton). No error state.

### 12. Direct Colors

`text-white/30`, `text-white/50` — 2 raw opacity classes.

---

## clubs/ElectionCard (`pages/clubs/ElectionCard.tsx`)

### 5. Surfaces

- `glass-panel mb-3` outer container (line 27).
- Candidate rows: `p-2 rounded bg-white/3 border border-white/8` (line 81) — again using `bg-white/3` arbitrary value instead of a named token.

### 6. Radii

`rounded` on candidate row (line 81), `rounded` on status badge (lines 32–40).

### 7. Buttons

- Shared `Button`: Nominate (line 44), Submit Nomination (line 59), Vote (line 86).
- **0 raw `<button>`** elements.

### 9. Forms

Raw `<input>` for nomination statement (line 53): `bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40` — uses `rounded` (not `rounded-lg`) and `py-1.5 px-2` (slightly smaller than the family standard `px-3 py-2`), introducing a third subtle size variant.

### 12. Direct Colors

Status badge palette: `bg-emerald-500/15 text-emerald-400`, `bg-amber-500/15 text-amber-400`, `bg-white/10 text-white/40`. `focus:border-violet-500/40`, `text-white/60`, `/80`, `/40`, `/30`. Approx. 10 raw palette classes.

---

## clubs/TransferLeadershipModal (`pages/clubs/TransferLeadershipModal.tsx`)

### 10. Dialogs/Modals

Page-local `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm` overlay (line 50). Has `backdrop-blur-sm` (unlike MessageBoardPage's modal which does not). Panel: `glass-panel w-full max-w-sm p-6 relative` (line 53). **No `GameDialog` or `BaseModal`.**

**This is the third distinct modal pattern in the family** (MessageBoardPage uses `glass-panel-heavy rounded-xl p-6`; ComposeModal uses `glass-panel rounded-2xl`; TransferLeadershipModal uses `glass-panel ... p-6`).

### 5. Surfaces

Success state: `rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400` (line 64).
Error state: `rounded-lg bg-red-500/10 border border-red-500/20 text-red-400` (line 70).
No `backdrop-blur` on the panel itself — only on the overlay.

### 6. Radii

`rounded-lg` (select field, success/error messages).

### 9. Forms

Raw `<select>` (line 80): `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40`.

### 12. Direct Colors

`bg-black/60`, `bg-emerald-500/10 border-emerald-500/20 text-emerald-400`, `bg-red-500/10 border-red-500/20 text-red-400`, `text-celestial-gold`, `text-white/90`, `/70`, `/50`, `/40`. Approx. 8 raw classes.

---

## messages/ComposeModal (`pages/messages/ComposeModal.tsx`)

### 10. Dialogs/Modals

`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4` (line 69) — uses a CSS variable for z-index (`z-[var(--z-modal)]`), unlike other modals which use literal `z-50`. Backdrop: `absolute inset-0 bg-black/60 backdrop-blur-sm` with click-outside dismiss (line 76). Panel: `relative w-full max-w-lg glass-panel rounded-2xl border border-[rgba(200,168,78,0.2)] p-6 space-y-4` (line 82).

**This is the most complete modal implementation** in the family, with: CSS-var z-index, backdrop blur, click-outside close, ARIA `role="dialog" aria-modal="true" aria-label`. Others lack these features.

### 5. Surfaces

Recipient selected state: `px-3 py-2 rounded-lg bg-[rgba(10,22,50,0.5)] border border-[rgba(200,168,78,0.4)]` (line 111) — hardcoded `rgba()` values.
Search results dropdown: `rounded-lg bg-[rgba(10,22,50,0.95)] border border-[rgba(100,130,165,0.25)] shadow-xl` (line 143) — hardcoded `rgba()` values.
Panel border: `border border-[rgba(200,168,78,0.2)]` — hardcoded hex `rgba` instead of CSS variable.

**This component exclusively uses raw `rgba()` hex values for its colour scheme** — a completely different approach from the `bg-white/5 border-white/10` shorthand used in every other file in the family.

### 6. Radii

`rounded-2xl` (panel), `rounded-lg` (fields, search dropdown, close button).

### 7. Buttons

- Shared `Button`: Cancel (line 204), Send (line 206).
- Raw `<button>` for close X (line 91): `p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cream)] hover:bg-white/10`
- Raw `<button>` items inside search dropdown (line 148): one per search result.

Approx. 3 raw `<button>` elements.

### 9. Forms

All three fields use the **divergent rgba recipe**:

- Recipient search `<input>` (line 129): `bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.25)] ... focus:border-[rgba(200,168,78,0.4)]`
- Subject `<input>` (line 168): same recipe
- Content `<textarea>` (line 184): same recipe

`style={{ fontFamily: 'var(--font-heading)' }}` on the title (line 88) — correct use of CSS var for font, but applied as inline style rather than a utility class.

`focus:border-[rgba(200,168,78,0.4)]` (gold focus ring) vs `focus:border-violet-500/40` (violet focus ring) in all other forms in the family — **two different focus ring colours across the family**.

### 11. Async States

- Sending pending: button label change.
- Error: `sendMessage.isError` shown as `text-xs text-[var(--status-error)]` (line 197).
- No loading state for user search beyond a `'…'` spinner character.

### 12. Direct Colors

**Near-zero raw Tailwind palette** — this file uses CSS variables and `rgba()` literals almost exclusively. No `text-white/NN` opacity pattern; uses `text-[var(--cream)]` and `text-[var(--text-muted)]` instead. This is actually more token-compliant than sibling files, but uses raw `rgba()` hex strings rather than registered CSS variables.

Raw `rgba` strings counted: 6 distinct values (`rgba(10,22,50,0.5)`, `rgba(200,168,78,0.2)`, `rgba(200,168,78,0.4)`, `rgba(100,130,165,0.25)`, `rgba(10,22,50,0.95)`) — all as Tailwind arbitrary values, not design tokens.

---

## messages/MessageRow (`pages/messages/MessageRow.tsx`)

### 5. Surfaces

- Row is a `<button>` with `glass-panel hover:bg-white/8` (line 31).
- Selected state: `border-[rgba(200,168,78,0.35)] bg-white/5` (line 33) — raw `rgba()` value for gold border, matching ComposeModal's pattern but inconsistent with the `border-celestial-gold/30` pattern elsewhere.
- Unread state: `border-emerald-500/20` (line 35).
- Sender avatar: `bg-gradient-to-br from-violet-600 to-indigo-700 border border-white/10` (line 53) — raw violet/indigo gradient.

### 6. Radii

`rounded-full` (avatar, line 53), `rounded-full` (tag badge, line 67).

### 7. Buttons

- Row itself is a raw `<button>` (expand/collapse, line 29) — **1 raw command button**.
- This is the primary interaction control; it is not a `Button` component.

### 12. Direct Colors

`from-violet-600 to-indigo-700` (avatar gradient), `border-[rgba(200,168,78,0.35)]`, `border-emerald-500/20`, `fill-emerald-400 text-emerald-400` (unread dot), `text-white/90`, `/80`, `/70`, `/60`, `/40`, `/30`. Approx. 15 raw palette classes.

---

## messages/MessageDetailPanel (`pages/messages/MessageDetailPanel.tsx`)

### 5. Surfaces

`glass-panel border border-[rgba(200,168,78,0.2)] rounded-xl p-5 space-y-3` (line 23) — again stacking explicit rounding, padding, border on top of `glass-panel`, with a raw `rgba()` gold border.

### 6. Radii

`rounded-xl` (explicit on panel, line 23), `rounded-lg` (close button, line 65).

### 7. Buttons

- Raw `<button>` for close X (line 64): `p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cream)] hover:bg-white/10` — **1 raw close button**, identical pattern to ComposeModal's close button.

### 11. Async States

- Loading: `animate-pulse` divs (lines 31–33).
- Error: `text-xs text-[var(--status-error)]` (line 35).
- Loaded: message subject + metadata header.

### 12. Direct Colors

`border-[rgba(200,168,78,0.2)]`, `text-white/75`, `text-white/60`, `text-white/40`, `text-white/10`. Approx. 10 classes.

---

## messages/GameNotifRow (`pages/messages/GameNotifRow.tsx`)

### 5. Surfaces

- Shared `GameNotifShell`: `glass-panel hover:bg-white/8 hover:border-white/20` (line 32).
- Unread border: `border-blue-500/20` (line 29).
- Avatar backgrounds use inline gradient strings:
  - StatGain: `bg-gradient-to-br from-blue-600 to-indigo-700` (line 84)
  - FoalBorn: `bg-gradient-to-br from-pink-600 to-rose-700` (line 105)
  - Unknown: `bg-gradient-to-br from-slate-600 to-slate-800` (line 123)

These gradient class strings duplicate the sender-avatar gradient in `MessageRow` (`from-violet-600 to-indigo-700`) but with different hues per type — no shared avatar token.

### 7. Buttons

None.

### 12. Direct Colors

`border-blue-500/20`, `fill-blue-400 text-blue-400` (unread dot), `from-blue-600 to-indigo-700`, `from-pink-600 to-rose-700`, `from-slate-600 to-slate-800`, badge classes: `bg-blue-500/20 text-blue-400`, `bg-pink-500/20 text-pink-300`, `bg-slate-500/20 text-slate-300`. Approx. 8 raw palette classes.

---

## Cross-Family Violations Summary

| #   | Violation                                                                                                                                                                                             | Files affected                                                                                      | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| V1  | Three distinct modal overlay implementations (`glass-panel-heavy`, `glass-panel rounded-2xl`, `glass-panel ... max-w-sm`) with differing backdrop-blur, z-index strategy, and click-outside behaviour | MessageBoardPage, TransferLeadershipModal, ComposeModal                                             | High     |
| V2  | Two competing raw form field recipes: `bg-white/5 border-white/10 focus:border-violet-500/40` vs `bg-[rgba(10,22,50,0.5)] border-[rgba(100,130,165,0.25)] focus:border-[rgba(200,168,78,0.4)]`        | All form-bearing files vs ComposeModal                                                              | High     |
| V3  | Two focus ring colours: `violet-500/40` (4 files) vs `rgba(200,168,78,0.4)` gold (ComposeModal only)                                                                                                  | MessageBoardPage, MessageThreadPage, MyClubTab, ElectionCard vs ComposeModal                        | High     |
| V4  | Manual `<button role="tab">` tab rows, no shared tab component; same 6-class string duplicated in 3 page files                                                                                        | ClubsPage, MessageBoardPage, MessagesPage                                                           | High     |
| V5  | Unread badge colours inconsistent: `bg-red-500/80` (inbox) vs `bg-blue-500/80` (notifications) in the same tab row                                                                                    | MessagesPage L136, L175                                                                             | Medium   |
| V6  | Container width split: `max-w-5xl` (Community, Clubs, MessageBoard) vs `max-w-4xl` (MessageThread, Messages)                                                                                          | MessageThreadPage, MessagesPage                                                                     | Medium   |
| V7  | `glass-panel` stacked with redundant explicit `p-*` and `rounded-*` in 5 files                                                                                                                        | CommunityPage L201, ClubsPage L58, MessagesPage L258, MessageDetailPanel L23, MessageBoardPage L258 | Medium   |
| V8  | Raw `rgba()` hex strings for colours instead of CSS design tokens or Tailwind shorthand                                                                                                               | ComposeModal (6 occurrences), MessageRow L33, MessageDetailPanel L23                                | Medium   |
| V9  | Bespoke avatar gradient classes (`from-violet-600 to-indigo-700`, etc.) duplicated in MessageRow and GameNotifRow without a shared avatar token                                                       | MessageRow L53, GameNotifRow L84/105/123                                                            | Low      |
| V10 | Empty state in MyClubTab uses `bg-white/3 border-white/8` (non-`glass-panel`) while all other empty/card states use `glass-panel`                                                                     | MyClubTab L87, ElectionCard L81                                                                     | Low      |
