# Equoria Design System — Approved Decisions

**Status:** Adopted for implementation (agent-proposed 2026-06-09; flagged for user ratification — see "Ratification" at bottom)
**Source plan:** `docs/frontend-design-consistency-remediation-plan.md` §14
**Tracking epic:** `Equoria-o5hub`

These are the twelve decisions the remediation plan requires before any
broad migration begins. Each decision names the rule, the rationale, and
the token/class it resolves to. Implementation issues reference this file
as the single source of truth — do not restate widths/radii/colors in
issue text or code comments; link here.

---

## 1. `PageContainer` variants and widths

`DashboardLayout` already owns the outer shell: `max-w-[1440px] mx-auto px-4 md:px-8`
([DashboardLayout.tsx:100](../../frontend/src/components/layout/DashboardLayout.tsx)).
`PageContainer` constrains content _within_ that shell. Variants:

| Variant   | Class               | Width  | Use                                                   |
| --------- | ------------------- | ------ | ----------------------------------------------------- |
| `narrow`  | `max-w-2xl mx-auto` | 672px  | Forms, settings panels, focused account workflows     |
| `content` | `max-w-4xl mx-auto` | 896px  | Standard operational pages, detail reading            |
| `wide`    | `max-w-6xl mx-auto` | 1152px | Grids, marketplaces, rosters, data-rich workflows     |
| `full`    | `w-full`            | shell  | Edge-to-edge tools inside shell gutters (exceptional) |

Rules:

- `PageContainer` never adds horizontal padding (`px-*`). Gutters belong to the shell. Vertical rhythm (`py-*`) is allowed via a `padded` prop.
- Pages must not add their own `max-w-* mx-auto px-*` top-level wrapper. Arbitrary widths (`max-w-[52rem]`, `max-w-5xl`, `max-w-7xl`) are removed during migration.
- Auth routes use `AuthLayout` (not `PageContainer`); its card width is owned by `AuthLayout`.

## 2. The three header families

| Component      | Role                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PageHeader`   | Standard operational page: title (h1), optional subtitle, optional actions slot, optional metadata row, optional breadcrumbs. Compact — no artwork, no orbs. |
| `EntityHeader` | Identity-centered detail pages (horse, foal, club): image/avatar, name, core metadata, entity actions.                                                       |
| `AuthHeader`   | Equoria wordmark + focused auth context. Rendered by `AuthLayout` only.                                                                                      |

`PageHero` is **demoted, not deleted yet**: it becomes the approved
image-backed _location header_ variant (world-service pages with real
artwork: vet, farrier, shops). Default ambient orb decorations and gradient
dividers are removed from it. Operational pages migrate to `PageHeader`.

## 3. Radius scale

The spec tokens already exist in `tokens.css`; the decision is the semantic
mapping plus one change:

| Token / alias                                                       | Value  | Applies to                                             |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `--radius-sm` / `--radius-badge`                                    | 6px    | Badges, stat bars, small chips                         |
| `--radius-md` / `--radius-card` **and `--radius-button` (CHANGED)** | 12px   | Buttons, inputs, selects, small cards                  |
| `--radius-lg` / `--radius-panel`                                    | 16px   | Content panels, framed tools                           |
| `--radius-xl` / `--radius-modal`                                    | 24px   | Modals, feature/hero panels                            |
| `--radius-full` / `--radius-pill`                                   | 9999px | Avatars, status dots, toggles, true pill controls only |

**Change:** `--radius-button` flips from `var(--radius-full)` to
`var(--radius-md)` and the `Button` base drops `rounded-full` (D-09).
A `pill` presentation prop opts back in where pills are semantically right
(compact filter chips, segmented options).

Page code uses only `rounded-[var(--radius-*)]`-backed shared classes or
the primitive components; raw `rounded-2xl`/`rounded-3xl` in page code is a
violation after migration.

## 4. Surface hierarchy and blur policy

One `Surface` primitive with five variants (plan §6.4):

| Variant       | Treatment                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------ |
| `page`        | Unframed band — no border, no bg, spacing/typography only                                  |
| `panel`       | Framed tool: `--glass-bg`, `--glass-border`, `--radius-lg`. May blur **only if outermost** |
| `subtle`      | `--glass-surface-subtle-bg`, no blur, inside an already-framed parent                      |
| `interactive` | Clickable repeated item; the ONLY variant with hover lift/glow + focus-visible ring        |
| `overlay`     | Modal/popover surface: `--glass-surface-heavy-bg`, `--radius-xl`, blur allowed             |

Blur policy (already documented in tokens.css: "Max ONE active
backdrop-filter: blur() layer visible at any time"): blur is owned by
`Surface(panel|overlay)` and the layout footer/nav primitives. Page-local
`backdrop-blur-*` utilities are violations. Nested blurred surfaces convert
to `subtle`.

`.glass-panel:hover` loses its global transform/glow (D-05); the lift moves
to `Surface(interactive)` / `.glass-panel-interactive`.

## 5. Button shape and action hierarchy

- Base shape: rounded rectangle (`--radius-md`), not pill (see #3).
- Variant tiers stay as today's CVA set (`default` gold primary, `secondary` frosted, `outline` tertiary, `ghost`, `link`, `destructive`, `glass`) plus a new `pending` state (spinner replaces content, dimensions preserved) and an `IconButton` wrapper (44px target, required `aria-label`, tooltip).
- **One visually primary (`default`/gold) action per workflow surface** (D-08). Navigation and cancellation are `secondary`/`outline`/`link`. Destructive never uses the gold treatment.

## 6. Canonical tab presentation

One Radix-backed `Tabs` (built on the existing `@radix-ui/react-tabs`
generic component) with two presentation variants:

- `underline` — default for page/section tabs (entity detail, results).
- `segmented` — for compact mode switches (2–4 options, toolbar contexts).

`CelestialTabs` and `GoldTabs` become deprecated adapters and are deleted
once consumers migrate (D-10). Overflow rule: tab lists scroll horizontally
on mobile (no wrapping), with edge-fade affordance.

## 7. Semantic color and text-role model

Color roles map to existing tokens (no new palette):

| Role    | text                                             | bg                          | border              |
| ------- | ------------------------------------------------ | --------------------------- | ------------------- |
| success | `--status-success`                               | `--badge-success-bg`        | derived             |
| warning | `--status-warning`                               | `--badge-warning-bg`        | derived             |
| danger  | `--status-danger`                                | `--badge-danger-bg`         | derived             |
| info    | `--status-info`                                  | `--badge-info-bg`           | derived             |
| accent  | `--gold-primary` (large) / `--gold-light` (body) | `--btn-gold-bg`             | `--btn-gold-border` |
| neutral | `--text-secondary`                               | `--glass-surface-subtle-bg` | `--glass-border`    |

Text roles: `primary` → `--text-primary`, `secondary` → `--text-secondary`,
`muted` → `--text-muted`, `disabled` → muted at 40% (matches Button),
`link` → `--gold-light`, `danger` → `--status-danger`, `inverse` →
`--bg-deep-space` (on gold).

Rules: page code stops using raw Tailwind palette classes
(`text-emerald-400`, `bg-red-500/10`, …) and `text-white/NN` opacity text
(D-11, D-12). Opacity remains legal only for decorative non-text elements.
Data-visualization (charts) gets a documented exception list.

## 8. Canonical dialog base

**Canonical: `GameDialog`** (`frontend/src/components/ui/game/GameDialog.tsx`).
Rationale from Phase 0 inventory: GameDialog is built on Radix Dialog
(focus trap, restoration, Escape, scroll lock come from a maintained
primitive) and already carries the Celestial Night visual treatment;
`BaseModal` is a hand-rolled portal/focus-trap with ~8 component-level
consumers (competition, breeding, foal, leaderboard, trait modals).

Migration: port BaseModal's `size` variants (`sm`–`full`) and footer slot
onto `GameDialogContent`; migrate BaseModal consumers and the page-local
`fixed inset-0` overlays (ListForSaleModal, RiderPickerModal,
MarketplacePage, HorseMarketplacePage, and the `window.confirm()` on
MarketplacePage) to GameDialog; then deprecate BaseModal. Overlay blur
stays solely on `GameDialogOverlay` per the single-blur rule.

## 9. Currency icon and terminology

- Terminology: the game currency is rendered as a coin icon + formatted
  number. UI copy says "coins" in prose; values never mix emoji and text.
- Icon: single shared coin glyph (lucide `Coins` until bespoke art exists).
- `Currency` component variants: `standard`, `compact` (1.2k), `signed`
  (+/− with success/danger role colors), `balance`. Icon-only renders
  include `aria-label` text. `Intl.NumberFormat` for locale-aware digits.

## 10. `/stable` vs `/my-stable`

**Retain both routes; rename to remove ambiguity.** Phase 0 inventory
shows they serve distinct purposes that both deserve to exist:

- `/stable` (`StableView`) — the full horse roster browser → rename title/nav to **"Stable"**.
- `/my-stable` (`MyStablePage`) — stable profile & hall of fame → rename to **"Stable Profile"**.

Both currently title themselves "My Stable" (and the hub dashboard does
too). Renaming is reversible and far lower-risk than a merge; a merge
remains open as a future product decision. Update nav labels, breadcrumbs,
page titles, and tests together (`Equoria-o5hub.20`). Flagged for user
ratification since it is player-facing naming.

## 11. Page-family migration order

Per plan §8 and §12, after foundations (Phases 1–4):

1. Authentication (pilot — small, isolated, worst duplication)
2. World services (Vet/Farrier/Feed/Tack/Grooms/Riders/Trainers/Crafting)
3. Marketplace & economy
4. Community & messaging
5. Stable / dashboard / entity detail
6. Training / breeding / competition
7. Settings & profile
8. Enforcement + legacy removal

## 12. Lint and source enforcement rules (Phase 12)

Adopted in principle; implemented only after canonical primitives exist
(D-29 ordering rule):

- ESLint: no raw Tailwind palette color classes in `frontend/src/pages/**` (allowlist file with owner+expiry).
- Source scans (CI): unsupported `rounded-*` in pages; `backdrop-blur`/`backdropFilter` outside the primitive allowlist; `max-w-(4xl|5xl|6xl|7xl|\[...\])` page wrappers; page-local `fixed inset-0` overlays; `<button` with gradient/size classes (command-style raw buttons).
- Exception registry: `docs/design-system/EXCEPTIONS.md` — owner, justification, expiry; CI fails on expired entries.

---

## Ratification

These decisions were adopted by the implementing agent under the standing
instruction to execute the remediation plan autonomously. They follow the
plan's own recommendations (§6) and the existing UX spec tokens wherever
one canonical option already existed in the codebase. Items #8 and #10
remain explicitly open. The user may overturn any decision here; overturned
decisions get a dated changelog entry rather than silent edits.

| Date       | Change                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-06-09 | Initial adoption (decisions 1–7, 9, 11, 12)                                                                  |
| 2026-06-09 | Decision 8 resolved: GameDialog canonical (Radix-backed); BaseModal deprecated after consumer migration      |
| 2026-06-09 | Decision 10 resolved: retain both stable routes, rename "Stable" / "Stable Profile" (user-ratifiable naming) |
