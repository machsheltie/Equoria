# Story Status Update Process

**Version:** 1.0
**Last Updated:** 2025-12-05
**Owner:** All Team Members

## Purpose

This document establishes the process for keeping story markdown files synchronized with sprint-status.yaml when story status changes.

## The Problem

Stories have two sources of truth:
1. **sprint-status.yaml** - Sprint tracking with status, dates, completion notes
2. **Story markdown files** - Detailed acceptance criteria, tasks, implementation notes

These can become out of sync, leading to confusion about what's actually completed.

## The Solution

**When marking a story as completed in sprint-status.yaml, IMMEDIATELY update the corresponding story markdown file.**

## Process Steps

### When Completing a Story

Follow these steps in order:

#### 1. Update sprint-status.yaml

Mark the story as completed with completion notes:

```yaml
2-1-profile-management:
  title: "Profile Management"
  status: completed  # ← Change from in_progress to completed
  completed_date: "2025-12-04"  # ← Add completion date
  completion_notes: |  # ← Add completion notes
    32/32 tests passing
    ProfilePage.tsx with Zod validation
    useProfile/useUpdateProfile hooks
    All acceptance criteria met
```

#### 2. Update Story Markdown File

Open the corresponding story file (e.g., `2-1-profile-management.md`) and make these changes:

**A. Update Status Header**

Change:
```markdown
# Story 2.1: Profile Management

Status: in_progress
```

To:
```markdown
# Story 2.1: Profile Management

Status: ✅ completed
Completed Date: 2025-12-04
```

**B. Mark All Tasks as Complete**

Change all checkboxes from `[ ]` to `[x]`:

```markdown
- [x] **Task 1: Extend User Interface**
  - [x] Add `bio` field to User interface
  - [x] Update authApi.updateProfile
```

**C. Add Completion Notes Section**

Add a new section after the Tasks section:

```markdown
## Completion Notes

**Completed:** 2025-12-04
**Test Results:** 32/32 tests passing (100%)
**Implementation:**
- ProfilePage.tsx implemented with Zod validation
- useProfile and useUpdateProfile hooks integrated
- Bio character counter (500 max) with live updates
- Cancel button properly resets form to saved values
- All acceptance criteria met

**Files Created:**
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/__tests__/ProfilePage.test.tsx`

**Files Modified:**
- `frontend/src/hooks/useAuth.ts` - Added bio to User interface
- `frontend/src/lib/api-client.ts` - Updated profile types
- `frontend/src/lib/constants.ts` - Added profileSchema
- `frontend/src/App.tsx` - Added /profile route
```

#### 3. Commit Both Files Together

Commit both the sprint-status.yaml and story markdown file in the same commit:

```bash
git add docs/sprint-artifacts/sprint-status.yaml
git add docs/sprint-artifacts/2-1-profile-management.md
git commit -m "feat(sprint): Complete Story 2-1 (Profile Management)

- Mark story 2-1 as completed in sprint-status.yaml
- Update 2-1-profile-management.md with completion notes
- 32/32 tests passing, all acceptance criteria met

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Story Completion Checklist

Use this checklist when marking any story as completed:

```markdown
## Story Completion Checklist

- [ ] All acceptance criteria verified and met
- [ ] All tests passing for this story
- [ ] Code reviewed and merged
- [ ] **Update sprint-status.yaml:**
  - [ ] Change status to "completed"
  - [ ] Add completed_date
  - [ ] Add completion_notes with test results and implementation summary
- [ ] **Update story markdown file:**
  - [ ] Change status line to "✅ completed"
  - [ ] Add completed date
  - [ ] Mark all tasks as [x] completed
  - [ ] Add "Completion Notes" section with test results and file lists
- [ ] **Commit both files together** with descriptive message
- [ ] Verify both files are in sync
```

## Quick Reference

### File Locations

**Sprint Status File:**
```
docs/sprint-artifacts/sprint-status.yaml
```

**Story Files Pattern:**
```
docs/sprint-artifacts/{epic}-{story}-{title}.md

Examples:
- docs/sprint-artifacts/2-1-profile-management.md
- docs/sprint-artifacts/2-2-xp-level-display.md
- docs/sprint-artifacts/3-1-horse-list-view.md
```

### Status Values

**In sprint-status.yaml:**
- `pending` - Not started
- `in_progress` - Currently being worked on
- `blocked` - Blocked by dependency or issue
- `completed` - Finished and tested

**In story markdown files:**
- `Status: pending`
- `Status: in_progress`
- `Status: blocked`
- `Status: ✅ completed` (with checkmark emoji)

## Examples

### Good Example: Synchronized Files

**sprint-status.yaml:**
```yaml
2-1-profile-management:
  status: completed
  completed_date: "2025-12-04"
  completion_notes: "32/32 tests passing, ProfilePage implemented"
```

**2-1-profile-management.md:**
```markdown
# Story 2.1: Profile Management

Status: ✅ completed
Completed Date: 2025-12-04

## Completion Notes
**Test Results:** 32/32 tests passing (100%)
```

✅ **Status matches, dates match, both files updated**

### Bad Example: Out of Sync

**sprint-status.yaml:**
```yaml
2-1-profile-management:
  status: completed
  completed_date: "2025-12-04"
```

**2-1-profile-management.md:**
```markdown
# Story 2.1: Profile Management

Status: in_progress  ← WRONG!

- [ ] Task 1  ← WRONG!
- [ ] Task 2  ← WRONG!
```

❌ **Files are out of sync - story file was not updated**

## Enforcement

### Pre-Commit Reminder

The sprint-status.yaml file includes a reminder comment at line 511:

```yaml
# REMINDER: When marking a story as "completed", immediately update the
# corresponding story markdown file (e.g., 2-1-profile-management.md)
# See: docs/sprint-artifacts/STORY_STATUS_UPDATE_PROCESS.md
```

### Code Review

During code review, verify:
1. If sprint-status.yaml shows a story as completed, the story markdown file must also show completed
2. Both files must be included in the same commit
3. Completion notes must be present in both files

## Benefits

Following this process ensures:

✅ **Single Source of Truth:** Both files stay synchronized
✅ **Clear Communication:** Team members see accurate status everywhere
✅ **Better Documentation:** Completion notes captured at the right time
✅ **Audit Trail:** Git history shows both files updated together
✅ **Less Confusion:** No more "Is this story actually done?"

## Related Documents

- [sprint-status.yaml](./sprint-status.yaml) - Sprint tracking file
- Story files: All `docs/sprint-artifacts/{epic}-{story}-*.md` files

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-05 | Initial process documentation (action-3-4) |

---

**Questions?** Ask the team lead or senior developers.
**Updates needed?** Submit a PR to update this document.
