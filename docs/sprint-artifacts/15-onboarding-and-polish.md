# Epic 15: Onboarding & Polish

**Epic Number:** 15
**Title:** Onboarding & Polish
**Priority:** P1
**Status:** done
**Created Date:** 2026-02-25
**Target Completion:** 2026-02-26
**Completed Date:** 2026-03-06

---

## Epic Overview

Epic 15 bridges the gap between "feature complete" and "launch ready." The game's core functionality is fully operational (Epics 1–14), but several rough edges remain:

- The frontend has ~30 pre-existing TypeScript errors preventing a clean `npm run build`
- New players have no guided introduction to the game
- Several interactive UI elements are permanently disabled (Feed, Assign Rider, Compose Message, Join Club)
- The JavaScript bundle is ~1.6MB — large for initial load
- Some UI states (loading, error, empty) lack polish

Epic 15 resolves all of these, leaving Equoria in a production-launch-ready state.

---

## Stories

### Story 15-1: TypeScript Build Fix

**Priority:** P0
**Estimated effort:** Small (half-day)
**Prerequisites:** None

**Problem:** `npm run build` in frontend/ runs `tsc && vite build`. The `tsc` step currently fails due to ~30 pre-existing TypeScript errors in non-critical component files. This prevents using `npm run build` for deployment — the Dockerfile uses `npx vite build` as a workaround.

**Goal:** All TypeScript errors resolved so `npm run build` succeeds cleanly.

**Acceptance Criteria:**

- [x] `tsc --noEmit` in frontend/ produces zero errors
- [x] `npm run build` in frontend/ succeeds (tsc + vite build both pass)
- [x] Dockerfile updated to use `npm run build` instead of `npx vite build`
- [x] No functional regressions (existing features all work)
- [x] All TS fixes use proper typing (no `as any` escalation)

**Common error patterns to fix:**

- Missing prop types on component calls
- Implicit `any` in function parameters
- Unused variable declarations
- Type mismatches in API response handling (e.g., `HorseSummary` field names)

---

### Story 15-2: New Player Onboarding Flow

**Priority:** P1
**Estimated effort:** Medium (1–2 days)
**Prerequisites:** None

**Problem:** New players arrive at the game with no horses, no staff, no items, and no guidance. The welcome state is empty and uninviting.

**Goal:** First-time players are guided through the game's core loop with a brief tutorial and starter resources.

**Acceptance Criteria:**

- [x] New user registration triggers `isNewUser: true` flag in auth response
- [x] `OnboardingModal` or welcome page shown on first login
- [x] Onboarding covers: Stable (horses), World Hub (services), Staff (grooms/riders/trainers), Competition
- [x] Starter kit awarded on registration: 1× Training Saddle, 1× Standard Bridle, 500 coins bonus
- [x] Starter horse: new user receives 1 horse auto-generated on registration (age 3, basic stats)
- [x] "Skip tutorial" option available for returning/experienced players
- [x] Onboarding state persisted in user record (`completedOnboarding: true`)
- [x] Second login skips onboarding automatically

**Backend additions:**

- `user.completedOnboarding` boolean field (migration required)
- Starter kit seeded on registration (via registration endpoint)
- Optional: `GET /api/onboarding/status` to check completion state

---

### Story 15-3: Loading & Error States Polish

**Priority:** P1
**Estimated effort:** Small–Medium (1 day)
**Prerequisites:** None

**Problem:** Many pages show raw loading spinners or blank states during data fetching. Error states often show nothing or generic messages. Empty states are inconsistent.

**Goal:** Consistent, polished feedback states across all major pages.

**Acceptance Criteria:**

- [x] **Loading skeletons** on: StableView (horse grid), MyTrainersDashboard, MyRidersDashboard, MyGroomsDashboard, HorseDetailPage
- [x] **Error state components**: Consistent `ErrorCard` with retry button for all useQuery failures
- [x] **Empty states**: All empty states have icon + heading + helpful CTA (e.g., "Get your first horse" → `/world`)
- [x] **Hall of Fame fix**: Empty state shows "No retired horses yet. Horses retire after 80–104 career weeks."
- [x] **Community Hub**: Hall of Fame card links fixed (either build basic `/hall-of-fame` page or link to `/my-stable#hall-of-fame`)
- [x] **Consistent skeleton style**: Use Tailwind `animate-pulse` shimmer on all skeleton elements

---

### Story 15-4: Performance Optimization (Code Splitting)

**Priority:** P1
**Estimated effort:** Medium (1 day)
**Prerequisites:** 15-1 (clean build first)

**Problem:** The frontend JS bundle is ~1.6MB. All routes are loaded eagerly. This slows initial page load, especially on mobile connections.

**Goal:** Reduce initial bundle to under 800KB through route-based code splitting.

**Acceptance Criteria:**

- [x] All major route components converted to lazy loading via `React.lazy()` + `Suspense`
- [x] Routes to lazy-load: BreedingPage, HorseDetailPage, VeterinarianPage, FarrierPage, FeedShopPage, TackShopPage, ClubsPage, MessageBoardPage, MessagesPage, BankPage, InventoryPage, MyStablePage, TrainersPage, RidersPage, GroomsPage, SettingsPage
- [x] Initial bundle < 800KB (verified via `dist/bundle-stats.html`)
- [x] Lighthouse performance score improves to > 0.65 on CI
- [x] Loading spinner shown during lazy route loading (via Suspense fallback)
- [x] No functional regressions

**Implementation pattern:**

```tsx
// Before: import BreedingPage from '@/pages/BreedingPage';
// After:
const BreedingPage = React.lazy(() => import('@/pages/BreedingPage'));
// In router: <Suspense fallback={<PageLoader />}><BreedingPage /></Suspense>
```

---

### Story 15-5: Wire Remaining Disabled Features

**Priority:** P1
**Estimated effort:** Medium (1–2 days)
**Prerequisites:** 15-1

**Problem:** Multiple interactive UI elements are currently disabled (`disabled` attribute, no `onClick` handler) across the game. Players can see these features but can't use them. This creates a "half-built" impression.

**Goal:** Enable all interactive features that have a working backend API.

**Features to enable (by page):**

**Inventory Page:**

- [x] "Equip" button on tack items (call `POST /api/tack-shop/purchase` or a new `POST /api/inventory/equip` endpoint)
- [x] "Use" button on consumable items

**HorseDetailPage Action Bar:**

- [x] "Feed" button: triggers feed shop horse selection flow (opens Feed Shop modal or navigates to `/feed-shop?horseId=X`)
- [x] "Assign Rider" button: opens inline horse-rider assignment flow

**Riders/Trainers/Grooms pages:**

- [x] Hire buttons: all marketplace hire buttons are already wired but confirm they work end-to-end

**Community (lower priority — backend API not yet built):**

- [x] New Post / Compose: show "Coming in next update" toast rather than silent disabled
- [x] Join Club: show "Club membership coming in next update" toast

**Acceptance Criteria:**

- [x] Inventory equip works for tack items (reflected in HorseDetailPage stats)
- [x] Feed action from Horse Detail navigates to Feed Shop with horse pre-selected
- [x] Assign Rider from Horse Detail opens rider picker showing available (unassigned) riders
- [x] All remaining permanently-disabled buttons either work or show informative "coming soon" toast

---

### Story 15-6: UX Polish Pass

**Priority:** P2
**Estimated effort:** Small (half-day)
**Prerequisites:** None

**Problem:** Several small UX issues accumulate into a rough overall experience:

- No visual feedback when adding to cart / confirming actions in world locations
- Mobile viewport: some modals overflow on very small screens
- Settings form: save buttons don't show confirmation feedback
- Navigation: active state highlights missing on some routes
- Tooltip text inconsistent (some say "Coming soon", others say nothing)

**Goal:** Comprehensive final UX audit and polish.

**Acceptance Criteria:**

- [x] **Toast notifications** on all successful mutations (vet booking, feed purchase, tack purchase, farrier booking — confirm they all toast)
- [x] **Settings save**: "Saved ✓" confirmation state after clicking save buttons
- [x] **Tooltip consistency**: All disabled buttons have `title="Coming soon"` or informative message
- [x] **Mobile modals**: Horse picker modal and all inline modals don't overflow viewport on 375px width
- [x] **Nav active states**: All routes in MainNavigation highlight correctly (verify riders, grooms, trainers, world sub-pages)
- [x] **Stable → Horse link**: HorseCard click navigates to HorseDetailPage (verify end-to-end)
- [x] **Back navigation**: All World sub-location pages have working "Back to World" arrow link

---

## Epic Scope Summary

| Story | Title                            | Priority | Effort    |
| ----- | -------------------------------- | -------- | --------- |
| 15-1  | TypeScript Build Fix             | P0       | Small     |
| 15-2  | New Player Onboarding            | P1       | Medium    |
| 15-3  | Loading & Error States Polish    | P1       | Small–Med |
| 15-4  | Performance Optimization         | P1       | Medium    |
| 15-5  | Wire Remaining Disabled Features | P1       | Medium    |
| 15-6  | UX Polish Pass                   | P2       | Small     |

**Total estimated effort:** 4–6 days

---

## Technical Considerations

### Backend additions needed for this epic:

- `user.completedOnboarding` boolean field (15-2)
- Starter horse + starter kit seeded on registration (15-2)
- Optional `POST /api/inventory/equip` endpoint (15-5)

### No breaking changes expected

All Epic 15 work is additive or fixes — no breaking changes to existing APIs, database schema (except adding `completedOnboarding`), or component contracts.

### Test priorities

- **15-1:** `npm run build` + `tsc --noEmit` as CI gates
- **15-2:** Backend test for starter kit seeding; E2E test for onboarding flow
- **15-4:** Bundle size check in CI (`dist/bundle-stats.html` analysis)
- **15-5:** Integration tests for newly-enabled features

---

## Definition of Done

Epic 15 is complete when:

1. `npm run build` succeeds with zero TypeScript errors
2. New player onboarding flow active and tested
3. All loading/error/empty states consistent across the app
4. Initial JS bundle < 800KB
5. All features previously disabled (where backend exists) are now working
6. Toast notifications on all mutations
7. Lighthouse a11y ≥ 0.85 and performance ≥ 0.65 in CI

**When Epic 15 is complete, Equoria is ready for production launch.**
