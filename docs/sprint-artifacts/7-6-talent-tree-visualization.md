# Story 7.6: Talent Tree Visualization

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G6
**Epic:** 7 (Groom System)
**Priority:** P2

---

## User Story

As a **player**,
I want to **develop my groom's talents**,
So that **they gain specialized abilities**.

---

## Acceptance Criteria

### AC1: All talents across 3 tiers displayed ✅

**Given** I am viewing groom development
**When** I open the talent tree
**Then** I see all talents across 3 tiers

- Tier 1 (Apprentice), Tier 2 (Journeyman), Tier 3 (Master) sections shown
- All talents for the groom's personality type displayed
- Calm: 2+2+1=5 talents, Energetic: 2+2+1=5, Methodical: 2+2+1=5
- Unknown personality shows graceful fallback message
- Allocated count badge ("1 / 3 allocated") shown in header

### AC2: Available talents highlighted ✅

**And** available talents are highlighted

- Available talents show amber star icon and "Select Talent" button
- Selected talents show blue check icon and "Selected" badge
- Locked talents (level too low or prerequisite not met) show lock icon and reduced opacity
- No select button shown for locked or already-selected talents

### AC3: Talent effects clearly explained ✅

**And** talent effects are clearly explained

- Each talent shows name, description, and formatted effects
- Effects formatted as "+X% Label" (e.g., "+5% Bonding Bonus")
- Multiple effects shown as separate chips
- Personality label shown: "Calm specialization", "Energetic specialization", etc.

### AC4: Unlock requirements shown ✅

**And** unlock requirements shown

- "Level 3+ required" for Tier 1, "Level 5+ required" for Tier 2, "Level 8+ required" for Tier 3
- Tier labels: "Tier 1 — Apprentice", "Tier 2 — Journeyman", "Tier 3 — Master"
- Prerequisite notice shown when tier unlocked but lower tier not yet selected
- Panel aria-label includes groom name for accessibility

### AC5: Talent point allocation is saved ✅

**And** talent point allocation is saved

- `onSelectTalent(tier, talentId)` callback fired when "Select Talent" button clicked
- `isSaving` prop shows "Saving..." state with disabled button during API call
- "Talent tree complete!" message shown when all 3 tiers selected
- No select button shown for already-selected talents (permanent selection)

---

## Implementation

### Files

| File                                                | Status      | Notes                                                       |
| --------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `frontend/src/types/groomTalent.ts`                 | ✅ Complete | Types, constants, talent trees for 3 personalities, helpers |
| `frontend/src/components/groom/GroomTalentTree.tsx` | ✅ Complete | Full talent tree with TalentCard, TierRow, TierConnector    |

### Tests

| Test File                             | Tests | Status           |
| ------------------------------------- | ----- | ---------------- |
| `GroomTalentTree.story-7-6.test.tsx`  | 75/75 | ✅ All passing   |
| `GroomLegacyPanel.story-7-5.test.tsx` | 60/60 | ✅ No regression |
| `GroomCareerPanel.story-7-4.test.tsx` | 79/79 | ✅ No regression |

**Total tests for Story 7-6:** 75 passing (363 combined with Stories 7-1 through 7-5)

---

## Completion Notes

- `groomTalent.ts`: `TALENT_REQUIREMENTS` — tier1 (level 3+), tier2 (level 5+), tier3 (level 8+)
- `TALENT_TREES`: 3 personality types (calm, energetic, methodical) × 5 talents each = 15 total; each tier1+tier2 has 2 choices, tier3 has 1
- `getTalentTiersWithState(personality, level, selections)`: returns 3 tiers with `isUnlocked`, `prerequisiteMet`, and per-talent `isSelected/isAvailable/isLocked` states
- `formatTalentEffect(key, value)`: converts camelCase key + decimal → "+X% Label"
- `countAllocatedTalents(selections)`: counts allocated slots (0–3)
- `GroomTalentTree` props: `groom: GroomTalentData`, `onSelectTalent?: callback`, `isSaving?: boolean`
- Prerequisite chain: tier1 must be selected before tier2 available; tier2 before tier3
- Function type parameter names prefixed with `_` to satisfy `@typescript-eslint/no-unused-vars` lint rule
