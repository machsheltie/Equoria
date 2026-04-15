# Story Equoria-imp.1: Restore working typecheck/lint baseline and fix broken helper scripts

Status: review

<!-- Bead-sourced remediation story. This work is intentionally outside the active sprint-status map. -->

## Story

As a maintainer,
I want repo-level lint and helper entry points to execute real checks on Windows,
so that remediation work is blocked only by actual code defects instead of broken tooling commands.

## Acceptance Criteria

1. `npm --prefix frontend run lint` starts ESLint successfully and evaluates files using the current flat config; it no longer exits because of the unsupported `--ext` flag.
2. `node utils/agent-skills/auditor.mjs .` runs successfully on the current Windows/PowerShell environment without syntax errors and without depending on Unix-only `grep`.
3. This story does not absorb the legacy CI-scope cleanup assigned to `Equoria-imp.2`; after implementation, any remaining failures must be real code/config issues rather than immediate CLI-flag or helper-script syntax failures.
4. Remaining blockers discovered during verification are captured in the completion notes so follow-on stories can pick up from a truthful baseline.

## Tasks / Subtasks

- [x] Task 1: Reproduce the current baseline failures and keep scope tight (AC: 1, 2, 3)
  - [x] Run `npm --prefix frontend run lint` and confirm the current failure is the flat-config-incompatible `--ext` usage.
  - [x] Run `node utils/agent-skills/auditor.mjs .` and confirm the current failure is the helper script itself, not the audit results.
  - [x] Run `npm run typecheck` after the tooling fixes only to record whether any remaining failures belong to `Equoria-imp.2`.

- [x] Task 2: Fix the frontend lint entry point for flat config (AC: 1)
  - [x] Update [frontend/package.json](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/package.json) so the `lint` script uses a flat-config-compatible invocation.
  - [x] Keep the command aligned with [eslint.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js) instead of reintroducing CLI file-extension scoping.
  - [x] Do not widen scope into backend lint or root workflow cleanup in this story.

- [x] Task 3: Repair the auditor helper for Windows and cross-platform use (AC: 2)
  - [x] Fix the invalid string literal / newline syntax in [utils/agent-skills/auditor.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/utils/agent-skills/auditor.mjs).
  - [x] Replace the shell-dependent `grep` strategy with a cross-platform search approach. Prefer `rg` when available; use a native Node fallback if needed.
  - [x] Preserve the intent of the tool: search code files for `console.log`, `TODO`, and obvious hardcoded-secret heuristics while excluding generated/vendor directories.
  - [x] Keep the implementation ASCII-only and avoid introducing new runtime dependencies.

- [x] Task 4: Verify the baseline and document remaining real blockers (AC: 3, 4)
  - [x] Re-run `npm --prefix frontend run lint` and confirm it now performs real linting.
  - [x] Re-run `node utils/agent-skills/auditor.mjs .` and confirm it completes successfully on Windows.
  - [x] Re-run `npm run typecheck` and record any remaining failures without fixing legacy CI-scope issues in this story.
  - [x] Capture all residual blockers in the story completion notes for the next bead stories.

## Dev Notes

### Scope Boundary

- This story is a tooling-baseline repair, not a repo-wide CI green-up.
- Do not fix or remove legacy files in [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json) here; that is the purpose of `Equoria-imp.2`.
- Do not relax linting, disable rules, or weaken CI expectations to make commands appear green.

### Relevant Existing Behavior

- [frontend/package.json](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/package.json) currently defines:
  - `lint`: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
- [eslint.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js) is already a flat config and scopes frontend TypeScript files through config blocks, so the CLI should not depend on `--ext`.
- [utils/agent-skills/auditor.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/utils/agent-skills/auditor.mjs) currently has two independent defects:
  - invalid multiline string syntax in the banner/footer logging
  - a Unix-only `grep` command that is not appropriate for this Windows workspace

### Architecture / Workflow Guardrails

- Follow the repo rule from [project-context.md](C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/implementation-artifacts/project-context.md): Windows commands should not rely on `&&`, and preferred search tooling is `rg`.
- Keep the change surface narrow:
  - expected code edits are [frontend/package.json](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/package.json) and [utils/agent-skills/auditor.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/utils/agent-skills/auditor.mjs)
  - verification reads may include [eslint.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js), [package.json](C:/Users/heirr/OneDrive/Desktop/Equoria/package.json), and [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json)
- Avoid changing dependency lists or adding packages unless absolutely necessary. The helper can be repaired with built-in Node APIs and existing `rg`.

### Expected Remaining Blocker After This Story

- Root `npm run typecheck` is still expected to surface legacy-scope issues from [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json), including `frontend/components/**/*`. That is a truthful remaining defect and should be handed to `Equoria-imp.2`, not silently hidden here.

### Verification Commands

- `npm --prefix frontend run lint`
- `node utils/agent-skills/auditor.mjs .`
- `npm run typecheck`

### Recent Git Intelligence

- Recent commits show active frontend/UI work and API cleanup:
  - `1fdb02b6 feat(22-6): custom game component library — 12 components + 44 tests`
  - `381f3c7a fix(epic5): fix API URL mismatches + add prize/leaderboard backend routes`
  - `72752c07 fix(notifications): invalidate next-actions cache on horse rename and store purchase`
- Keep this story isolated to tooling entry points so it does not create unrelated regressions in actively changing frontend code.

### Project Structure Notes

- Alignment:
  - Root ESLint config already owns file scoping and rule selection for frontend TS/TSX.
  - The helper script belongs under `utils/agent-skills/` and should remain a lightweight CLI utility.
- Known conflict to preserve for next story:
  - Root TypeScript include scope still reaches legacy `frontend/components/**/*`, which is why typecheck remains a separate remediation item.

### References

- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/package.json]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/utils/agent-skills/auditor.mjs]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/package.json]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/implementation-artifacts/project-context.md]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/docs/frontend-integration-backlog.md]

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- Initial reproduction commands:
  - `npm --prefix frontend run lint`
  - `node utils/agent-skills/auditor.mjs .`
  - `npm run typecheck`
- Validation outcomes:
  - `npm --prefix frontend run lint` now starts ESLint and reports real repo issues instead of failing on `--ext`.
  - `node utils/agent-skills/auditor.mjs .` now exits successfully on Windows and reports findings using the Node fallback scanner in this environment.
  - `npm run typecheck` still fails in legacy `frontend/components/GroomAssignmentManager.js` with `TS2657: JSX expressions must have one parent element`.

### Completion Notes List

- Updated [frontend/package.json](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/package.json) to use a flat-config-compatible lint command: `eslint . --max-warnings 0`.
- Rebuilt [utils/agent-skills/auditor.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/utils/agent-skills/auditor.mjs) as a cross-platform CLI utility that prefers `rg` and falls back to a native Node recursive scan when `rg` is unavailable.
- Tightened the auditor ignore list to skip generated and archive directories such as `.claude`, `.backups`, `_bmad-output`, and other non-source worktrees so audit output is actionable.
- Residual blocker intentionally left for `Equoria-imp.2`: root `npm run typecheck` still fails on `frontend/components/GroomAssignmentManager.js(208,9)` because root `tsconfig.json` includes the legacy `frontend/components/**/*` tree.
- Residual blocker surfaced truthfully by the repaired lint command: `npm --prefix frontend run lint` now reports 392 real frontend lint problems across active and legacy files instead of a command-line failure.
- No new dependencies were added and no CI scope was relaxed in this story.
- Review follow-up resolved: the `ripgrep` path in `utils/agent-skills/auditor.mjs` now derives its ignore globs from the same `IGNORED_DIRS` source used by the Node fallback, so both execution modes honor the same archive/generated-folder exclusions.

### File List

- `frontend/package.json`
- `utils/agent-skills/auditor.mjs`

### Change Log

- 2026-04-06: Repaired frontend lint entry point for ESLint flat config and replaced the broken Windows-incompatible auditor helper with a working cross-platform implementation.
