# Completion Verification Policy

**Effective:** 2026-04-17
**Trigger:** Adversarial audit found 4/6 Epic 21R stories falsely marked as "done" in sprint-status.yaml

---

## The Problem This Solves

Stories were marked `done` without verifying that acceptance criteria were actually met. The sprint status said "all done" while the codebase contradicted it. This wastes the user's time, erodes trust, and delays real progress.

## Rules

### 1. Never mark a story as `done` without running verification

Before changing any story status to `done` in sprint-status.yaml:

- **Run the acceptance criteria checks** specified in the story. If the AC says "grep returns no matches," run the grep and paste the output.
- **Read the actual files** that were supposed to change. Don't assume your edits landed correctly.
- **Test the feature** if there's a test command. Run it and confirm it passes.

### 2. Never mark a story as `done` without user approval

The user decides when a story is closed. After completing implementation:

1. Report what was done with specific evidence (file paths, line numbers, test results)
2. Report any gaps, risks, or items that were deferred
3. Ask the user to confirm closure

### 3. Never rush to mark something complete

The goal is not to check boxes. The goal is to deliver working features. If it takes 3 sessions instead of 1, that's fine. What's not fine is claiming it's done when it isn't.

### 4. Acceptance criteria are literal

If the AC says:
- "No file in X matches pattern Y" — run the search and verify zero matches
- "Test passes without bypass headers" — actually run the test without bypass headers
- "No mocking in integration tests" — search for mock patterns and verify zero matches
- "CI job runs the readiness script" — read the CI file and verify the script is actually invoked

Do not interpret AC loosely. Do not count "I built infrastructure that could do this" as meeting AC. The AC must be met in the deployed code, verifiable right now.

### 5. Report honestly about what wasn't done

If a story is partially complete, say so. Mark it as `in-progress` with a note about what remains. Never paper over gaps with optimistic status updates.

### 6. Two-tier system is not a fix

Creating a "clean lane" alongside a "dirty lane" (e.g., beta-readiness config vs. main playwright config) does not satisfy AC that say "remove bypasses." Both lanes must be clean. The main path is what matters.

### 7. Verify across all directories

The codebase has multiple locations for similar files (e.g., `backend/tests/`, `backend/__tests__/`, `backend/modules/*/__tests__/`). When an AC says "no mock in integration tests," check ALL directories, not just the one you happened to look at.

## Verification Checklist Template

Before marking any story as `done`, fill out this checklist:

```
Story: [ID]
Date: [date]

[ ] All acceptance criteria verified with evidence (search results, test output)
[ ] Changed files re-read to confirm edits landed correctly
[ ] Related tests pass (run command, paste output)
[ ] No gaps, deferrals, or "will fix later" items remain
[ ] User has approved closure
[ ] Sprint-status.yaml updated with honest status and date
```

## Consequences of Violation

If this policy is violated (stories falsely marked done), the resulting rework will be tracked as a separate bug/task with a note explaining why it exists. The pattern of false completions will be flagged to the user.
