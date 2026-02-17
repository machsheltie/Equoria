# Story 7.5: Legacy System UI

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G5
**Epic:** 7 (Groom System)
**Priority:** P2

---

## User Story

As a **player**,
I want to **manage groom legacy and protégés**,
So that **I can build generational groom lineages**.

---

## Acceptance Criteria

### AC1: Skills and traits transfer displayed ✅

**Given** I am viewing a groom's legacy panel
**When** the groom was mentored by a retired groom
**Then** I see the inherited perk with its name, description, and effects

- Inherited perk shown with "Inherited" amber badge
- Perk effects formatted as "+X% Label" strings
- `InheritedPerkSection` shown only when `mentorInfo` prop provided
- "Legacy Groom" badge shown in panel header

### AC2: Legacy trees show lineage ✅

**And** legacy tree shows lineage

- Three-node chain: Mentor → Groom (highlighted) → Protégé
- Missing mentor shows "None" placeholder
- Missing protégé shows "None yet" placeholder
- Full tree shows all three nodes with levels

### AC3: Trait inheritance preview ✅

**And** trait inheritance preview shown

- Shows all perks available from groom's personality type
- Personality label shown: "From {personality} personality — one perk chosen at random"
- All 3 perks for the personality shown
- Section hidden when `hasCreatedProtégé=true`
- Perks NOT marked as "Inherited" in preview

### AC4: Mentorship period displayed ✅

**And** mentorship period displayed

- `InheritedPerkSection` shows mentorship date in human-readable format
- `ProtégéSection` shows creation date for protégé
- Dates formatted via `.toLocaleDateString()` from ISO timestamps

### AC5: Bonus effectiveness for legacy grooms ✅

**And** bonus effectiveness for legacy grooms

- `LegacyBonusesSection` shown when groom has mentorInfo (is a protégé)
- Shows: +50 bonus XP, +1 starting level, +10% skill effectiveness, 1 inherited perk
- `MentorEligibilitySection` shown for retired grooms without a protégé yet
- Eligible message or ineligible message with specific reasons
- Ineligible reasons: must be retired, must reach Level 7, already mentored

---

## Implementation

### Files

| File                                                 | Status      | Notes                                                    |
| ---------------------------------------------------- | ----------- | -------------------------------------------------------- |
| `frontend/src/types/groomLegacy.ts`                  | ✅ Complete | Types, constants, perks by personality, helper functions |
| `frontend/src/components/groom/GroomLegacyPanel.tsx` | ✅ Complete | Full legacy panel with 8 sub-components                  |

### Tests

| Test File                             | Tests | Status           |
| ------------------------------------- | ----- | ---------------- |
| `GroomLegacyPanel.story-7-5.test.tsx` | 60/60 | ✅ All passing   |
| `GroomCareerPanel.story-7-4.test.tsx` | 79/79 | ✅ No regression |

**Total tests for Story 7-5:** 60 passing (288 combined with Stories 7-1 through 7-4)

---

## Completion Notes

- `groomLegacy.ts`: `LEGACY_CONSTANTS` mirrors `backend/services/groomLegacyService.mjs` (min level 7, protégé XP +50, level +1, skill +10%)
- `LEGACY_PERKS_BY_PERSONALITY`: 5 personality types × 3 perks each (calm, energetic, methodical, playful, strict) = 15 total perks
- `checkLegacyEligibility(groom, hasExistingProtégé)`: must be retired AND level ≥7 AND not have existing protégé
- `getAvailablePerksForPersonality(personality)`: returns perks array or [] for unknown personality
- `formatPerkEffect(key, value)`: converts camelCase key + decimal to "+X% Label" (e.g. "+5% Bonding Bonus")
- `GroomLegacyPanel` props: `groom: GroomLegacyData`, `mentorInfo?: MentorInfo`, `protégéInfo?: ProtégéInfo`, `hasCreatedProtégé?: boolean`
- `within()` from React Testing Library used in tests to scope queries when duplicate `data-testid` values appear across sections (gentle_hands perk appears in both inherited section and personality preview)
- Compact mode not implemented (not required by AC); all sections always visible based on prop conditions
