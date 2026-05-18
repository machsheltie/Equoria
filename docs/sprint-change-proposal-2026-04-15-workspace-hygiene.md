# Sprint Change Proposal - Workspace Hygiene Correction

**Project:** Equoria
**Date:** 2026-04-15
**Prepared for:** Correct Course Workflow
**Status:** Implemented (with deviations) — reconciled 2026-05-18 (see Section 7)
**Scope Classification:** Minor - repository hygiene correction with no product behavior change

---

## Section 1 - Issue Summary

The workspace still reports substantial noise after scoped implementation work. The remaining noise falls into three groups:

- Tracked generated dependency output under `frontend/node_modules/` and `packages/database/node_modules/`.
- Gitlink/submodule dirtiness in `SequentialThinking/mcp-server-mas-sequential-thinking`, `backend/augment-vip-main/augment-vip`, and `backend/mcp-server-mas-sequential-thinking`.
- Untracked local artifacts, including `_bmad/`, `docs/BreedData/`, `samples/`, `resize-lusitano.html`, `test-breeding-performance.mjs`, `docs/.archive/`, and `backend/.claude/settings.local.json`.

The tracked dependency output is the actionable repository hygiene defect. `_bmad/`, scratch HTML/scripts, archived docs, and local Claude settings can be ignored as local agent/runtime artifacts. `docs/BreedData/` and `samples/` must remain visible and unignored unless a later explicit decision classifies them as disposable.

---

## Section 2 - Impact Analysis

| Area               | Impact                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product scope      | No MVP or gameplay requirements are changed.                                                               |
| Epics and stories  | No epic sequencing or acceptance criteria change is required.                                              |
| Architecture       | No runtime architecture changes are required.                                                              |
| UI/UX              | No user-facing behavior changes are required.                                                              |
| Repository hygiene | Generated dependency output currently creates large, misleading diffs and hides meaningful source changes. |
| Agent workflow     | Noisy status output increases review risk and makes scoped handoffs harder to verify.                      |

---

## Section 3 - Recommended Approach

Use a direct adjustment:

1. Keep the existing beta production-parity sprint-change proposal intact.
2. Add narrow ignore rules only for local agent/runtime artifacts and scratch files.
3. Remove generated dependency directories from Git tracking with `git rm --cached -r`, preserving files on disk.
4. Leave submodule/gitlink dirtiness untouched because changing gitlinks is a separate dependency-management decision.
5. Re-run `git status --short --branch` to verify only intentional source-control changes remain visible.

**Effort:** Low.

**Risk:** Low to medium. The main risk is review volume because untracking previously committed dependency files creates a large staged deletion. The filesystem remains intact, and dependencies can be restored through package manager install commands.

---

## Section 4 - Detailed Change Proposals

### Change 1 - Ignore local agent/runtime artifacts

**Artifact:** `.gitignore`

**Old behavior:** Local `_bmad`, scratch HTML, local test scripts, archived docs, and nested Claude settings appear as untracked noise.

**New behavior:** Those known local agent/runtime artifacts are ignored until a future scoped story explicitly adds them.

**Rationale:** This preserves the original boundary by not deleting or promoting unrelated artifacts while keeping status output focused. `docs/BreedData/` and `samples/` are intentionally not ignored.

### Change 2 - Stop tracking generated dependencies

**Artifacts:**

- `frontend/node_modules/`
- `packages/database/node_modules/`

**Old behavior:** Dependency install and generated Prisma/Vite output modifies tracked files.

**New behavior:** The directories remain on disk but are removed from the Git index and covered by existing ignore rules.

**Rationale:** Generated dependency output should not be reviewed or committed as product code.

### Change 3 - Leave submodule/gitlink dirtiness for separate handling

**Artifacts:**

- `SequentialThinking/mcp-server-mas-sequential-thinking`
- `backend/augment-vip-main/augment-vip`
- `backend/mcp-server-mas-sequential-thinking`

**Old behavior:** Git reports dirty gitlinks.

**New behavior (as originally proposed):** No change in this correction.

**Actual outcome (reconciled 2026-05-18, Equoria-y3ih / Equoria-t90t):** The three
gitlink directories WERE in fact de-tracked (no mode-160000 index entries
remain, no `.gitmodules` exists) and added to `.gitignore` in commit
`469d76c22` ("chore(21R): no-mocks conversion sweep + repo hygiene",
Equoria-p6fx), NOT in the doc-only commit `9b2471af4`. The originally-proposed
"no change" path was therefore superseded by an explicit
keep-on-disk-but-ignored disposition. See Section 7 for the recorded decision.

**Rationale:** Updating, resetting, or committing gitlinks can change external dependency references. That requires an explicit dependency-management decision — which has now been made and recorded in Section 7.

---

## Section 5 - Implementation Handoff

**Route to:** LeadArchitect / repository maintainer.

**Implementation tasks:**

- [x] Add ignore rules for identified local agent/runtime artifacts.
- [x] Remove tracked generated dependency directories from the Git index without deleting working files.
- [x] Verify status after cleanup.
- [x] Decide separately whether any gitlink/submodule changes should be reset, committed, or documented. **(Resolved 2026-05-18, Equoria-y3ih — see Section 7.2; disposition: keep-on-disk-but-ignored.)**

---

## Section 6 - Success Criteria

- [x] `git status --short --branch` no longer shows modified generated dependency files under tracked `node_modules`.
- [x] Known local agent/runtime artifacts are ignored instead of appearing as untracked changes.
- [x] `docs/BreedData/` and `samples/` remain unignored.
- [~] ~~No submodule/gitlink state is changed by this correction.~~ **CORRECTED 2026-05-18 (Equoria-t90t):** This criterion is FALSE as written. The 3 gitlinks were de-tracked + ignored. The accurate statement is: "Gitlink state WAS changed (de-tracked + ignored) under the explicit disposition decision in Section 7.2; no gitlink content was reset, committed, or deleted from disk." The change occurred in commit `469d76c22`, not the doc commit.
- [x] No product source, tests, package manifests, lockfiles, or planning docs are modified by the **doc commit** `9b2471af4` except this proposal and `.gitignore`. **Verified 2026-05-18 (Equoria-do2j):** `git show --stat 9b2471af4` = exactly 2 files (`.gitignore` +7, this proposal +125, both additions only). NOTE: the broader cleanup (gitlink de-track, `node_modules` index removal) was NOT a single clean commit as originally envisioned — it was bundled into unrelated commits `469d76c22` (gitlinks) and `401d269a1` (node_modules). This deviation is recorded as a process finding in Section 7.3, not a code defect (the end-state is correct).
- [x] The existing beta-readiness sprint-change proposal remains unchanged. **Verified 2026-05-18 (Equoria-do2j):** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` was not touched by `9b2471af4`, `469d76c22`, or `401d269a1`.

---

## Checklist Trace

- [x] Trigger identified: workspace noise after scoped implementation work.
- [x] Core problem defined: generated and local artifacts obscure meaningful diffs.
- [x] Evidence gathered: Git status reported tracked dependency changes, dirty gitlinks, and untracked local artifacts.
- [x] Epic impact assessed: no product epic impact.
- [x] Artifact impact assessed: `.gitignore` and Git index only.
- [x] Path selected: direct adjustment.
- [x] Handoff defined: repository maintainer handles dependency tracking; gitlinks remain separate.

---

## Section 7 - Reconciliation Addendum (2026-05-18)

Added during workspace-hygiene cluster closeout (Equoria-0cxl / do2j / t90t /
y3ih) to make this proposal accurately describe what actually shipped, per
`.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` §4 (no inaccurate/forward references
in docs).

### 7.1 `samples/` source-control visibility (Equoria-0cxl)

**Root cause determined:** `samples/` exists on disk with nested subdirectories
(`BreedData/`, `Breeds/`, `Color Genetics/`, `Competition/`, `Daily/`,
`Epigenetics/`, `Horses/`, …) but `find samples/ -type f` returns **zero
files** — every subdirectory is empty. Git does not track empty directories,
which is why `git ls-files samples/` and `git status --short` show nothing.
`git check-ignore -v samples/` returns no match: it is **NOT shadowed by an
ignore rule** — the "unignored" requirement of Section 1/2 holds. There is
simply nothing to track.

**Disposition:** `samples/` is an intentionally local-only scratch tree (empty
directory skeleton, no committed content). No `.gitkeep` placeholders are added
— doing so would commit a hollow directory tree that serves no reviewer or
build purpose. Section 1/2's "must remain visible and unignored" is satisfied
in the sense that matters: it is not ignored, and if real sample content is
ever added it will appear in `git status` normally. `docs/BreedData/` tracking
is unchanged (`docs/BreedData/generichorse.txt` remains tracked).

### 7.2 Gitlink directory disposition decision (Equoria-y3ih)

**State verified 2026-05-18:** All three directories exist on disk; no
mode-160000 (gitlink) index entries remain; no `.gitmodules` file exists; they
are listed in `.gitignore` ("Stale submodule paths" block):

- `SequentialThinking/mcp-server-mas-sequential-thinking`
- `backend/augment-vip-main/augment-vip`
- `backend/mcp-server-mas-sequential-thinking`

**Decision:** **Keep-on-disk-but-ignored.** These are external developer
tooling (MCP sequential-thinking server, augment-vip), not Equoria product
code or pinned runtime dependencies. They have no `.gitmodules` entry, no
upstream-pinned SHA the build relies on, and no import from `backend/` or
`frontend/` product source. Converting them to proper submodules or npm
dependencies would add maintenance burden for tooling that is per-developer
optional; deleting them from disk would disrupt developers who use them
locally. Ignoring them keeps `git status` clean while leaving each developer's
local copy intact. `.gitignore` lines for these three paths are
**confirmed-correct and documented here** — no change required.

### 7.3 Process deviation: cleanup was not a single clean commit (Equoria-do2j)

The originally-proposed plan (Section 5/6) implied one clean correction commit
touching only `.gitignore` + this proposal. The actual implementation
deviated:

- **Doc commit `9b2471af4`** ("chore: document workspace hygiene correction")
  — clean: exactly `.gitignore` (+7) and this proposal (+125), additions only.
  `git show --stat 9b2471af4` confirms 2 files / 132 insertions.
- **Gitlink de-track + ignore** — landed in `469d76c22` ("chore(21R):
  no-mocks conversion sweep + repo hygiene", Equoria-p6fx), a broad commit, not
  an isolated hygiene commit.
- **`node_modules` index removal** — landed in `401d269a1` ("fix(deploy):
  make prisma migrate non-fatal …"), also not an isolated hygiene commit.

This bundling is a process finding (work that should have been one focused
commit was spread across unrelated commits), not a code defect: the **end
state is correct and verified** (clean status, gitlinks ignored, node_modules
untracked, beta-readiness proposal byte-unchanged). No revert or re-commit is
warranted — undoing and re-landing correct end-state work purely for commit
hygiene would add risk for zero functional gain. Recorded here so the
deviation is not silently papered over.
