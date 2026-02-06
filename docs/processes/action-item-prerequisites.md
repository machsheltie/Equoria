# Action Item Prerequisite System

**Status:** Implemented (2026-02-05)
**Owner:** Alex (DevOps)
**Action Item:** AI-5-6

---

## Overview

The Action Item Prerequisite System provides automated validation that all blocking action items are completed before an epic or story can start. This prevents the 0% action item completion pattern observed in Epics 4 and 5, and ensures sustainable development velocity.

---

## Problem Statement

### Historical Context

**Epic 3 → Epic 4:**

- Epic 3 retrospective created 5 action items
- Epic 4 completed 0/5 (0% completion rate)

**Epic 4 → Epic 5:**

- Epic 4 retrospective created 9 action items
- Epic 5 completed 0/9 (0% completion rate)
- Epic 5 finished **before** Epic 4 retrospective was conducted

**Root Cause:** No enforcement mechanism to ensure action items are completed before starting the next epic.

**Impact:** Technical and process debt compounds with each epic, eventually blocking progress (Epic 6 blocked by 7 P0 action items).

---

## Solution: Automated Prerequisite Checking

### System Components

1. **Blocking Relationships in sprint-status.yaml**

   - Action items can specify `blocks: [epic-6]` or `blocks: [story-6-1]`
   - Clear, machine-readable prerequisite declarations

2. **Prerequisite Checker Script**

   - Location: `scripts/check-prerequisites.mjs`
   - Reads sprint-status.yaml
   - Validates all blocking action items are completed
   - Provides clear pass/fail output with details

3. **NPM Script Integration**
   - Command: `npm run check-prerequisites <epic-id>`
   - Exit code 0: All prerequisites met
   - Exit code 1: Prerequisites missing

---

## Usage

### Basic Usage

```bash
# Check prerequisites for Epic 6
npm run check-prerequisites epic-6

# Check prerequisites for a specific story
npm run check-prerequisites 6-1-breeding-pair-selection

# Check prerequisites for Prep Sprint
npm run check-prerequisites prep-sprint-epic-6
```

### Output Format

**When Prerequisites Are Met:**

```
Checking prerequisites for: epic-6

Target: Breeding & Foal Development
Status: blocked

Found 7 action item(s) that block epic-6:

Completed (7):
  ✓ action-5-1: Extract BaseModal Component
     Status: completed | Priority: P0 | Owner: Sarah (Frontend Lead)
  ✓ action-5-2: Create Charting Library ADR
     Status: completed | Priority: P0 | Owner: Sarah (Frontend Lead)
  ...

Summary:
  Total blocking items: 7
  Completed: 7
  Pending: 0

✓ Prerequisites check: PASSED
All blocking action items are completed. epic-6 is ready to start.
```

**When Prerequisites Are Missing:**

```
Checking prerequisites for: epic-6

Target: Breeding & Foal Development
Status: blocked

Found 7 action item(s) that block epic-6:

Pending (7):
  ✗ action-5-1: Extract BaseModal Component
     Status: open | Priority: P0 | Owner: Sarah (Frontend Lead)
     Description: Extract shared modal functionality from 6 modal variants...
     Estimate: 2 days
  ...

Summary:
  Total blocking items: 7
  Completed: 0
  Pending: 7

✗ Prerequisites check: FAILED
Cannot start epic-6 until all 7 blocking action items are completed.
```

---

## Integration Points

### 1. Sprint Planning Workflow

**Before starting any epic:**

1. Run prerequisite check: `npm run check-prerequisites <epic-id>`
2. If check fails: Address blocking items first (Prep Sprint)
3. If check passes: Proceed with epic planning

**Enforcement:** Manual process enforced by Scrum Master (AI-5-7: Accountability Checkpoint)

### 2. Prep Sprint

**Purpose:** Dedicated sprint to resolve blocking action items

**Process:**

1. Epic N retrospective identifies action items blocking Epic N+1
2. Classify as P0 (blocking) or P1 (nice-to-have)
3. Initialize Prep Sprint with P0 items as scope
4. Execute Prep Sprint (no feature work)
5. Run `npm run check-prerequisites epic-N+1`
6. If passed: Start Epic N+1
7. If failed: Continue Prep Sprint

### 3. CI/CD Integration (Future)

**Potential automation:**

- Pre-commit hook to validate action item status changes
- GitHub Actions workflow to check prerequisites on epic branch creation
- Automated comment on PR if prerequisites not met

---

## sprint-status.yaml Schema

### Action Item Structure

```yaml
action_items:
  action-5-1:
    id: 'action-5-1'
    title: 'Extract BaseModal Component'
    status: open # open | in_progress | completed
    priority: P0 # P0 | P1 | P2
    owner: 'Sarah (Frontend Lead)'
    epic: 5
    created_date: '2026-02-05'
    due_date: 'End of Prep Sprint (Feb 10, 2026)'
    blocks: [epic-6] # ← BLOCKING RELATIONSHIP
    description: 'Extract shared modal functionality...'
    acceptance_criteria:
      - 'Create BaseModal.tsx...'
      - 'Refactor all 6 modal variants...'
    time_estimate: '2 days'
    impact: 'HIGH - Prevents modal variant #7 in Epic 6'
```

### Epic Structure with Blocked Status

```yaml
development_status:
  epic-6:
    title: 'Breeding & Foal Development'
    status: blocked # ← BLOCKED STATUS
    priority: P0
    prerequisites: [epic-3, prep-sprint-epic-6]
    blocked_by: # ← EXPLICIT BLOCKING ITEMS
      - 'action-5-1: Extract BaseModal Component'
      - 'action-5-2: Create Charting Library ADR'
      - 'action-5-5: Complete Pattern Documentation'
      - 'action-5-6: Implement Action Item Prerequisite System'
      - 'action-5-7: Sprint Planning Accountability Checkpoint'
      - 'action-5-8: Eliminate "Parallel Work" Fiction'
      - 'action-5-9: Mandatory Retrospective Before Epic Starts'
    notes: 'Epic 6 cannot start until all 7 P0 action items completed'
```

---

## Script Implementation Details

### Technology Stack

- **Language:** Node.js (ES Modules)
- **Dependencies:** js-yaml (YAML parsing)
- **Exit Codes:** 0 (success), 1 (failure)
- **Output:** ANSI colored terminal output for readability

### Key Functions

1. **`loadSprintStatus()`**

   - Loads and parses sprint-status.yaml
   - Error handling for missing/invalid files

2. **`findBlockingActionItems(targetId)`**

   - Searches all action items for `blocks: [targetId]`
   - Returns array of blocking action items

3. **`isActionItemCompleted(actionItem)`**

   - Validates action item status === 'completed'
   - Simple, clear completion check

4. **`checkPrerequisites(targetId)`**
   - Main orchestration function
   - Categorizes items as completed/pending
   - Generates formatted output
   - Returns boolean pass/fail

### Error Handling

- **sprint-status.yaml not found:** Clear error message with expected path
- **Invalid YAML syntax:** Parser error with line number
- **Target ID not found:** Error message listing available targets
- **Invalid command-line args:** Usage examples displayed

---

## Testing

### Manual Testing

```bash
# Test with Epic 6 (currently blocked)
npm run check-prerequisites epic-6
# Expected: FAILED with 7 pending items

# Test with completed epic
npm run check-prerequisites epic-5
# Expected: PASSED (no blocking items)

# Test with Prep Sprint
npm run check-prerequisites prep-sprint-epic-6
# Expected: Depends on epic-5-retrospective completion

# Test with invalid target
npm run check-prerequisites invalid-epic
# Expected: Error message
```

### Automated Testing (Future)

Create `scripts/check-prerequisites.test.mjs`:

- Test prerequisite detection
- Test status validation
- Test output formatting
- Test error handling

---

## Acceptance Criteria Status

✅ **Script reads sprint-status.yaml**
✅ **Validates all prerequisites met for target epic**
✅ **Fails with clear error message if prerequisites missing**
✅ **Lists specific blocking action items by ID**
✅ **Integrated into sprint planning workflow** (via npm script)
✅ **Can be run manually: npm run check-prerequisites <epic-id>**
✅ **Documentation in docs/processes/action-item-prerequisites.md**
🔄 **Epic 6 prerequisite check passes** (pending Prep Sprint completion)

---

## Related Action Items

- **AI-5-7:** Sprint Planning Accountability Checkpoint (uses this script)
- **AI-5-8:** Eliminate "Parallel Work" Fiction (prerequisite classification)
- **AI-5-9:** Mandatory Retrospective Before Epic Starts (prerequisite type)

---

## Lessons Learned

### What This System Prevents

1. **0% Action Item Completion:** Forces explicit blocking relationships
2. **Recursive Process Failures:** Cannot start epic before prerequisites met
3. **Accumulated Technical Debt:** Dedicated Prep Sprints for debt resolution
4. **Ambiguous Planning:** Clear, automated validation

### What This System Enables

1. **Sustainable Velocity:** Debt resolution before feature work
2. **Process Discipline:** Automated enforcement reduces manual errors
3. **Visibility:** Clear status of blocking items at any time
4. **Accountability:** Explicit ownership and due dates for blockers

---

## Future Enhancements

### Phase 1 (Current)

- ✅ Basic prerequisite checking
- ✅ Colored terminal output
- ✅ NPM script integration

### Phase 2 (Next)

- 🔄 CI/CD integration
- 🔄 Automated tests for script
- 🔄 Pre-commit hook validation

### Phase 3 (Future)

- ⬜ GitHub Actions integration
- ⬜ Slack/Discord notifications
- ⬜ Dashboard visualization
- ⬜ Prerequisite dependency graph

---

## Maintenance

### Updating the Script

**Location:** `scripts/check-prerequisites.mjs`

**Common Updates:**

- Add new validation rules
- Enhance output formatting
- Add support for new prerequisite types
- Improve error messages

**Testing After Updates:**

```bash
# Run against known good/bad cases
npm run check-prerequisites epic-5  # Should pass
npm run check-prerequisites epic-6  # Should fail (until Prep Sprint done)
```

### Updating Documentation

**This file:** `docs/processes/action-item-prerequisites.md`

**Update when:**

- Adding new features to script
- Changing integration points
- Documenting new workflows
- Adding examples

---

## Support

**Questions or Issues:**

- Scrum Master: Bob
- DevOps: Alex
- Documentation: This file

**Troubleshooting:**

1. Verify sprint-status.yaml syntax is valid
2. Check action item `blocks` arrays are properly formatted
3. Ensure target ID matches exactly (case-sensitive)
4. Run with `--verbose` flag for debugging (future enhancement)

---

**Last Updated:** 2026-02-05
**Status:** ✅ Implemented and Operational
**Version:** 1.0
