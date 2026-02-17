# Story 7.4: Career Lifecycle Dashboard

**Status:** completed
**Completed Date:** 2026-02-17
**FR:** FR-G4
**Epic:** 7 (Groom System)
**Priority:** P1

---

## User Story

As a **player**,
I want to **track my groom's career progression**,
So that **I can plan for retirement and succession**.

---

## Acceptance Criteria

### AC1: Experience, level, and retirement timeline ✅

**Given** I am viewing groom management
**When** I view career status
**Then** I see experience, level, and retirement timeline

- Level badge (1-10) with current level prominently displayed
- XP progress bar showing XP within current level / XP needed for next level
- Total XP shown below bar
- Career timeline showing weeks active and weeks remaining until mandatory retirement
- Career progress bar colored: green (<75%), amber (75-89%), red (90%+)
- Retirement deadline text: "Mandatory retirement at 104 weeks"

### AC2: Career milestones tracked ✅

**And** career milestones are tracked

- 6 career milestones: Career Started, First Assignment, Level 5, Master Groom (Level 10), Six Months (26+ weeks), One Year (52+ weeks)
- Reached milestones show CheckCircle icon; unreached show empty circle with description
- Milestones update dynamically based on groom data

### AC3: Retirement age and benefits displayed ✅

**And** retirement age and benefits displayed

- Retirement Rules info box shows:
  - Mandatory retirement at 104 weeks (2 years)
  - Early retirement eligible at Level 10 (Master)
  - Early retirement eligible after 12+ assignments
  - Retirement notice given 1 week in advance
- Hidden in compact mode
- Retired grooms show a "Retired" badge and retired notice with reason and date
- Retirement reasons use human-readable labels from `RETIREMENT_REASON_LABELS`

### AC4: Performance history shown ✅

**And** performance history shown

- Performance metrics grid (when `metrics` prop provided):
  - Bonding Effectiveness (0-100)
  - Task Completion (0-100)
  - Horse Wellbeing (0-100)
  - Show Performance (0-100)
  - Reputation Score (0-100)
  - Total Interactions (count)
- Scores color-coded: green (≥70), amber (40-69), red (<40)
- Hidden when `metrics` prop not provided or in compact mode

### AC5: Warnings for approaching retirement ✅

**And** warnings for approaching retirement

- Warning banner shown (role="alert") when:
  - Within 1 week of mandatory retirement (approaching message with weeks remaining)
  - Level 10 reached ("Master level achieved — eligible for early retirement")
  - 12+ assignments completed ("Assignment limit reached — eligible for early retirement")
- Both approaching AND early retirement warnings can show simultaneously
- No warning shown for already-retired grooms (shows retired notice instead)

---

## Implementation

### Files

| File                                                 | Status      | Notes                                                     |
| ---------------------------------------------------- | ----------- | --------------------------------------------------------- |
| `frontend/src/types/groomCareer.ts`                  | ✅ Complete | Types, constants, XP/level helpers, retirement calculator |
| `frontend/src/components/groom/GroomCareerPanel.tsx` | ✅ Complete | Full career dashboard with 5 sub-components               |

### Tests

| Test File                                    | Tests | Status           |
| -------------------------------------------- | ----- | ---------------- |
| `GroomCareerPanel.story-7-4.test.tsx`        | 79/79 | ✅ All passing   |
| `GroomTaskPanel.story-7-3.test.tsx`          | 54/54 | ✅ No regression |
| `GroomPersonalityDisplay.story-7-2.test.tsx` | 51/51 | ✅ No regression |
| `GroomHiringInterface.story-7-1.test.tsx`    | 25/25 | ✅ No regression |

**Total tests for Story 7-4:** 79 passing (209 combined with Stories 7-1, 7-2, 7-3)

---

## Completion Notes

- `groomCareer.ts`: XP formula mirrors backend `groomProgressionService.mjs` — Level N starts at 100*N*(N-1)/2 XP
- `CAREER_CONSTANTS`: matches backend `groomRetirementService.mjs` constants (104 weeks, Level 10, 12 assignments, 1-week notice)
- `calculateXPProgress`: Returns level (1-10), xpInLevel, xpToNextLevel, progressPercent
- `calculateRetirementStatus`: Returns isRetired, weeksRemaining, isApproachingRetirement, earlyRetirementEligible, warningReasons array
- `buildCareerMilestones`: Returns 6 milestones with reached/not-reached state
- `GroomCareerPanel` props: `groom: GroomCareerData`, `assignmentCount?: number`, `metrics?: GroomPerformanceMetrics`, `compact?: boolean`
- Compact mode hides retirement benefits info and performance metrics (for tight layouts)
- Career progress bar color: green < 75%, amber 75-89%, red ≥ 90% of 104 weeks
