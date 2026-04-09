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

**Backend:** Complete (6 stories, 2026-04-09)
**Frontend Status:** ⏸ PAUSED — not started

### New Backend Endpoints

| Endpoint                                 | Auth             | Returns                                                                                                         |
| ---------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/horses/:id/genetics`        | requireOwnership | `{ horseId, horseName, colorGenotype, phenotype }` — full genetics including allele pairs per locus             |
| `GET /api/v1/horses/:id/color`           | requireOwnership | Display fields only: colorName, shade, faceMarking, legMarkings, advancedMarkings, modifiers (no colorGenotype) |
| `POST /api/v1/breeding/color-prediction` | Auth required    | Probability breakdown by phenotype for a sire × dam cross                                                       |

### New / Changed Response Fields

| Response                      | Field Added                            | Notes                                                                                                |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /api/v1/horses/:id`      | `horse.phenotype` (object \| null)     | `{ colorName, shade, faceMarking, legMarkings, advancedMarkings, sooty, flaxen, pangare, rabicano }` |
| `GET /api/v1/horses/:id`      | `horse.colorGenotype` (object \| null) | Full 17-locus allele pairs — not shown to players, for breeding prediction only                      |
| `POST /api/v1/breeding/breed` | `foal.colorGenotype`                   | Generated at foal creation                                                                           |
| `POST /api/v1/breeding/breed` | `foal.phenotype`                       | Calculated from colorGenotype at foal creation                                                       |

### Lethal Combination UX Design Notes

Some genotypes are lethal (cause foal death in reality). The backend filters these from breeding predictions and renormalizes probabilities. The frontend does NOT need to warn about individual lethal genotypes — they are invisible to players. However, if a cross has an unusually low foal survival probability (renormalization reduced totals by >5%), consider displaying: "Some color combinations from this cross are not viable — displayed probabilities reflect live-foal outcomes only."

Known lethal combinations (backend-filtered, player-invisible):

- `O/O` (Splashed White homozygous)
- `W20/W20` (specific White allele homozygous)
- `SW3/SW3` (Splashed White 3 homozygous)
- `EDXW1/EDXW1` (Extension dominant white homozygous)

### API Client Updates (`frontend/src/lib/api-client.ts`)

- [ ] Add `getHorseGenetics(horseId: number)` — returns `{ colorGenotype, phenotype }` or null for legacy
- [ ] Add `getHorseColor(horseId: number)` — returns display color object or null for legacy
- [ ] Add `getBreedingColorPrediction(sireId: number, damId: number)` — returns probability map by phenotype name
- [ ] Add `phenotype` to `HorseSummary` interface (already done in `61a5c708` — verify it's complete)

### HorseCard (`frontend/src/components/horse/HorseCard.tsx`)

- [ ] Display `horse.phenotype.colorName` as color chip/badge (null = hide gracefully, no "Unknown")
- [ ] Display shade variant as subtitle under color name (e.g., "Bay" + "Dark Bay")
- [ ] Consider small color swatch circle using CSS color approximation (not blocking)

### Horse Detail Page (`frontend/src/pages/HorseDetailPage.tsx`)

- [ ] Add "Genetics" tab (or "Color & Genetics" section within existing tabs)
- [ ] Display full phenotype: base color, shade, face marking, leg markings, advanced markings
- [ ] Display boolean modifiers: sooty, flaxen (chestnut only), pangare, rabicano — as chips when true
- [ ] Display colorGenotype as collapsible "Advanced / Breeding" section (locus-by-locus allele pairs)
- [ ] Legacy horse handling: if phenotype is null, show "Color genetics not available for this horse" — do NOT show "Unknown"
- [ ] Handle JSONB type guard on client side: if response.data is null, render legacy message

### Breeding Color Prediction UI

- [ ] In breeding pair selection modal/page, add "Color Prediction" panel after sire + dam are selected
- [ ] Call `getBreedingColorPrediction(sireId, damId)` when both are selected
- [ ] Display probability chart (bar chart or donut) sorted by probability descending
- [ ] Group low-probability outcomes (<1%) as "Other colors: X%"
- [ ] If any lethal filtering occurred (backend indicates via `lethalFilterApplied: true`), show disclaimer note
- [ ] Legacy horse handling: if sire or dam has no colorGenotype, show "Color prediction unavailable — one or both horses have no genetics data"

### React Query Hooks

- [ ] Create `useHorseGenetics(horseId)` — wraps `getHorseGenetics`, `staleTime: 10 * 60 * 1000` (immutable after generation)
- [ ] Create `useHorseColor(horseId)` — wraps `getHorseColor`, `staleTime: 10 * 60 * 1000`
- [ ] Create `useBreedingColorPrediction(sireId, damId)` — enabled only when both IDs present, `staleTime: 5 * 60 * 1000`

### Performance Notes

- colorGenotype is a 17-locus JSON object (~500 bytes) — not heavy, but avoid fetching it on list views
- The `/color` endpoint returns only display fields and is the correct endpoint for HorseCard and HorseDetail display
- The `/genetics` endpoint should only be called when the player explicitly opens the genetics/breeding section
- Breeding prediction uses per-locus Punnett square algorithm (not brute-force) — backend is O(loci × 4) not O(2^loci)

### Notes

- `phenotype` is available in `GET /api/v1/horses/:id` — no separate call needed for basic color display
- colorGenotype is immutable (birth-assigned) — no edit UI required
- `staleTime: Infinity` is appropriate for colorGenotype and phenotype — they never change after generation
- Legacy horses (pre-31E) have `colorGenotype: null` and `phenotype: null` — handle gracefully everywhere; never show "Unknown"

---

## Epic 31F: Conformation Show Handling

**Backend:** Complete (3 stories, 2026-04-09)
**Frontend Status:** ⏸ PAUSED — not started

### Anticipated Frontend Work

- [ ] "Conformation Shows" section in competition browser (separate from ridden shows)
- [ ] Conformation show entry UI (handler + groom selection, eligibility check)
- [ ] Age eligibility display (youngstock class at age 1; open class requires age 3+)
- [ ] Conformation show results display (score breakdown, rank, title earned)
- [ ] Title progression display on HorseCard/HorseDetail (currentTitle field)
- [ ] Handler/groom synergy preview in entry modal

---

## Integration Priority (when resuming)

When Epics 22–30 are complete, tackle in this order (integrate with the corresponding redesign epic where applicable):

1. **Horse Detail Page enrichment (31B + 31C)** — integrate alongside or after Story 24.2 (Horse Detail Page Redesign); fix schema mismatches in existing 31B files before re-styling
2. **Temperament display (31D)** — HorseCard chip + HorseDetail section + Training UI modifier display
3. **Coat color display (31E)** — HorseCard swatch; HorseDetail genetics tab; Breeding prediction panel
4. **Conformation shows (31F)** — new section in competition browser (after Epic 25)

---

**Last Updated:** 2026-04-09
**Updated By:** Epic 31E retrospective — full 31E frontend spec added, 31F backend status corrected to complete
**Next Review:** When Epic 24 (Horse Card and Detail Redesign) is being planned
