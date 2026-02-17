# Story 7.7: Show Handling & Rare Traits

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G7, FR-R1, FR-R2, FR-R3, FR-R4
**Epic:** 7 (Groom System)
**Priority:** P1

---

## User Story

As a **player**,
I want to **see my groom's show handling capabilities and rare trait bonuses**,
So that **I can make informed decisions about competitions and trait development**.

---

## Acceptance Criteria

### AC1: Show handler scoring weights displayed ✅

**Given** I am viewing groom details
**When** I open the show handler panel
**Then** I see the conformation show scoring breakdown

- Conformation (65%), Handler Skill (20%), Bond Score (8%), Temperament Synergy (7%)
- Weights displayed as labeled progress bars
- Handler bonus range shown per skill level (e.g., "5% – 10%" for novice, "15% – 25%" for master)
- Panel `aria-label` includes groom name for accessibility

### AC2: Discipline synergy shown ✅

**And** discipline synergy is shown

- Personality synergy disciplines listed (e.g., calm → Dressage, Fine Harness, Vaulting)
- Synergy bonus shown as "+X%"
- Specialty disciplines listed (e.g., showHandling → Dressage, Show Jumping, Hunter, ...)
- "Conformation specialist" badge shown for `showHandling` specialty
- "This groom excels as a conformation show handler" highlight for show handling specialty
- Graceful fallback when specialty has no specific discipline bonus

### AC3: Bonus traits displayed ✅ (FR-R1/R2)

**Given** I am viewing groom bonus traits
**When** I open the rare trait panel
**Then** I see up to 3 bonus traits with their percentages

- Each trait shown with name and "+X%" bonus
- Trait count badge ("2 / 3 traits")
- Empty slot indicators for remaining capacity
- "No bonus traits assigned" when map is null/empty
- Sparkle icon per bonus trait

### AC4: Eligibility requirements shown ✅ (FR-R3)

**And** eligibility requirements are shown

- Bond score requirement (≥60) shown with pass/fail icon
- Assignment coverage requirement (≥75%) shown with pass/fail icon
- Overall eligibility status banner ("Eligible for bonus" or reason text)
- Section hidden when eligibility not provided

### AC5: Total rare trait probability shown ✅ (FR-R4)

**And** total rare trait probability is shown

- Total bonus percent displayed (sum of all trait bonuses, e.g., "+40%")
- "0%" shown when no traits assigned
- Educational note: bonus traits only apply to randomized (not guaranteed) traits

---

## Implementation

### Files

| File                                                      | Status      | Notes                                                                                   |
| --------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `frontend/src/types/groomShowHandler.ts`                  | ✅ Complete | Handler skill bonuses, personality synergy, specialty bonuses, scoring weights, helpers |
| `frontend/src/types/groomBonusTrait.ts`                   | ✅ Complete | Bonus trait types, constants (max 3, max 30%, bond 60, coverage 75%), helpers           |
| `frontend/src/components/groom/GroomShowHandlerPanel.tsx` | ✅ Complete | Handler panel with scoring breakdown, personality/specialty synergy                     |
| `frontend/src/components/groom/GroomBonusTraitPanel.tsx`  | ✅ Complete | Bonus trait panel with eligibility, total probability, empty slots                      |

### Tests

| Test File                                  | Tests   | Status         |
| ------------------------------------------ | ------- | -------------- |
| `GroomShowHandlerPanel.story-7-7.test.tsx` | 120/120 | ✅ All passing |

**Total tests for Story 7-7:** 120 passing (483 combined with Stories 7-1 through 7-6)

---

## Completion Notes

- `groomShowHandler.ts`: `HANDLER_SKILL_BONUSES` — novice (5–10%), intermediate (8–15%), expert (12–20%), master (15–25%)
- `CONFORMATION_SHOW_WEIGHTS`: 65% conformation, 20% handler, 8% bond, 7% temperament (sum = 1.0)
- `PERSONALITY_DISCIPLINE_SYNERGY`: 6 personality types with beneficial disciplines and bonus
- `SPECIALTY_DISCIPLINE_BONUSES`: showHandling 6%, racing 7%, western 6%, training 5%, foalCare 2%, general 1%
- `groomBonusTrait.ts`: `BONUS_TRAIT_CONSTANTS` — max 3 traits, max 30% per trait, bond ≥ 60, coverage ≥ 75%
- `GroomShowHandlerPanel` props: `groom: GroomHandlerData`
- `GroomBonusTraitPanel` props: `groom: GroomBonusTraitData`, `eligibility?: BonusEligibility`
- Eligibility section is optional — hidden when not provided (e.g., in non-assignment contexts)
- Unused `vi` import removed from test file to satisfy `@typescript-eslint/no-unused-vars` lint rule
