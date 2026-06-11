# Design-System Inventory — Post-Migration Completion Records

**Updated:** 2026-06-11 (Equoria-o5hub ratchet-to-zero phase)
**Decisions:** [`../DECISIONS.md`](../DECISIONS.md) · **Motion:** [`../MOTION.md`](../MOTION.md) · **Exceptions:** [`../EXCEPTIONS.md`](../EXCEPTIONS.md)

## What this directory is now

These files were originally the Phase 0 **pre-migration scans** (2026-06-09, 8
parallel audit agents) that fed the D-register. All six page families have
since been migrated onto the canonical primitives, so each file has been
**rewritten as a short completion record**: what is canonical in that family
now, the commits that landed it, and what residue legitimately remains.

The live source of truth for residue is the audit script, not these docs:

```bash
node scripts/design-audit/check-design-system.mjs --report   # from repo root
```

The script enforces a one-way ratchet against
`scripts/design-audit/baseline.json` (counts may only go down; expired
`EXCEPTIONS.md` rows fail outright) and runs in the doctrine suite
(`scripts/doctrine-checks/run-all.sh`) and the CI `doctrine-gate`.

## Family files

| File                                             | Family / pages                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [foundation.md](foundation.md)                   | Shell, layout primitives, tokens, Button, tabs, motion policy, audit/ratchet infrastructure |
| [auth.md](auth.md)                               | Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Onboarding                     |
| [world-services.md](world-services.md)           | Vet, Farrier, FeedShop, TackShop, Grooms, Riders, Trainers, Crafting, WorldHub              |
| [marketplace-economy.md](marketplace-economy.md) | MarketplaceHub, Marketplace, HorseMarketplace, HorseTrader, Bank, Inventory, PrizeHistory   |
| [community-messaging.md](community-messaging.md) | Community, Clubs, MessageBoard, MessageThread, Messages                                     |
| [stable-entity.md](stable-entity.md)             | Index (dashboard), StableView, MyStable, HorseDetail, FoalDetail, HorseEquip                |
| [workflow-pages.md](workflow-pages.md)           | Training, Breeding, CompetitionBrowser, CompetitionResults, Leaderboards                    |
| [settings-profile.md](settings-profile.md)       | Settings (+ sections), Profile                                                              |

## The canonical kit (shared by every record)

- **Layout:** `PageContainer` (narrow/content/wide/full, DECISIONS §1),
  `PageHeader` / `EntityHeader` (§2), `PageHero` demoted to an allowlisted
  image-backed location header (`PAGEHERO_ALLOWLIST` in the audit script).
- **Surfaces:** `Surface` (5 variants, §4) — polymorphically typed, so
  `<Surface as={Link} to=...>` typechecks directly.
- **Color/typography:** role tokens (`--role-*-border` etc. in
  `styles/tokens.css`), `text-role-*` / `type-*` utilities in `index.css` (§7).
- **Async states:** `ui/state/*` — PageLoading, SectionLoading, ErrorState,
  InlineError, Skeleton.
- **Forms:** `ui/form/*` — FormField + Input/PasswordInput/NumberInput/
  Select/Textarea/Checkbox/Switch (single `fieldStyles.ts` recipe).
- **Dialogs:** `GameDialog` (Radix; §8). BaseModal is deleted.
- **Tabs:** `CanonicalTabs` (underline/segmented, §6). CelestialTabs deleted.
- **Currency:** `Currency` (coins icon + `Intl.NumberFormat`; §9).
- **Misc:** `IconBox`, `EmptyState`, `IconButton`, Button radius-md + `pill`
  opt-in + `pending` state.
