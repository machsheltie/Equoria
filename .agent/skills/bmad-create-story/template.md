# Story {{epic_num}}.{{story_num}}: {{story_title}}

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a {{role}},
I want {{action}},
so that {{benefit}}.

## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

<!--
  PRODUCTION PATH VALIDATION — REQUIRED FOR INTEGRATION STORIES
  Include this task block when the story modifies an existing game system
  (training, competition, breeding, groom, foaling, conformation, etc.).
  Delete this block for greenfield/scaffolding stories.

  Source: Epic 31D Retro 2026-03-31, Action Item #4. Concrete instance:
  calculateCompetitionScore was modified in competitionScore.mjs (31D-3)
  but competitionController.mjs imported from competitionLogic.mjs, so
  the temperament modifier never fired in production despite 100% unit
  test coverage on the modified function.
-->

- [ ] **Production path validation** (required for any change to an existing game system)
  - [ ] Identify the production entry point (HTTP route / job / cron / event handler) that USERS hit to trigger this feature.
  - [ ] Trace the call chain: route → controller → service → modified function. Paste the chain into Dev Notes with file paths + line numbers.
  - [ ] Assert (in the integration test or via a runtime check) that the modified function is actually invoked on the production path. If the controller imports from a sibling module, verify that sibling exports the modified function — not a stale duplicate.
  - [ ] If multiple files export functions with the same name, document which one is canonical and why.

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
