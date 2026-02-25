# Epic 9C Retrospective: Rider System

**Date:** 2026-02-25
**Epic:** Epic 9C - Rider System
**Status:** Completed
**Duration:** ~2 days (2026-02-23 to 2026-02-24)
**Participants:** Heirr (Project Lead), Bob (Scrum Master), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer)

---

## Executive Summary

Epic 9C delivered **5 stories comprising the complete Rider staff system** — personality framework, dashboard, career lifecycle, discovery system, marketplace, and live API wiring. The Rider system is the second staff system in Equoria (after Grooms, Epic 7) and follows the same "Hire → Assign → Discover → Retire" lifecycle pattern.

**Key Achievement:** Epic 9C completed the same scope as Epic 7 (full staff system) in 2 days instead of 11, demonstrating that once a pattern is established, subsequent systems implementing the same pattern take a fraction of the time. Story 9C-5 (API wiring) was originally deferred to a later sprint but was completed the following day.

---

## Epic 9C Completion Summary

### Stories Completed (5/5 — 100%)

**9C-1: Rider Type System & Personality Framework** (P0)

- 4 personality types: `daring` | `methodical` | `intuitive` | `competitive`
- 3 skill levels: `rookie` | `developing` | `experienced` (with visibility rules — rookie shows "Unknown potential")
- Types: `RIDER_PERSONALITY_DATA` record with affinities, badge classes, color classes
- Components: `RiderPersonalityBadge` (sm/md sizes), `RiderPersonalityDisplay` (compact + expanded)
- Mirrors Epic 7's `GroomPersonalityBadge` pattern exactly

**9C-2: Rider Dashboard & Assignment Management** (P0)

- Component: `MyRidersDashboard` with slot counter (N of 5 used) + pip visualization
- Rider cards showing level, totalWins, careerWeeks stats
- `RiderAssignmentCard` with horse name/breed display and unassign button
- Warning banners: unassigned riders (amber), approaching retirement (red)
- Horse picker modal: inline in dashboard (no separate modal component needed)
- Slot cap default: 5 (vs Grooms/Trainers: 4)

**9C-3: Career Lifecycle & Discovery Panels** (P0)

- Types: `riderCareer.ts` — XP formula (`100 * level * (level-1) / 2`), retirement constants, milestone builder
- Types: `riderDiscovery.ts` — 3 categories (discipline_affinity, temperament_compatibility, gait_affinity), 2 slots each = 6 total
- Components: `RiderCareerPanel` with XP progress bar, career stats, retirement warning, legacy badge
- Components: `RiderDiscoveryPanel` with slot grid (undiscovered = `?`) and discovery progress bar
- Retirement: mandatory at 104w; notice window 3w; legacy threshold: prestige ≥80 OR wins ≥50

**9C-4: Rider Marketplace (Hire Tab)** (P0)

- Component: `RiderList` with personality filter + skill level filter + sort (fee/level/experience)
- 4-week upfront cost calculation displayed on each rider card
- Known affinities visible for `experienced` riders only (rookie/developing show `?`)
- Low balance warning when user can't afford next rider
- Empty marketplace state with "Refresh" button
- `RidersPage` with Manage/Hire tab toggle, breadcrumb, World back link

**9C-5: Wire Rider Hooks to Live API** (P1 — completed day after 9C-4)

- Backend: `riderController.mjs` — getUserRiders, getById, assignRider, unassignRider, getRiderAssignments, dismissRider
- Backend: `riderMarketplaceController.mjs` — in-memory Map marketplace pool (6 riders), generate/refresh/hire
- Routes registered in `backend/app.mjs`: `/api/riders` and `/api/riders/marketplace`
- Tests: `riderMarketplace.test.mjs` + `integration/riderAPI.test.mjs` — 18 tests, all passing
- Frontend: `useRiders.ts` hooks wired to live `/api/riders/*` endpoints (replaced mock data)

### Total Deliverables

- **7 components** — RiderPersonalityBadge, RiderPersonalityDisplay, RiderAssignmentCard, MyRidersDashboard, RiderCareerPanel, RiderDiscoveryPanel, RiderList
- **2 type files** — riderCareer.ts, riderDiscovery.ts
- **1 page** — RidersPage
- **2 backend controllers** — riderController, riderMarketplaceController
- **2 backend route files** — riderRoutes, riderMarketplaceRoutes
- **18 backend tests** — riderMarketplace + riderAPI integration
- **Live API** — all 8 endpoints functional

---

## Prior Epic Lessons Applied

### Epic 7 Pattern Reuse ✅ (Massive benefit)

The Groom system (Epic 7) established the pattern; Epic 9C applied it verbatim:

| Groom Pattern           | Rider Equivalent      |
| ----------------------- | --------------------- |
| GroomPersonalityBadge   | RiderPersonalityBadge |
| GroomCareerPanel        | RiderCareerPanel      |
| GroomDiscoveryPanel     | RiderDiscoveryPanel   |
| GroomList (marketplace) | RiderList             |
| MyGroomsDashboard       | MyRidersDashboard     |
| groomCareer.ts          | riderCareer.ts        |
| groomDiscovery.ts       | riderDiscovery.ts     |

**Result:** Epic 9C (same scope as Epic 7) completed in 2 days vs 11 days.

### AI-6-4: Story DoD ✅

All stories verified against ACs before marking complete.

### API Wiring Deferred-Then-Immediate Pattern ✅

9C-5 was originally marked as deferred pending backend readiness. However, following the established backend pattern (groom system as template), the backend was written immediately after 9C-4 rather than waiting for a separate sprint.

---

## What Went Well

### 1. Pattern Leverage (10/10)

**Evidence:**

- Epic 7 → 9C took the same component topology but 5× faster
- Every new component had an equivalent in the groom directory to copy from
- Even the backend controllers used groomController and groomMarketplaceController as templates

**Quote:** "Pattern-first architecture pays dividends in every subsequent system." — Charlie

### 2. Inline Horse Picker Over Separate Modal (9/10)

**Decision:** Rather than creating a separate `AssignRiderModal` component (which would add indirection), the horse picker was built directly into `MyRidersDashboard` as an inline modal.

**Benefit:** Less component overhead. The modal renders inline when a rider's "Assign to Horse" button is clicked, without needing a separate component file.

### 3. Skill Level Visibility Rules (9/10)

**Pattern:** The marketplace shows different information depending on rider skill level:

- `rookie`: affinities hidden (❓)
- `developing`: partial reveal
- `experienced`: full affinities visible

**Result:** Creates a discovery dynamic in hiring — expensive experienced riders offer certainty; cheap rookies are a gamble.

### 4. Retirement System Completeness (8/10)

All edge cases were handled in `riderCareer.ts`: mandatory retirement at 104w, early retirement options, legacy certification threshold, notice window. The type file is the source of truth for all retirement logic.

### 5. 4-Week Upfront Cost Display (8/10)

**Design decision:** Show the 4-week upfront cost rather than weekly fee in the marketplace. This surfaces the real financial commitment and prevents sticker shock.

---

## What Didn't Go Well

### 1. `Horse` Icon Doesn't Exist in Lucide-React (4/10)

**Problem:** Attempted to use `<Horse />` from `lucide-react` in `MyRidersDashboard`. The icon doesn't exist in the library.

**Fix:** Replaced with an emoji `<span>🐎</span>` wrapper.

**Impact:** ~15 minutes of debugging + a note in MEMORY.md.

**Documentation:** Added to MEMORY.md: "Horse icon does NOT exist in lucide-react — use `🐎` emoji span instead."

### 2. AssignRiderModal → Inline Refactor (5/10)

**Problem:** Initially built `AssignRiderModal` as a separate component following the original spec. During implementation it became clear that the separate component added complexity without benefit.

**Fix:** Replaced with inline modal in `MyRidersDashboard`. The separate file was deleted.

**Impact:** ~20 minutes of extra work. The spec was slightly over-architected for the actual need.

### 3. Pre-Existing TS Errors in Frontend (6/10)

**Problem:** `npx vite build` was not used until late — the frontend had ~30 pre-existing TypeScript errors in non-9C files that created build noise.

**Fix:** These are pre-existing (not regressions) and documented. Frontend uses `npx vite build` (skips tsc) rather than `npm run build`.

**Impact:** Misleading error counts; required documentation in MEMORY.md.

---

## Critical Decisions

### Decision 1: Mirror Groom System Architecture Exactly

**Approach:** Every component, type, and backend controller mirrors its Groom equivalent.

**Result:** Consistent codebase. Developer who worked on grooms knows the rider system immediately.

**Verdict:** ✅ Correct. Saved ~9 days vs building from scratch.

### Decision 2: Inline Horse Picker

**Approach:** No `AssignRiderModal` component — the picker is in `MyRidersDashboard` directly.

**Verdict:** ✅ Correct for a <20-line modal. Extract only when modal is complex enough to benefit from isolation.

### Decision 3: Complete API Wiring Same Sprint (Not Deferred)

**Approach:** Once 9C-4 was complete, write the backend immediately rather than marking 9C-5 as "deferred."

**Result:** Rider system fully operational (frontend + backend) before the sprint closed.

**Verdict:** ✅ Correct. Deferral creates debt and prevents testing the full stack.

---

## Metrics

### Velocity

| Story                   | Priority | Tests  | Backend Files Created                                                            |
| ----------------------- | -------- | ------ | -------------------------------------------------------------------------------- |
| 9C-1 Personality System | P0       | –      | –                                                                                |
| 9C-2 Dashboard          | P0       | –      | –                                                                                |
| 9C-3 Career & Discovery | P0       | –      | –                                                                                |
| 9C-4 Marketplace        | P0       | –      | –                                                                                |
| 9C-5 API Wiring         | P1       | 18     | riderController, riderMarketplaceController, riderRoutes, riderMarketplaceRoutes |
| **Total**               |          | **18** | **4 files**                                                                      |

### Quality

- **Stories with 100% AC coverage:** 5/5
- **Backend tests:** 18 (riderMarketplace + riderAPI integration)
- **API endpoints:** 8 (getUserRiders, getById, assign, unassign, getAssignments, dismiss, marketplace GET/POST)
- **Lint errors at commit:** 0
- **Pre-existing TS errors introduced:** 0 (no new regressions)

### Comparison: Epic 7 vs Epic 9C (Same Pattern, Different Speed)

| Metric           | Epic 7        | Epic 9C           |
| ---------------- | ------------- | ----------------- |
| Duration         | ~11 days      | ~2 days           |
| Stories          | 7             | 5                 |
| New components   | 9             | 7                 |
| New type files   | 7             | 2                 |
| Backend API      | No (deferred) | Yes (same sprint) |
| Speed multiplier | 1×            | 5.5×              |

---

## Known Issues Discovered

### Rider Retirement Retroactive Warning

`calculateRiderRetirementStatus` uses `careerWeeks` to compute weeks remaining. If `careerWeeks` is populated with a placeholder value (0), all riders appear to have very long careers. Needs real backend careerWeeks data.

### Discovery Panel Always Shows "Undiscovered"

`buildEmptyDiscoveryProfile` generates all-unknown slots. The actual discovery logic runs server-side and hasn't been implemented in the discovery service yet. This is expected — discovery unlocks are a future feature.

---

## Action Items

### AI-9C-1: Implement Rider Discovery Service (Backend)

**Owner:** Charlie (Senior Dev)
**Priority:** P2
**Description:** The `RiderDiscoveryPanel` shows 6 discovery slots but backend service to trigger and record discoveries hasn't been built.

**Acceptance Criteria:**

- [ ] Rider discovery service in backend records unlocked traits
- [ ] `GET /api/riders/:id/discoveries` returns actual discovery state
- [ ] `RiderDiscoveryPanel` renders discovered vs undiscovered slots correctly

---

## Team Sentiment

**Overall Rating:** 9.5/10

**Highlights:**

- "9C took 2 days. 9B took 1 day. Epic 7 took 11 days. We're getting faster." — Bob
- "Pattern-first is the right philosophy. Build one thing perfectly, then replicate." — Charlie
- "The rider personality types add great flavor to the hiring decision." — Alice

**Concern:**

- "Discovery panels are always empty. We should build the backend service soon." — Dana

---

## Conclusion

Epic 9C demonstrated the compounding returns of pattern-first development. The Groom system (Epic 7) cost 11 days; the equivalent Rider system cost 2. Every future staff system (Trainers in Epic 13) will be even faster.

The Rider system is fully operational: players can hire riders from the marketplace, assign them to horses, view their career progress, and the data persists through a live backend API.

**Epic 9C Final State:** ✅ Rider system complete (frontend + backend + tests); all 5 stories done

---

## Next Epic Preview: Epic 10 — World Locations (Service Hubs)

With the navigation architecture (9B) and Riders location card pointing to `/riders` (now functional via 9C), Epic 10 built the remaining world location pages: Vet Clinic, Farrier, Feed Shop, Tack Shop, and wired all four to live backend APIs.
