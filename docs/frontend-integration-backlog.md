# Frontend Integration Backlog

**Created:** 2026-03-27 (Epic 31C Retrospective)
**Purpose:** Track all backend features that need frontend integration. Updated at every backend epic retrospective.
**Status:** Maintained — review at every retro.

---

## ⏸ PAUSED — 2026-04-02

**Decision:** All Epic 31 frontend integration work is formally paused until **Epics 22–30 (Celestial Night Frontend Rebuild) are complete**.

**Rationale:**

- Epic 22 is in progress (22-1 and 22-2 done; 22-3–22-8 backlog)
- Epic 22 establishes the design system (glass panels, game components, navigation) that all subsequent pages must use
- Integrating 31B/C/D/E/F data into pages that will be fully redesigned creates double-work and visual debt
- The conformation frontend work (31B partial, see below) was built on the old pre-Epic-22 styling — it must be re-styled in the Epic 22 context anyway

**Resume trigger:** Epic 30 (Polish, Performance, and Launch) complete — or a dedicated "Epic 31 Frontend Integration" sprint is planned after Epic 24 (HorseDetailPage redesign), since that page is the primary consumer of 31B/C/D data.

**Recommended resume order (unchanged):**

1. Horse Detail Page enrichment (31B + 31C) — integrate with Story 24.2 redesign
2. Temperament display (31D) — HorseCard + HorseDetail + Training UI
3. Coat color display (31E) — HorseCard visual differentiation
4. Conformation shows (31F) — competition browser new section

---

## ⚠ Orphaned Work Audit — 2026-04-02

The following **Epic 31B conformation frontend work was built ahead of schedule** (from old Story 3-5, committed pre-2026-03-28) and is currently wired into the live codebase. It is functional but has **data model mismatches** with the actual Epic 31B backend. Must be corrected when resuming.

### Files Built (Story 3-5 — pre-schedule)

| File                                                      | Status             | Notes                                                                                                                                      |
| --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/hooks/api/useConformation.ts`               | Built — misaligned | Uses 7-region model; missing `topline`; `shoulder` should be `shoulders`                                                                   |
| `frontend/src/lib/utils/conformation-utils.ts`            | Built — usable     | Quality rating, score calc, region descriptions — logic is sound, but region names need updating (`shoulder` → `shoulders`, add `topline`) |
| `frontend/src/components/horse/ConformationScoreCard.tsx` | Built — misaligned | Renders 7 regions; missing `topline` display                                                                                               |
| `frontend/src/components/horse/ConformationTab.tsx`       | Built — wired in   | Imported and rendered in `HorseDetailPage.tsx` line 539 — live in production                                                               |
| `frontend/src/lib/api-client.ts` (partial)                | Built — misaligned | `getConformation` uses 7-region schema; `getBreedAverages` calls non-spec endpoint                                                         |

### Mismatches to Fix Before Re-activating

1. **Field name:** `shoulder` → `shoulders` everywhere (api-client, hook, utils, components)
2. **Missing region:** `topline` must be added to all region arrays and display components
3. **Wrong analysis endpoint:** `getBreedAverages` at `/api/v1/breeds/:id/conformation-averages` — the Epic 31B spec endpoint is `GET /api/v1/horses/:id/conformation/analysis` (breed percentiles). Either verify the `/breeds/:id/conformation-averages` endpoint exists in the backend or replace with the correct path.
4. **Missing hook:** `useConformationAnalysis(horseId)` for the `/conformation/analysis` endpoint — not yet created

### No Gait or Temperament Frontend Work Exists

- No `useGaits` hook, no `GaitTab`, no gait endpoint in api-client — **31C fully deferred**
- No `useTemperamentDefinitions` hook, no temperament badge/display components — **31D fully deferred**
- No coat color display components — **31E fully deferred**
- No conformation show UI — **31F fully deferred**

---

## Epic 31A: Breed Genetic Profile Population

**Backend:** Complete (data population only)
**Frontend Impact:** Minimal

- [ ] No new endpoints — breed data is consumed by backend services only
- [x] No frontend changes required for 31A itself

**Notes:** Breed genetic profiles power conformation, gaits, and temperament systems. Frontend consumers are the API endpoints from 31B/31C/31D.

---

## Epic 31B: Conformation Scoring System

**Backend:** Complete (3 stories)
**Frontend Status:** ⏸ PAUSED — partial work exists with mismatches (see Orphaned Work Audit above)

### API Client Updates (`frontend/src/lib/api-client.ts`)

- [~] `getConformation` exists at `/api/v1/horses/:id/conformation` — **but 7-region schema, needs `shoulders` + `topline`**
- [ ] Add `GET /api/v1/horses/:id/conformation/analysis` — returns breed percentiles and overall score (replace or supplement `getBreedAverages`)

### Horse Detail Page (`frontend/src/pages/HorseDetailPage.tsx`)

- [~] "Conformation" tab exists and is wired — **but displays wrong regions, needs restyling to Epic 22 design system**
- [ ] Visual representation (radar chart or bar chart) — current implementation needs verification
- [ ] Display correct 8-region scores (add `topline`, fix `shoulders`)
- [ ] Display breed percentile ranking from `/conformation/analysis` endpoint
- [ ] Handle legacy horses with null conformation data gracefully
- [ ] Restyle to Celestial Night design system (blocked on Epic 22 completion)

### React Query Hooks

- [~] `useHorseConformation(horseId)` exists — **needs schema correction**
- [ ] Create `useConformationAnalysis(horseId)` hook

---

## Epic 31C: Gait Quality System

**Backend:** Complete (3 stories)
**Frontend Status:** ⏸ PAUSED — not started

### API Client Updates (`frontend/src/lib/api-client.ts`)

- [ ] Add `GET /api/v1/horses/:id/gaits` — returns walk, trot, canter, gallop scores + gaiting array for gaited breeds

### Horse Detail Page (`frontend/src/pages/HorseDetailPage.tsx`)

- [ ] Add "Gaits" tab or section displaying 4 standard gait scores
- [ ] Display gaiting entries for gaited breeds (e.g., "Slow Gait: 85, Rack: 85")
- [ ] Show "Not a gaited breed" or similar for non-gaited breeds (gaiting: null)
- [ ] Handle legacy horses with null gait data gracefully

### React Query Hooks

- [ ] Create `useGaits(horseId)` hook

---

## Epic 31D: Breed Temperament System

**Backend:** Complete (5 stories, 2026-03-31)
**Frontend Status:** ⏸ PAUSED — not started

### New Backend Endpoints

| Endpoint                                     | Auth          | Notes                                                                                    |
| -------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/v1/horses/temperament-definitions` | None (public) | All 11 types with descriptions, training/competition modifiers, best groom personalities |

### New / Changed Response Fields

| Response                      | Field Added                           | Notes                                                                            |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/horses/:id`      | `horse.temperament` (string \| null)  | Already selected by horseModel; null for legacy horses                           |
| `POST /api/v1/training/train` | `temperamentEffects` (object \| null) | `{ temperament, xpModifier, scoreModifier }`                                     |
| Competition results           | Temperament modifier applied          | ✅ Verified in production path (competitionController uses competitionScore.mjs) |

### API Client Updates (`frontend/src/lib/api-client.ts`)

- [ ] Add `GET /api/v1/horses/temperament-definitions` — returns 11 type definitions

### Horse Card (`frontend/src/components/horse/HorseCard.tsx`)

- [ ] Display temperament badge/chip (null = hide gracefully)

### Horse Detail Page (`frontend/src/pages/HorseDetailPage.tsx`)

- [ ] Display temperament with description tooltip (from temperament-definitions endpoint)
- [ ] Show training modifier preview (e.g., "Stubborn: -15% XP, -10% discipline score")
- [ ] Show competition modifier preview (e.g., "Bold: +5% ridden, +2% conformation")
- [ ] Show best groom personality matches (e.g., "Best match: Energetic groom")
- [ ] Handle null temperament (legacy horses) gracefully — hide section or show "Unknown"

### Training UI

- [ ] Show `temperamentEffects` from training response — display modifier applied in session result

### Groom Assignment UI

- [ ] Show synergy prediction when assigning groom to horse (e.g., "+25% bonding: Patient groom + Nervous horse")

### React Query Hooks

- [ ] Create `useTemperamentDefinitions()` hook (no auth required, `staleTime: Infinity` — static data)

### Notes

- `temperament` field is already present in `GET /api/v1/horses/:id` — no new endpoint needed for horse detail
- Legacy horses (pre-31D) have `temperament: null` — handle gracefully everywhere
- Temperament is immutable (birth-assigned) — no edit UI required

---

## Epic 31E: Coat Color Genetics

**Backend:** In progress (31E-1a done, 31E-1b done, 31E-2 through 31E-5 backlog as of 2026-04-02)
**Frontend Status:** ⏸ PAUSED — not started

### Anticipated Frontend Work

- [ ] Display coat color name on HorseCard
- [ ] Genetics viewer on HorseDetailPage (genotype + phenotype)
- [ ] Breeding color prediction UI (Punnett square or probability chart)
- [ ] Visual color swatch or horse silhouette coloring

---

## Epic 31F: Conformation Show Handling

**Backend:** Not started
**Frontend Status:** ⏸ PAUSED — not started

### Anticipated Frontend Work

- [ ] "Conformation Shows" section in competition browser
- [ ] Conformation show entry UI (handler/groom selection)
- [ ] Conformation show results display
- [ ] Age eligibility display (youngstock class at age 1)

---

## Integration Priority (when resuming)

When Epics 22–30 are complete, tackle in this order (integrate with the corresponding redesign epic where applicable):

1. **Horse Detail Page enrichment (31B + 31C)** — integrate alongside or after Story 24.2 (Horse Detail Page Redesign); fix schema mismatches in existing 31B files before re-styling
2. **Temperament display (31D)** — HorseCard chip + HorseDetail section + Training UI modifier display
3. **Coat color display (31E)** — HorseCard swatch; HorseDetail genetics tab; Breeding prediction panel
4. **Conformation shows (31F)** — new section in competition browser (after Epic 25)

---

**Last Updated:** 2026-04-02
**Updated By:** Audit session — orphaned 31B work documented, all 31 frontend integration formally paused pending Epics 22–30
**Next Review:** When Epic 24 (Horse Card and Detail Redesign) is being planned
