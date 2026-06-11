# Foundation — Post-Migration Completion Record

**Status:** Complete (Equoria-o5hub Phases 1–4 + enforcement)
**Replaces:** the 2026-06-09 pre-migration scan of the shell/primitives.

## What is canonical now

- **Containers:** `components/layout/PageContainer.tsx` — narrow/content/wide/full
  variants per DECISIONS §1; no horizontal padding (gutters belong to
  `DashboardLayout`'s `max-w-[1440px] mx-auto px-4 md:px-8` shell).
- **Headers:** `PageHeader` (operational pages), `EntityHeader` (identity
  detail), `AuthLayout`'s header (auth). `PageHero` survives only as the
  image-backed location header — enforced via `PAGEHERO_ALLOWLIST` in the
  audit script (Vet, Farrier, FeedShop, TackShop, Crafting, WorldMap, WorldHub).
- **Surfaces:** `components/ui/Surface.tsx` — page/panel/subtle/interactive/
  overlay (DECISIONS §4). Polymorphically typed (`as?: React.ElementType` with a
  generic call signature), so `<Surface as={Link} to=...>` typechecks. Hover
  lift lives only on `interactive` / `.glass-panel-interactive`.
- **Color/typography:** semantic role tokens in `styles/tokens.css`, including
  the translucent `--role-{success,warning,danger,info,accent,neutral}-border`
  tokens (lines ~568–594) — use these for role borders, never
  `border-[var(--x)]/30` (Tailwind cannot opacity-modify `var()` colors).
  `text-role-*` and `type-*` (page-title/entity-title/section-heading/
  card-title/label) utilities live in `index.css` (~lines 169–248).
- **Buttons:** `ui/button.tsx` — `--radius-md` base, `pill` opt-in, `pending`
  state, horseshoe arcs opt-in via `btn-arcs`; `IconButton` (44px, required
  `aria-label`).
- **Tabs:** `ui/game/CanonicalTabs.tsx` (underline/segmented). CelestialTabs is
  deleted; `GoldTabs` remains as CanonicalTabs' tokenized Radix foundation
  (explicitly NOT deprecated — see its header comment).
- **Dialogs:** `ui/game/GameDialog.tsx` is the only dialog base; `BaseModal`
  is deleted (no file in `components/common/`, zero imports).
- **Async states:** `ui/state/*`; **forms:** `ui/form/*` (`fieldStyles.ts` is
  the single tokenized field recipe, derived from `.celestial-input`).
- **Motion:** `../MOTION.md` (D-28) + `motionPolicy.sentinel.test.ts`.
- **Enforcement:** `scripts/design-audit/check-design-system.mjs` + ratcheted
  `baseline.json`, wired into the doctrine suite and CI doctrine-gate, with the
  expiring registry at `../EXCEPTIONS.md`.

## Family commits

`7d2b636d3` (PageContainer, .2) · `1eec72c2c` (PageHeader/EntityHeader, .3) ·
`d5fe9a01b` (Surface + blur normalization, .7) · `4ac404093` (role tokens, .6) ·
`59e0a9420` (Button radius/pending/IconButton, .10) · `fbfdaea0d`
(typography roles + IconBox, .8) · `7e7cfaa0b`/`2a6b9b65a` (CanonicalTabs, .11) ·
`8f375faad`/`3c9579457` (GameDialog + BaseModal deletion, .13) · `346311dcf`
(Currency, .14) · `03e4c5542` (async-state primitives, .15) · `4dd286e22`
(form controls, .12) · `098b2acc5` (motion policy, .9/.26) · `5155195f7`
(bottom-action slot, .5) · `9a777268e`/`9e1bc7149`/`9d6521874` (audit + ratchet

- Surface polymorphic typing + doctrine check, .23).

## Remaining known residue (baseline-tracked)

- `fixed-overlay` matches inside the primitives themselves are the **owners**
  of the pattern, not violations to migrate: `GameDialog.tsx` (the canonical
  overlay), `NavPanel.tsx`, `ArtStage.tsx` (fullscreen art layer),
  `GallopingLoader.tsx` (+ a comment line in `ui/state/PageLoading.tsx`).
- Celebration/feedback overlays (`CinematicMoment`, `LevelUpCelebrationModal`,
  `PrizeNotificationModal`, `hub/WhileYouWereGone`) still hand-roll
  `fixed inset-0` + `text-white/NN` — tracked in the burn-down.
- `GlassInput`/`GlassTextarea` (`ui/game/`) still apply `.celestial-input`
  directly; they count under `deprecated-imports` until consumers finish
  moving to `ui/form/*`.

Run `node scripts/design-audit/check-design-system.mjs --report` for the live list.
