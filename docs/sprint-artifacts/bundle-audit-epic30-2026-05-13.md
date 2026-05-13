# Bundle Size Audit — Epic 30 Post-Implementation

**Date:** 2026-05-13  
**Issue:** Equoria-rtx0  
**Tool:** Vite 7.3.2 + rollup-plugin-visualizer (dist/bundle-stats.html)

---

## Budget

| Metric                   | Budget   | Actual        | Status  |
| ------------------------ | -------- | ------------- | ------- |
| Initial chunk (index.js) | < 400 KB | **385.31 kB** | ✅ PASS |
| Initial chunk (gzipped)  | —        | 116.11 kB     | ✅      |

Budget defined in tech spec: ≤ 400 KB after Cinzel fonts (~60 KB), 13 new custom components, and PageBackground additions from Epic 22–30.

---

## Full Chunk Inventory (build output 2026-05-13)

### Entry / Eager Chunks

| Chunk              | Raw           | Gzip          | Notes                                               |
| ------------------ | ------------- | ------------- | --------------------------------------------------- |
| `index.js`         | 385.31 kB     | 116.11 kB     | **Main entry — app shell, layout, auth, providers** |
| `index.css`        | 152.31 kB     | 24.91 kB      | Includes Cinzel font faces + all Tailwind utilities |
| `vendor-react`     | 21.07 kB      | 7.93 kB       | React + react-dom + react-router-dom                |
| `vendor-query`     | 37.87 kB      | 11.22 kB      | @tanstack/react-query (QueryClientProvider eager)   |
| `vendor-radix`     | 82.79 kB      | 27.75 kB      | Radix UI primitives (DashboardLayout nav uses them) |
| `vendor-icons`     | 32.40 kB      | 11.67 kB      | lucide-react (nav-items.tsx eagerly imports icons)  |
| **Eager JS total** | **559.44 kB** | **174.68 kB** | All JS loaded before first render                   |

### Large Lazy Chunks (loaded on demand)

| Chunk                     | Raw       | Gzip      | Concern                                             |
| ------------------------- | --------- | --------- | --------------------------------------------------- |
| `vendor-charts`           | 392.83 kB | 114.12 kB | recharts — lazy ✅, but huge when charts page loads |
| `HorseDetailPage`         | 286.13 kB | 84.74 kB  | ⚠️ Largest page chunk — see below                   |
| `CompetitionBrowserPage`  | 53.06 kB  | 12.92 kB  | Lazy ✅                                             |
| `CompetitionResultsModal` | 50.89 kB  | 12.03 kB  | Lazy ✅                                             |
| `GroomsPage`              | 43.14 kB  | 10.49 kB  | Lazy ✅                                             |
| `BreedingPage`            | 36.70 kB  | 9.35 kB   | Lazy ✅                                             |
| `TrainingPage`            | 36.47 kB  | 9.38 kB   | Lazy ✅                                             |
| `RidersPage`              | 34.89 kB  | 9.38 kB   | Lazy ✅                                             |
| `TrainersPage`            | 32.58 kB  | 8.61 kB   | Lazy ✅                                             |
| `LeaderboardsPage`        | 28.83 kB  | 7.14 kB   | Lazy ✅                                             |

All other page chunks: < 25 kB each.

---

## Findings

### 1. Budget: PASS

The initial chunk at **385.31 kB** is 14.69 kB under the 400 KB budget. No code splitting is required at this time.

### 2. HorseDetailPage (286.13 kB) — Lazy but Too Large

`HorseDetailPage.tsx` is 2349 lines importing 20+ components and hooks:

- lucide-react icons (20+ named imports)
- Training flow: DisciplinePicker, TrainingConfirmModal, TrainingResultModal, ScoreProgressionPanel
- Genetics: useHorseEpigeneticInsights, useHorseTraitInteractions, useHorseTraitTimeline
- Chart: StatProgressionChart → recharts pulls vendor-charts into this chunk's co-load path

**Recommendation (backlog):** Decompose HorseDetailPage into tab-specific lazy sub-panels (Training tab, Genetics tab, Conformation tab). Each would lazy-load on tab selection. This would reduce the HorseDetailPage chunk to ~80–100 kB core and distribute the rest on demand.

### 3. Vendor-charts (392.83 kB) — Lazy, No Action Needed

recharts is only used in subcomponents of lazy-loaded pages (ScoreBreakdownChart, ScoreRadarChart, TraitHistoryTimeline, FoalMilestoneTimeline, StatProgressionChart). All are behind React.lazy, so vendor-charts does not load on initial visit. ✅

### 4. Eager-Loading Candidates (future pressure relief)

If future features push the initial chunk toward 400 KB, these App.tsx imports are good lazy-load candidates:

| Component             | Lines | Behavior                                   | Lazy-load trigger                       |
| --------------------- | ----- | ------------------------------------------ | --------------------------------------- |
| `WhileYouWereGone`    | 215   | Overlay shown after 4+ hour absence        | `isAuthenticated && absenceExceeds(4h)` |
| `OnboardingSpotlight` | 286   | Spotlight shown when onboarding incomplete | `completedOnboarding === false`         |

Converting both to lazy would save an estimated 15–25 kB from the initial chunk. **Not required now**, but a clear path if budget tightens.

### 5. CSS (152.31 kB) — Expected

Includes Cinzel font faces from Google Fonts (two weights, ~60 kB per spec estimate) + all Tailwind utility classes generated by Epic 22–30 components. This aligns with the tech spec's accounting.

---

## Action Required

None. Budget passes. Two follow-up issues to file:

1. **Decompose HorseDetailPage tabs** (backlog) — P4 — reduce 286 kB chunk
2. **Lazy-load WhileYouWereGone + OnboardingSpotlight** (backlog) — P4 — buffer against future budget pressure

---

## Reproduction

```bash
cd frontend
npm run build
# Opens dist/bundle-stats.html for interactive treemap view
# Initial chunk: dist/assets/index-*.js
```
