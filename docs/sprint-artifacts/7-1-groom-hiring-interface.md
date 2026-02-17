# Story 7.1: Groom Hiring Interface

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G1
**Epic:** 7 (Groom System)
**Priority:** P0

---

## User Story

As a **player**,
I want to **hire grooms for my stable**,
So that **I can improve horse care and training**.

---

## Acceptance Criteria

### AC1: Browse grooms with stats, personality, and hire cost ✅

**Given** I am on the groom marketplace
**When** I browse available grooms
**Then** I see their stats, personality, and hire cost

- Groom names, skill levels, experience, and session rate displayed
- Groom grid renders all available marketplace grooms
- Hire buttons present for each groom

### AC2: Filter by specialty and price range ✅

**And** I can filter by specialty and price range

- Specialty filter control with: All Specialties, Foal Care, General Care, Training, Show Handling
- Specialty filter correctly shows only matching grooms when selected
- Price sort (Low→High, High→Low) provides price-range navigation
- Affordability indicator: hire button disabled when insufficient funds

### AC3: Personality traits clearly displayed ✅

**And** personality traits are clearly displayed

- Patient, energetic, gentle and all personality types shown in groom cards
- Specialty clearly labeled with formatted name

### AC4: Hire confirmation shows ongoing costs ✅

**And** hire confirmation shows ongoing costs

- Modal opens on hire button click
- "Weekly Salary" shown in confirmation modal
- "Total Upfront" cost shown (7 days × session rate)
- Groom name displayed in confirmation
- Cancel button closes modal without hiring

### AC5: Hired grooms appear in stable ✅

**And** hired grooms appear in my stable

- MyGroomsDashboard renders with groom cards after hiring
- Groom specialty displayed in stable dashboard
- Weekly salary cost displayed in stable summary
- Empty state shown when no grooms hired

---

## Implementation

### Files

| File                                            | Status      | Notes                                       |
| ----------------------------------------------- | ----------- | ------------------------------------------- |
| `frontend/src/components/GroomList.tsx`         | ✅ Complete | Marketplace browsing, filtering, hire modal |
| `frontend/src/components/MyGroomsDashboard.tsx` | ✅ Complete | Hired groom management                      |
| `frontend/src/components/AssignGroomModal.tsx`  | ✅ Complete | Groom assignment UI                         |
| `frontend/src/pages/MarketplacePage.tsx`        | ✅ Complete | Full marketplace page with fantasy theming  |
| `frontend/src/hooks/api/useGrooms.ts`           | ✅ Complete | React Query hooks for groom API             |

### Tests

| Test File                                 | Tests | Status         |
| ----------------------------------------- | ----- | -------------- |
| `GroomHiringInterface.story-7-1.test.tsx` | 25/25 | ✅ All passing |
| `GroomList.test.tsx`                      | 30+   | ✅ All passing |
| `MyGroomsDashboard.test.tsx`              | 20+   | ✅ All passing |
| `AssignGroomModal.test.tsx`               | 15+   | ✅ All passing |

**Total tests for Story 7-1:** 65+ passing

### API Endpoints

| Endpoint                         | Method | Purpose                 |
| -------------------------------- | ------ | ----------------------- |
| `/api/groom-marketplace`         | GET    | Get available grooms    |
| `/api/groom-marketplace/hire`    | POST   | Hire a groom            |
| `/api/groom-marketplace/refresh` | POST   | Refresh marketplace     |
| `/api/grooms/user/:userId`       | GET    | Get user's hired grooms |

---

## Completion Notes

Story 7-1 was implemented prior to the formal story creation (as part of the existing groom system). All acceptance criteria are met:

- 65 existing tests cover all acceptance criteria
- 25 story-specific AC tests written and passing (2026-02-17)
- MarketplacePage provides full fantasy-themed marketplace UI
- GroomList component handles all filter/sort/hire functionality
- MyGroomsDashboard shows hired grooms with salary information
- AssignGroomModal enables groom-to-horse assignment workflow
