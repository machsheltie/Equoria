# Workflow Pages Family — Post-Migration Completion Record

**Status:** Migrated at the page level; deepest remaining component burn-down of any family
**Pages:** TrainingPage, BreedingPage (+ `breeding/`), CompetitionBrowserPage, CompetitionResultsPage, ConformationShowsPage, LeaderboardsPage
**Replaces:** the 2026-06-09 pre-migration scan (PageHero everywhere, palette stat-cards, legacy `midnight-ink`/`forest-green` theme, hand-rolled tab bars and CTAs).

## What is canonical now

- **Containers/headers:** Training, Breeding, CompetitionBrowser,
  CompetitionResults, and Leaderboards all use `PageContainer` + `PageHeader`
  (verified by import grep). `ConformationShowsPage` is a thin
  `<Navigate>` redirect to `/competitions?tab=conformation` — the real UI is
  the conformation tab in CompetitionBrowser.
- **Tabs:** CompetitionBrowser, CompetitionResults, BreedingCenter,
  CompatibilityPreview, and LeaderboardCategorySelector use `CanonicalTabs`.
- **Dialogs:** competition modals (Detail, Entry/Results confirmation,
  PrizeNotification, ConformationEntry) and BreedingConfirmationModal are on
  `GameDialog` (BaseModal is deleted).
- **Currency:** prizes/fees through `Currency` (CompetitionResultsPage,
  competition components, leaderboard cards).
- **Charts:** RankHistoryChart, ScoreBreakdownChart, ScoreBreakdownRadar, and
  ColorPredictionChart keep explicit data-viz colors under DECISIONS §7
  exception rows in `../EXCEPTIONS.md` (owner machsheltie, expiry 2026-09-01).

## Family commit

`8336c1158` — workflow/competition/leaderboards family migration
(Equoria-o5hub.21).

## Remaining known residue (baseline-tracked)

- **Breeding:** `pages/breeding/BreedingPairSelection.tsx` — red/emerald
  palette borders + `rounded-2xl` panels (palette-classes,
  unsupported-radius) and literal `$`-prefixed fee text (lines ~486–504; the
  `Currency` migration has not reached this sub-component);
  `BreedingPredictionsPanel.tsx` — red/blue palette error+info panels;
  `components/breeding/BreedingCenter.tsx` / `HorseSelector.tsx` —
  `celestial-input` selects (deprecated-imports).
- **Training:** QuickTrainModal, TrainingConfirmModal, TrainingResultModal,
  TrainingSessionModal still hand-roll `fixed inset-0` overlays
  (fixed-overlay) with `text-white/NN` buttons; TrainingDashboard,
  TrainingResultsDisplay, EligibilityAlternatives, DashboardFilters carry
  text-opacity / `celestial-input` residue.
- **Competition/leaderboard filters:** CompetitionFilters,
  CompetitionHistory, CompetitionResultsList, foal/CategoryFilter,
  LeaderboardCategorySelector use `celestial-input` selects pending the
  `ui/form/Select` sweep.

## Pointers

DECISIONS §1/§2/§6/§7/§8/§9 (`../DECISIONS.md`) · `../MOTION.md` ·
`../EXCEPTIONS.md` ·
`node scripts/design-audit/check-design-system.mjs --report`
