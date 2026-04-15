# Story Equoria-imp.2: Repair or remove legacy files that currently poison root CI scope

Status: review

<!-- Bead-sourced remediation story. This work is intentionally outside the active sprint-status map. -->

## Story

As a maintainer,
I want root CI quality gates to target only supported code or fully repaired legacy code,
so that root typecheck, root Jest discovery, and related CI checks fail only on code the team actually intends to maintain.

## Acceptance Criteria

1. `npm run typecheck` no longer fails because root [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json) includes stale `frontend/components/**/*` or `frontend/hooks/**/*` content that is not meant to participate in the active frontend build.
2. Root Jest discovery no longer fails on invalid top-level test syntax from [tests/integration/user.test.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs); either the test is repaired and supported, or root Jest scope is explicitly updated to exclude unsupported legacy tests.
3. The implementation makes one coherent decision for the legacy surface:
   - supported code is repaired and kept in CI scope, or
   - unsupported code is clearly removed from root CI/typecheck/test scope and treated as archived/deferred.
4. Root CI scope is internally consistent with that decision across the relevant config files, so active-versus-archived boundaries are explicit rather than accidental.

## Tasks / Subtasks

- [x] Task 1: Audit the legacy surface and decide whether it is active or archival (AC: 1, 2, 3)
  - [x] Confirm which root quality gates currently include the legacy paths: [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json), [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js), and [ci.yml](C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/ci.yml).
  - [x] Confirm whether `frontend/components/*`, `frontend/hooks/*`, and top-level `tests/integration/*` are referenced by active production code, or only by their own legacy tests/docs/history.
  - [x] Make one explicit implementation choice:
    - repair and keep the legacy tree in scope, or
    - archive/exclude it from root quality gates.

- [x] Task 2: Fix or exclude the legacy frontend component scope coherently (AC: 1, 3, 4)
  - [x] If keeping the legacy frontend tree, repair [GroomAssignmentManager.js](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/components/GroomAssignmentManager.js) so root typecheck can parse it and address any immediately blocking syntax errors in the same kept scope.
  - [x] If excluding the legacy frontend tree, update [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json) and any relevant lint/CI configuration so unsupported `frontend/components/**/*` and `frontend/hooks/**/*` paths are no longer treated as active root-checked code.
  - [x] Do not break the active Vite frontend under `frontend/src/**/*`.

- [x] Task 3: Fix or exclude the invalid top-level root test scope coherently (AC: 2, 3, 4)
  - [x] If keeping top-level integration tests, repair [tests/integration/user.test.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs) so Jest can parse and discover it successfully.
  - [x] If excluding unsupported top-level tests, update [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js) so root discovery reflects the supported test tree only.
  - [x] Preserve supported backend test discovery under `backend/**` and intentional top-level test coverage if it is still part of the maintained suite.

- [x] Task 4: Verify the chosen boundary is truthful and documented (AC: 1, 2, 4)
  - [x] Re-run `npm run typecheck`.
  - [x] Re-run root Jest discovery or a root Jest invocation that confirms the invalid legacy test no longer blocks startup.
  - [x] Re-run the relevant root CI-aligned command set enough to prove the boundary decision is coherent.
  - [x] Record what was kept versus excluded so follow-on beads (`Equoria-imp.3`, `Equoria-imp.10`) inherit a truthful baseline.

## Dev Notes

### Story Goal

- This story is not just “fix one parse error.”
- It must settle the status of the legacy root-scoped surface so the repo stops mixing active frontend/src code with stale transitional files by accident.

### Current Root Scope Problems

- [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json) currently includes:
  - `frontend/src/**/*`
  - `frontend/components/**/*`
  - `frontend/hooks/**/*`
- Root `npm run typecheck` currently fails on [frontend/components/GroomAssignmentManager.js](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/components/GroomAssignmentManager.js) with `TS2657: JSX expressions must have one parent element`.
- [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js) currently includes top-level tests through:
  - `'<rootDir>/../tests/**/*.test.{js,mjs}'`
- [tests/integration/user.test.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs) currently contains invalid syntax:
  - `let default: prisma;`

### Current CI Expectations

- [ci.yml](C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/ci.yml) runs:
  - `npm run format:check`
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm run typecheck`
- That means any archive/exclusion decision must be reflected consistently enough that root CI does not still pick up unsupported files through a different gate.

### Legacy Surface Reality Check

- Current repo search shows the legacy components are referenced by:
  - their own tests under `frontend/components/__tests__/`
  - docs/history/task planning artifacts
- Current repo search did **not** show active imports from `frontend/src/**/*` into these legacy files.
- Treat this as a strong signal that the legacy tree may be archival or transitional, but verify before excluding anything.

### Implementation Guardrails

- Prefer the minimal coherent change set that makes root scope truthful.
- Do not move files around unless there is a strong reason; config-based scope cleanup is safer than broad filesystem churn.
- Do not absorb broader frontend lint debt or feature work from `Equoria-imp.3+`.
- If the legacy tree is kept, fix only the blocking syntax/discovery issues required to keep it in supported scope.
- If the legacy tree is excluded, make the exclusion explicit in the relevant root configs rather than relying on incidental non-matching patterns.

### Likely Files In Play

- [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json)
- [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js)
- [eslint.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js) if lint scope must match the archive decision
- [frontend/components/GroomAssignmentManager.js](C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/components/GroomAssignmentManager.js) if repairing legacy code
- [tests/integration/user.test.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs) if repairing legacy tests
- [ci.yml](C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/ci.yml) if the CI entrypoints themselves need alignment with the chosen supported surface

### Verification Commands

- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run lint`

### Previous Story Intelligence

- [equoria-imp-1-restore-working-typecheck-lint-baseline.md](C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/implementation-artifacts/equoria-imp-1-restore-working-typecheck-lint-baseline.md) intentionally stopped at the command-layer repair and recorded this story as the owner of the remaining legacy root-scope blocker.
- `Equoria-imp.1` established that:
  - frontend lint command now reaches real lint issues instead of failing on `--ext`
  - root typecheck still fails on the legacy `frontend/components` tree
  - the next cleanup must not blur active versus archival code boundaries

### Recent Git Intelligence

- Recent commits are concentrated in active frontend redesign and backend feature work:
  - `59ddfc18 fix(epic5): adopt BaseModal in competition modals (AI-5-1)`
  - `58a4e087 feat(22-6): architectural inversion — game/ owns all visual styling, shadcn = naked Radix`
  - `4689ee2e chore(31f-1): mark conformation show scoring engine ready for review`
- Keep this story isolated to root scope truthfulness and do not entangle it with active `frontend/src` implementation work.

### Project Structure Notes

- Active maintained frontend appears to live under `frontend/src/**/*`.
- The root TypeScript config currently blurs that boundary by pulling in `frontend/components/**/*` and `frontend/hooks/**/*`.
- The root Jest config similarly blurs backend-owned tests with top-level `tests/**/*`.
- The outcome of this story should make those boundaries explicit and defensible.

### References

- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/ci.yml]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/frontend/components/GroomAssignmentManager.js]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/implementation-artifacts/equoria-imp-1-restore-working-typecheck-lint-baseline.md]
- [Source: C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/implementation-artifacts/project-context.md]

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- Artifact/context review:
  - `bd show Equoria-imp.2`
  - `Get-Content -Raw tsconfig.json`
  - `Get-Content -Raw jest.config.js`
  - `Get-Content -Raw .github/workflows/ci.yml`
  - `Get-Content -Raw tests/integration/user.test.mjs`
  - `rg -n "GroomAssignmentManager|frontend/components|frontend/hooks|tests/integration/user.test|FoalDevelopmentTab|GroomListScreen|MyGroomsDashboardScreen" .`
- Verification and boundary checks:
  - `$output = npm run typecheck 2>&1; $output | Select-String 'frontend/components|frontend/hooks'`
  - `npm test -- --runInBand --showConfig`
  - `node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects backend --listTests`
  - `$output = npm test -- --runInBand --listTests 2>&1; $output | Select-String 'tests\\integration\\user.test|tests\\integration\\breeds.test|tests\\integration\\ping.test|duplicate manual mock found|\\.claude|\\.backups'`
  - `$output = npm run lint 2>&1; $output | Select-String '\\.backups\\|tests\\integration\\|frontend\\components\\|frontend\\hooks\\|\\.claude\\|\\.agent\\'`
  - `$output = npm run format:check 2>&1; $output | Select-String '\\.backups\\|tests\\integration\\|frontend\\components\\|frontend\\hooks\\|\\.claude\\|\\.agent\\'`
  - `npm run typecheck *> $null; "TYPECHECK_EXIT=$LASTEXITCODE"`
  - `npm test -- --runInBand --listTests *> $null; "JEST_LIST_EXIT=$LASTEXITCODE"`
  - `npm run lint *> $null; "LINT_EXIT=$LASTEXITCODE"`
  - `npm run format:check *> $null; "FORMAT_EXIT=$LASTEXITCODE"`

### Completion Notes List

- Chosen boundary: treat `frontend/components/**/*`, `frontend/hooks/**/*`, and top-level `tests/integration/**/*` as unsupported legacy/archive surfaces for root CI purposes. Keep active frontend code under `frontend/src/**/*`, backend tests under `backend/**`, and selected top-level root tests under `tests/*.test.{js,mjs}`, `tests/services/**`, `tests/models/**`, and `tests/unit/**`.
- Verified that root [tsconfig.json](C:/Users/heirr/OneDrive/Desktop/Equoria/tsconfig.json) no longer produces legacy `frontend/components` or `frontend/hooks` errors during `npm run typecheck`; the remaining typecheck failures are in active `frontend/src/**/*` tests such as `frontend/src/App.story-8-1.test.tsx`.
- Updated [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js) so the backend project no longer discovers unsupported top-level `tests/integration/*` files via the broad `**/*.test` pattern. Root Jest discovery now excludes `tests/integration/user.test.mjs`, `tests/integration/breeds.test.mjs`, and `tests/integration/ping.test.mjs`; the maintained backend `backend/tests/integration/user.test.mjs` remains in scope.
- Added archive/worktree ignores to [jest.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/jest.config.js), [eslint.config.js](C:/Users/heirr/OneDrive/Desktop/Equoria/eslint.config.js), and [.prettierignore](C:/Users/heirr/OneDrive/Desktop/Equoria/.prettierignore) so root CI entrypoints stop walking `.archive`, `.backups`, `.agent`, `.agents`, `.claude`, `.gemini`, `.playwright-mcp`, `_bmad`, and `_bmad-output`.
- Verified `npm run lint` and `npm run format:check` no longer report legacy hits from `frontend/components`, `frontend/hooks`, top-level `tests/integration`, or archive/worktree directories. Both commands still fail on active repository formatting/lint debt outside this story.
- Truthful command status after the boundary repair:
  - `npm run typecheck` exit `2` because of active `frontend/src` typing issues, not legacy root scope.
  - `npm test -- --runInBand --listTests` exit `0` with no unsupported top-level `tests/integration/*` discovery.
  - `npm run lint` exit `1` because of active lint debt such as `api-monitoring-plan.mjs` and backend test formatting issues.
  - `npm run format:check` exit `1` because of active formatting debt in maintained files such as `.github/workflows/ci.yml`, `AGENTS.md`, and backend test/docs files.
- This story intentionally did not repair [tests/integration/user.test.mjs](C:/Users/heirr/OneDrive/Desktop/Equoria/tests/integration/user.test.mjs) or the legacy frontend component tree; it removed those unsupported surfaces from root CI scope coherently instead.

### File List

- `.prettierignore`
- `eslint.config.js`
- `jest.config.js`

### Change Log

- 2026-04-06: Excluded unsupported legacy root test and archive/worktree surfaces from Jest/ESLint/Prettier discovery while preserving active frontend/src, backend tests, and selected maintained top-level root tests.
