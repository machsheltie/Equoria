# Sprint Change Proposal - Workspace Hygiene Correction

**Project:** Equoria
**Date:** 2026-04-15
**Prepared for:** Correct Course Workflow
**Status:** Implementation in progress
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

**New behavior:** No change in this correction.

**Rationale:** Updating, resetting, or committing gitlinks can change external dependency references. That requires an explicit dependency-management decision.

---

## Section 5 - Implementation Handoff

**Route to:** LeadArchitect / repository maintainer.

**Implementation tasks:**

- [x] Add ignore rules for identified local agent/runtime artifacts.
- [x] Remove tracked generated dependency directories from the Git index without deleting working files.
- [x] Verify status after cleanup.
- [ ] Decide separately whether any gitlink/submodule changes should be reset, committed, or documented.

---

## Section 6 - Success Criteria

- [x] `git status --short --branch` no longer shows modified generated dependency files under tracked `node_modules`.
- [x] Known local agent/runtime artifacts are ignored instead of appearing as untracked changes.
- [x] `docs/BreedData/` and `samples/` remain unignored.
- [x] No submodule/gitlink state is changed by this correction.
- [ ] No product source, tests, package manifests, lockfiles, or planning docs are modified except this proposal and `.gitignore`.
- [ ] The existing beta-readiness sprint-change proposal remains unchanged.

---

## Checklist Trace

- [x] Trigger identified: workspace noise after scoped implementation work.
- [x] Core problem defined: generated and local artifacts obscure meaningful diffs.
- [x] Evidence gathered: Git status reported tracked dependency changes, dirty gitlinks, and untracked local artifacts.
- [x] Epic impact assessed: no product epic impact.
- [x] Artifact impact assessed: `.gitignore` and Git index only.
- [x] Path selected: direct adjustment.
- [x] Handoff defined: repository maintainer handles dependency tracking; gitlinks remain separate.
