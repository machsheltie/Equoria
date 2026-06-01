# Follow-Up Issue Prioritization

**Date:** 2026-06-01
**Source:** Gaps surfaced during the codebase-quality remediation (Phases 0–3)
**Total follow-ups reviewed:** 13 (10 branch-decision + 3 Epic 21R-8 scope gaps) + 2 ESLint-harness notes

The branch follow-ups were triaged with `git cherry origin/master <branch>`, which compares by **patch-id** — so it tells the difference between "this work was already re-landed on master under a new SHA" (safe to delete) and "this patch is genuinely absent from master" (work would be lost on delete). Every branch's referenced bd issue is already CLOSED, so a branch carrying genuinely-missing patches is a **potential false-closure** and must be verified before deletion.

---

## Priority tiers

### TIER 0 — Beta-blocking scope gaps (do first)

These came out of the Epic 21R-8 audit. They are **IN_PROGRESS** and touch beta-critical paths still on legacy `process.env`.

| Issue             | Branch/Area                      | Why P0                            | Action               |
| ----------------- | -------------------------------- | --------------------------------- | -------------------- |
| **Equoria-xvp6l** | beta-critical-path → process.env | Beta-live path; §2 falsifiability | Migrate + E2E verify |
| **Equoria-ngha8** | feed-system → process.env        | Beta-live path                    | Migrate + E2E verify |
| **Equoria-svz3n** | horse-detail → process.env       | Beta-live path                    | Migrate + E2E verify |

Rationale: §2 says a beta path that isn't exercised by real config defeats the gate. These block beta-readiness signoff; everything else is internal hygiene.

---

### TIER 1 — Branches with 100% genuinely-missing work (false-closure risk — VERIFY then land or delete)

These branches carry commits whose patches are **not** on master, yet their bd issues are CLOSED. Highest risk of lost work. Each needs a per-branch verification: does the _feature/effect_ exist on master under a different implementation, or was it truly lost?

| Issue             | Branch                                 | Missing/Total | Content                                                                                       | Recommended action                                                                                          |
| ----------------- | -------------------------------------- | ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Equoria-7tzz4** | worktree-agent-a7116744f9670f4d0       | **5/5**       | Epigenetics at-birth pipeline, 23-discipline affinity coverage (Equoria-9o3n7 series, CLOSED) | Verify 9o3n7 features live on master. If absent → rebase + land. If present → delete branch, note in 9o3n7. |
| **Equoria-sgc7p** | worktree-agent-ad642b836339656f4       | **7/7**       | Test-fixture hardening — per-test show minting (Equoria-axinb, CLOSED P1 bug)                 | Verify axinb fixtures on master. Land if missing.                                                           |
| **Equoria-84p4k** | chore/code-review-correctness-followup | **3/3**       | Code-review correctness follow-ups + token-family/horseStarterStats sentinel suites           | Verify sentinels exist on master; land the missing ones.                                                    |

⚠️ **Note the overlap:** Equoria-7tzz4 and Equoria-awieu (Tier 2) BOTH carry an Equoria-9o3n7.4 "pregnancy feed-tier bonus" commit — parallel duplicate work. Reconcile together; don't land both.

---

### TIER 2 — Mostly-landed branches, 1 stray commit each (cherry-pick or delete)

Bulk of each branch is already on master; exactly one patch is missing. Cheap to resolve — inspect the single `+` commit, cherry-pick if it carries real value, else delete.

| Issue             | Branch                           | Missing/Total | The one missing commit (area)                                       |
| ----------------- | -------------------------------- | ------------- | ------------------------------------------------------------------- |
| **Equoria-8otex** | worktree-agent-a0edcab3824b25ee3 | 1/8           | genetics — breed-restriction / recolor backfill (26qjf/wvdya/43cj5) |
| **Equoria-awieu** | worktree-agent-a53b185ecc553ec3d | 1/6           | traits — rare-trait casing / epigenetics spec (3hl8c/9o3n7)         |
| **Equoria-il421** | worktree-agent-acd07cd6de3354f8c | 1/7           | SSE — forum-reply / trigger-monitor (o3ync/pwwuz)                   |

---

### TIER 3 — Needs design review (large missing set, likely superseded)

| Issue             | Branch                             | Missing/Total | Why review-first                                                                                                                                                              |
| ----------------- | ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equoria-zfdp6** | claude/seed-real-breed-tests-spUiS | 14/15         | CI breed-seed work tied to an old PR #96. Likely superseded by later breed-seed changes on master; landing as-is could regress CI. Diff against current CI before any action. |

---

### TIER 4 — Safe to delete now (work fully on master)

`git cherry` shows **zero** missing patches — every commit is already on master under an equivalent patch-id. Delete the branch and annotate the parent issue. No verification needed.

| Issue             | Branch                           | Verdict                                                                                |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| **Equoria-fbwic** | worktree-agent-ac242466aacd23469 | 0/4 missing — module reorg (economy/crafting, r9we2) fully landed → DELETE             |
| **Equoria-ww1kg** | worktree-agent-abbe980be6aca7e2e | 0/5 missing — frontend epigenetic-flags UI + E2E (yzqhj.8/2xa8l) fully landed → DELETE |

---

### TIER 5 — Special handling (not code)

| Issue             | Branch     | Verdict                                                                                                                                                                                                                                 |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equoria-hqssy** | beads-sync | 155 commits, but they are `bd sync` DB snapshots from Apr–May 2026, **not source code**. Landing would clobber current beads state with month-old data. → DELETE the branch; do NOT merge. (Confirm current bd state is healthy first.) |

---

### Adjacent: ESLint test-harness debt (low priority, rule works)

| Issue                                 | Note                                                                                                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equoria-4qnc4** / **Equoria-065m8** | RuleTester for `no-forward-reference-comments` fails on ESLint v9 (`languageOptions` shape). The **rule itself functions in production**; only its unit-test harness is incompatible. Fix the test config or migrate to the v9 RuleTester API. P3. |

---

## Suggested execution order

1. **Tier 0** (3 issues) — unblock beta readiness.
2. **Tier 4 + Tier 5** (3 issues) — fast wins, zero-risk deletions, shrink the queue immediately.
3. **Tier 1** (3 issues) — the real risk; verify false-closure suspicion, land lost work.
4. **Tier 2** (3 issues) — cheap cherry-pick-or-delete, reconcile the 9o3n7.4 duplicate.
5. **Tier 3** (1 issue) — design review against current CI.
6. **Tier-adjacent ESLint** (2 issues) — when convenient.

## Method caveat (honesty, OPTIMAL_FIX §10)

`git cherry` proves _patch_ presence/absence, not _feature_ presence. A Tier-1 "5/5 missing" can still mean the feature was re-implemented differently on master (patch differs, effect identical). That is exactly why Tier 1 says **VERIFY, then** land-or-delete — do not bulk-delete Tier 1 on the patch-id signal alone, and do not bulk-land it either. The verification is per-branch and belongs to whoever works the issue.
