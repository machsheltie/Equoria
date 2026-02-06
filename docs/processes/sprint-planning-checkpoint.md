# Sprint Planning Accountability Checkpoint

**Version:** 1.0
**Status:** ✅ Accepted (2026-02-06)
**Context:** Epic 5 Retrospective - Preventing Blocked Epic Starts
**Related:** AI-5-7 (Sprint Planning Checkpoint), AI-5-6 (Prerequisite System), AI-5-9 (Retrospective Gate)

---

## Executive Summary

The **Sprint Planning Accountability Checkpoint** is a mandatory gate that prevents epics from starting with incomplete prerequisites. It validates two critical requirements:

1. **Retrospective Gate:** Previous epic's retrospective is complete
2. **Action Item Prerequisites:** All P0 action items blocking the epic are completed

**Implementation:** Automated via `npm run check-prerequisites <epic-id>`

---

## The Problem

### Historical Pattern (Epic 3-5)

```
Epic N Completion → Epic N+1 Starts Immediately
├── Epic N retrospective: Not conducted yet
├── P0 action items: Not identified yet
├── Epic N+1: Starts with unknown blockers
└── Result: Epic N+1 blocked mid-sprint, velocity drops

PATTERN: Start first, ask questions later → 0% action item completion
```

### Root Causes

1. **No Gate Between Epics**

   - No validation that prerequisites are met
   - Epics start based on calendar, not readiness
   - "We'll figure it out as we go" mentality

2. **Retrospectives Too Late**

   - Epic N completes → Epic N+1 starts immediately
   - Retrospective conducted during Epic N+1
   - Action items identified after work already committed

3. **No Accountability for Blockers**
   - P0 items identified but not tracked
   - "Someone will do it" → nobody does it
   - Epic continues despite blockers

**Evidence:**

- Epic 4 started before Epic 3 retrospective complete
- Epic 5 started before Epic 4 retrospective complete
- Epic 6 would have started before Epic 5 retrospective (prevented by new process)

---

## The Solution: Automated Checkpoint

### Overview

The **Sprint Planning Accountability Checkpoint** is a **mandatory automated validation** that must pass before an epic can be planned or started.

**Location:** `scripts/check-prerequisites.mjs`
**Command:** `npm run check-prerequisites <epic-id>`
**Integration:** Run during sprint planning before epic starts

### What It Checks

#### 1. Retrospective Gate (AI-5-9)

**Validation:**

- Previous epic's retrospective exists in sprint-status.yaml
- Retrospective status: `completed`
- Retrospective has `retro_file` defined (proof of conducted retro)

**Example:**

```bash
npm run check-prerequisites epic-6

Retrospective Gate Check:
✓ Previous epic retrospective completed
  Retrospective ID: epic-5-retrospective
  Retrospective File: docs/sprint-artifacts/epic-5-retro-2026-02-05.md
```

**Failure Example:**

```bash
✗ RETROSPECTIVE GATE: FAILED
Retrospective 'epic-5-retrospective' not completed (status: pending)

REQUIREMENT: Epic N-1 retrospective must be completed before Epic N can start.
This prevents recursive process failures and ensures continuous improvement.
```

#### 2. Action Item Prerequisites (AI-5-6)

**Validation:**

- Find all action items with `blocks: [epic-N]` relationship
- Verify each action item status: `completed`
- Report pending items with details (owner, estimate, priority)

**Example:**

```bash
Found 7 action item(s) that block epic-6:

Completed (4):
  ✓ action-5-1: Extract BaseModal Component
  ✓ action-5-2: Create Charting Library ADR
  ✓ action-5-5: Complete Pattern Documentation
  ✓ action-5-6: Implement Action Item Prerequisite System

Pending (3):
  ✗ action-5-7: Sprint Planning Accountability Checkpoint
     Status: open | Priority: P0 | Owner: Bob (Scrum Master)
     Description: Create mandatory checkpoint template...
     Estimate: 0.5 days
```

### Exit Codes

```javascript
0 → All prerequisites met (✅ epic can start)
1 → Prerequisites missing (❌ epic blocked)
```

**CI/CD Integration:** Exit code 1 can block PR merges or epic branch creation.

---

## Sprint Planning Workflow Integration

### Traditional Workflow (❌ Broken)

```
1. Epic N feature work complete (Day 5)
2. Epic N+1 planning starts immediately (Day 6)
3. Epic N retrospective conducted later (Day 7-8)
4. Action items identified after Epic N+1 started
5. Epic N+1 blocked by incomplete prerequisites

Result: 0% action item completion, blocked epics
```

### New Workflow (✅ Fixed)

```
1. Epic N feature work complete (Day 5)
   └─ Minimum 1-day gap required

2. Epic N retrospective conducted (Day 6)
   ├─ Party mode team retrospective
   ├─ Action items identified and classified:
   │   ├─ PREREQUISITE (P0): blocks next epic
   │   └─ POST-EPIC (P1/P2): flexible schedule
   └─ Update sprint-status.yaml with action items

3. Sprint Planning Checkpoint (Day 6-7)
   ├─ Run: npm run check-prerequisites epic-N+1
   ├─ Retrospective gate: ✓ Passed
   └─ Action items check: ✗ Failed (3 P0 items pending)

4. Decision Point
   ├─ If 3+ P0 items: Schedule Prep Sprint (3-7 days)
   └─ If < 3 P0 items: Schedule in first 2 days of Epic N+1

5. Prep Sprint (Day 7-11)
   ├─ 100% focus on P0 prerequisites
   ├─ 0% feature work
   ├─ Daily progress: npm run check-prerequisites epic-N+1
   └─ Success criteria: All P0 items completed

6. Final Checkpoint (Day 12)
   ├─ Run: npm run check-prerequisites epic-N+1
   ├─ Retrospective gate: ✓ Passed
   ├─ Action items check: ✓ Passed (7/7 complete)
   └─ Epic N+1: UNBLOCKED, ready to start

7. Epic N+1 starts (Day 13)
   ├─ Zero blockers
   ├─ Clear technical direction
   └─ Sustainable velocity

Result: 100% P0 completion, unblocked epics
```

---

## Usage Guide

### When to Run the Checkpoint

**Mandatory Trigger Points:**

1. **Before Sprint Planning Meeting**

   - Verify epic is ready to be planned
   - If failed, schedule Prep Sprint instead

2. **Before Epic Branch Creation**

   - Prevent starting blocked epics
   - If failed, complete prerequisites first

3. **Daily During Prep Sprint**

   - Track progress toward completion
   - Adjust sprint duration if needed

4. **Before Epic Start (Final Validation)**
   - Last gate before feature work begins
   - Must pass before Day 1 of epic

### Command Syntax

```bash
# Check epic prerequisites
npm run check-prerequisites epic-6

# Check story prerequisites (if story has prerequisites)
npm run check-prerequisites 6-1-breeding-pair-selection

# Check prep sprint prerequisites
npm run check-prerequisites prep-sprint-epic-6
```

### Interpreting Results

#### ✅ Success (Exit Code 0)

```bash
Retrospective Gate Check:
✓ Previous epic retrospective completed

Found 7 action item(s) that block epic-6:

Completed (7):
  ✓ action-5-1: Extract BaseModal Component
  ✓ action-5-2: Create Charting Library ADR
  ...

Summary:
  Total blocking items: 7
  Completed: 7
  Pending: 0

✓ Prerequisites check: PASSED
All blocking action items are completed. epic-6 is ready to start.
```

**Action:** Proceed with epic planning and execution.

#### ❌ Failure - Retrospective Gate (Exit Code 1)

```bash
Retrospective Gate Check:
✗ RETROSPECTIVE GATE: FAILED
Retrospective 'epic-5-retrospective' not completed (status: pending)

REQUIREMENT: Epic N-1 retrospective must be completed before Epic N can start.
This prevents recursive process failures and ensures continuous improvement.
```

**Action:**

1. Conduct Epic N-1 retrospective immediately
2. Update sprint-status.yaml with retrospective completion
3. Re-run checkpoint

**Deadline:** Same day (retrospective should take 2-3 hours)

#### ❌ Failure - Action Items (Exit Code 1)

```bash
Retrospective Gate Check:
✓ Previous epic retrospective completed

Pending (3):
  ✗ action-5-7: Sprint Planning Accountability Checkpoint
     Estimate: 0.5 days
  ✗ action-5-8: Eliminate "Parallel Work" Fiction
     Estimate: 0.5 days
  ✗ action-5-9: Mandatory Retrospective Before Epic Starts
     Estimate: 0.5 days

✗ Prerequisites check: FAILED
Cannot start epic-6 until all 3 blocking action items are completed.
```

**Action:**

1. Sum effort estimates: 3 items × 0.5 days = 1.5 days
2. Schedule Prep Sprint: 2-3 days (includes buffer)
3. Complete all P0 items
4. Re-run checkpoint daily
5. When passed, proceed with epic

**Timeline:** 2-5 days depending on complexity

---

## Integration with Existing Systems

### 1. Sprint Status YAML

**Retrospective Entry:**

```yaml
epic-5-retrospective:
  title: 'Epic 5: Competition System - Retrospective'
  status: completed # ← Checked by retrospective gate
  retro_file: 'docs/sprint-artifacts/epic-5-retro-2026-02-05.md' # ← Must exist
  date: '2026-02-05'
```

**Action Items with Blocking:**

```yaml
action-5-1:
  id: 'action-5-1'
  title: 'Extract BaseModal Component'
  status: completed # ← Checked by action item prerequisites
  priority: P0
  blocks: [epic-6] # ← Defines blocking relationship
```

**Epic with Prerequisites:**

```yaml
epic-6:
  title: 'Breeding & Foal Development'
  status: blocked  # ← Updated after checkpoint passes
  blocked_by:  # ← Human-readable list (redundant with blocks:)
    - 'action-5-1: Extract BaseModal Component'
    - 'action-5-2: Create Charting Library ADR'
    ...
```

### 2. Automated Prerequisite Checking

**Script:** `scripts/check-prerequisites.mjs`

**How It Works:**

1. Load sprint-status.yaml
2. Find target epic/story by ID
3. Check retrospective gate (for epics only)
4. Find all action items with `blocks: [target-id]`
5. Verify each action item status: `completed`
6. Return pass/fail with detailed output

**Dependencies:**

- Node.js 18+
- js-yaml package
- sprint-status.yaml with proper structure

### 3. CI/CD Integration (Future)

**GitHub Actions Workflow (Planned):**

```yaml
name: Epic Prerequisite Check

on:
  pull_request:
    branches: [epic-*]

jobs:
  check-prerequisites:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check Prerequisites
        run: |
          EPIC_ID=$(echo ${{ github.head_ref }} | sed 's/epic-\([0-9]*\).*/epic-\1/')
          npm run check-prerequisites $EPIC_ID
```

**Result:** PR to epic branch blocked until prerequisites met.

---

## Team Accountability

### Roles and Responsibilities

#### Scrum Master (Bob)

**Responsibilities:**

1. Run checkpoint before every sprint planning
2. Enforce gate: No epic planning if checkpoint fails
3. Schedule Prep Sprints when 3+ P0 items identified
4. Track prerequisite completion daily during Prep Sprints
5. Conduct final checkpoint before epic start

**Time Commitment:** 10-15 minutes per checkpoint

#### Team Leads

**Frontend Lead (Sarah):**

- Own frontend P0 items (UI components, patterns, architecture)
- Complete within Prep Sprint timeframe
- Sign off on frontend prerequisite deliverables

**Backend Lead (Dr. Chen):**

- Own backend P0 items (APIs, migrations, security)
- Complete within Prep Sprint timeframe
- Sign off on backend prerequisite deliverables

**DevOps (Alex):**

- Own process automation items (CI/CD, scripts, tools)
- Complete within Prep Sprint timeframe
- Sign off on automation prerequisite deliverables

**Time Commitment:** Dedicated Prep Sprint days (full focus)

#### Full Team

**Responsibilities:**

1. Attend retrospectives (mandatory, 2-3 hours)
2. Classify action items honestly (PREREQUISITE vs POST-EPIC)
3. Respect checkpoint results (don't bypass gates)
4. Complete assigned P0 items during Prep Sprint
5. Review prerequisite deliverables

**Commitment:** "We will not start blocked epics."

---

## Success Metrics

### Process Health Indicators

**Before Checkpoint System (Epic 3-5):**

```
Retrospectives: Conducted after next epic started (100% late)
Action Item Completion: 0/9, 0/9 (0%)
Epic Blocking Rate: 100% (Epic 6 blocked by 7 P0 items)
Technical Debt: Increasing (modal variants, dual libraries)
Team Velocity: Declining (58 → 95 → ? unstable)
```

**After Checkpoint System (Epic 6+):**

```
Target Metrics:
- Retrospective Completion: Before next epic starts (0 days late)
- P0 Action Item Completion: 100% before next epic
- Epic Blocking Rate: 0% (all epics unblocked at start)
- Technical Debt: Stable or decreasing
- Team Velocity: Consistent (90-100 story points/epic)
- Checkpoint Failures: < 10% (most epics pass on first check)
```

### Leading Indicators

✅ **Healthy Process:**

- Checkpoint run before every sprint planning
- Failures addressed immediately (Prep Sprint scheduled)
- P0 items completed within Prep Sprint timeframe
- Team respects gate (no bypasses or exceptions)
- Retrospectives completed within 1 day of epic end

⚠️ **Process Degradation:**

- Checkpoint skipped ("just this once")
- Failures ignored ("we'll work around it")
- P0 items reclassified as P1 to pass checkpoint
- Retrospectives delayed or skipped
- Epic starts despite failed checkpoint

---

## Examples

### Example 1: Epic 6 Prep Sprint (Feb 2026)

**Timeline:**

**Day 1 (Feb 5):** Epic 5 Complete

- Feature work finished
- Epic 5 retrospective conducted (same day!)
- 9 action items created (7 P0, 2 P1)

**Day 1 (Feb 5 afternoon):** Checkpoint Run

```bash
npm run check-prerequisites epic-6

Retrospective Gate Check:
✓ Previous epic retrospective completed

Pending (7):
  ✗ action-5-1: Extract BaseModal Component (0.5 days)
  ✗ action-5-2: Create Charting Library ADR (1 day)
  ...

✗ Prerequisites check: FAILED
Cannot start epic-6 until all 7 blocking action items are completed.
```

**Decision:** 5-day Prep Sprint (7 P0 items × 0.5-1 day each)

**Day 2-3 (Feb 6-7):** Prep Sprint Execution

- AI-5-6: Prerequisite System (1 hour, Alex) ✅
- AI-5-1: BaseModal Component (2 hours, Sarah) ✅
- AI-5-5: Pattern Documentation (1 hour, Sarah) ✅
- AI-5-2: Charting Library ADR (2 hours, Sarah) ✅
- AI-5-8: Action Item Classification (2 hours, Bob) ✅
- AI-5-9: Retrospective Gate (2 hours, Bob) ✅
- AI-5-7: Sprint Planning Checkpoint Docs (1 hour, Bob) ✅

**Day 3 (Feb 7):** Final Checkpoint

```bash
npm run check-prerequisites epic-6

Retrospective Gate Check:
✓ Previous epic retrospective completed

Completed (7):
  ✓ action-5-1: Extract BaseModal Component
  ✓ action-5-2: Create Charting Library ADR
  ...

✓ Prerequisites check: PASSED
All blocking action items are completed. epic-6 is ready to start.
```

**Day 4 (Feb 8):** Epic 6 Starts

- Zero blockers
- Clear technical direction
- Sustainable velocity

**Result:** 100% P0 completion, Epic 6 unblocked

### Example 2: Epic 7 (Future)

**Scenario:** Epic 6 complete, 2 P0 items identified

**Timeline:**

**Day 1:** Epic 6 Complete + Retrospective

- 5 action items created (2 P0, 3 P1)

**Day 1:** Checkpoint Run

```bash
npm run check-prerequisites epic-7

Pending (2):
  ✗ action-6-1: Database Migration Script (1 day)
  ✗ action-6-2: API Version Deprecation (0.5 days)

✗ Prerequisites check: FAILED
Cannot start epic-7 until all 2 blocking action items are completed.
```

**Decision:** No Prep Sprint (only 2 P0 items, 1.5 days effort)

**Approach:** Schedule P0 items in first 2 days of Epic 7

- Day 1 (Epic 7): action-6-1 (1 day)
- Day 2 (Epic 7): action-6-2 (0.5 days)
- Day 3-7 (Epic 7): Feature work

**Day 2 Evening:** Checkpoint Re-Run

```bash
npm run check-prerequisites epic-7

Completed (2):
  ✓ action-6-1: Database Migration Script
  ✓ action-6-2: API Version Deprecation

✓ Prerequisites check: PASSED
```

**Day 3:** Epic 7 Feature Work Starts

- P0 items completed within epic timeframe
- No Prep Sprint needed (< 3 P0 items)

**Result:** Flexible approach for small prerequisite loads

---

## Troubleshooting

### Issue 1: Checkpoint Fails - Retrospective Not Found

**Symptom:**

```bash
✗ RETROSPECTIVE GATE: FAILED
Retrospective 'epic-5-retrospective' not found in sprint-status.yaml
```

**Cause:** Retrospective not added to sprint-status.yaml

**Solution:**

1. Add retrospective entry:
   ```yaml
   epic-5-retrospective:
     title: 'Epic 5: Competition System - Retrospective'
     status: completed
     retro_file: 'docs/sprint-artifacts/epic-5-retro-2026-02-05.md'
     date: '2026-02-05'
   ```
2. Re-run checkpoint

### Issue 2: Checkpoint Fails - Retrospective Not Completed

**Symptom:**

```bash
✗ RETROSPECTIVE GATE: FAILED
Retrospective 'epic-5-retrospective' not completed (status: pending)
```

**Cause:** Retrospective not conducted or not marked complete

**Solution:**

1. Conduct retrospective (party mode format)
2. Create retro document: `docs/sprint-artifacts/epic-N-retro-YYYY-MM-DD.md`
3. Update sprint-status.yaml:
   ```yaml
   epic-5-retrospective:
     status: completed # ← Change from pending
     retro_file: 'docs/sprint-artifacts/epic-5-retro-2026-02-05.md'
   ```
4. Re-run checkpoint

### Issue 3: Checkpoint Fails - Retrospective Missing retro_file

**Symptom:**

```bash
✗ RETROSPECTIVE GATE: FAILED
Retrospective 'epic-5-retrospective' missing retro_file field
```

**Cause:** Retrospective marked complete but no document created

**Solution:**

1. Create retrospective document
2. Update sprint-status.yaml:
   ```yaml
   epic-5-retrospective:
     retro_file: 'docs/sprint-artifacts/epic-5-retro-2026-02-05.md' # ← Add this
   ```
3. Re-run checkpoint

### Issue 4: Checkpoint Fails - Action Items Incomplete

**Symptom:**

```bash
Pending (3):
  ✗ action-5-7: Sprint Planning Accountability Checkpoint
  ✗ action-5-8: Eliminate "Parallel Work" Fiction
  ✗ action-5-9: Mandatory Retrospective Before Epic Starts

✗ Prerequisites check: FAILED
```

**Cause:** P0 action items not completed

**Solution:**

1. Sum effort estimates
2. If 3+ items or > 2 days: Schedule Prep Sprint
3. If < 3 items and < 2 days: Schedule in first 2 days of epic
4. Complete all P0 items
5. Re-run checkpoint daily until passed

### Issue 5: Checkpoint Passes But Epic Still Blocked

**Symptom:** Checkpoint passes but team identifies other blockers

**Cause:** Blocker not captured as P0 action item

**Solution:**

1. Add missing blocker as P0 action item:
   ```yaml
   action-X-Y:
     status: open
     priority: P0
     blocks: [epic-N]
   ```
2. Checkpoint will now fail (correct behavior)
3. Complete blocker
4. Re-run checkpoint

---

## Next Steps

### Immediate Actions (Prep Sprint Completion)

1. ✅ **Document This Checkpoint** (AI-5-7)

   - This document serves as the checkpoint guide
   - Integrates retrospective gate (AI-5-9) and prerequisite system (AI-5-6)

2. ✅ **Complete Remaining P0 Items** (AI-5-8, AI-5-9)

   - AI-5-8: Action item classification ✅
   - AI-5-9: Retrospective gate implementation ✅

3. ✅ **Final Validation**
   ```bash
   npm run check-prerequisites epic-6
   # Expected: ✅ All P0 items complete, Epic 6 ready
   ```

### Future Improvements

1. **CI/CD Integration** (Planned)

   - GitHub Actions workflow
   - Block PR merges to epic branches if prerequisites incomplete
   - Automated notifications when checkpoint fails

2. **Dashboard** (Future)

   - Visual epic readiness status
   - Prerequisite completion tracking
   - Historical trend analysis

3. **Slack Integration** (Future)
   - Post checkpoint results to #engineering channel
   - Alert when Prep Sprint needed
   - Daily progress updates during Prep Sprint

---

## References

### Related Documentation

- **Prerequisite System:** `docs/processes/action-item-prerequisites.md` (AI-5-6)
- **Action Item Classification:** `.claude/processes/action-item-classification.md` (AI-5-8)
- **Sprint Status:** `docs/sprint-artifacts/sprint-status.yaml`
- **Epic 5 Retrospective:** `docs/sprint-artifacts/epic-5-retro-2026-02-05.md`

### Related Action Items

- **AI-5-6:** Implement Action Item Prerequisite System (automated checking)
- **AI-5-7:** Sprint Planning Accountability Checkpoint (this document)
- **AI-5-9:** Mandatory Retrospective Before Epic Starts (retrospective gate)
- **AI-5-8:** Eliminate "Parallel Work" Fiction (classification system)

### Team Decisions

- **Decision Date:** 2026-02-05 (Epic 5 retrospective)
- **Decision Makers:** Full team
- **Consensus:** Mandatory checkpoint before all future epics
- **Enforcement:** Exit code 1 blocks epic planning
- **Review:** After each Prep Sprint

---

**Last Updated:** 2026-02-06
**Status:** ✅ Accepted and Implemented
**Action Items:** AI-5-7 (Sprint Planning Checkpoint), AI-5-6 (Prerequisite System), AI-5-9 (Retrospective Gate)
**Implementation:** `scripts/check-prerequisites.mjs` + `npm run check-prerequisites <epic-id>`
