# Retrospective — Fable 5 Window (2026-07-02 → 2026-07-06)

**Facilitated:** 2026-07-06, Day-5 session (bmad-retrospective, autonomous format)
**Scope:** the 5-day Fable window per `FABLE_SPRINT_PLAN.md`; hand-off to the Opus/Sonnet fleet 2026-07-08.

---

## Part 1 — Window review vs. success criteria (sprint plan §7)

| #   | Criterion                                                                   | Outcome                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ranked, filed exploit list for the economy/integrity surface, fix spec each | ✅ Day 1 audit → the 16-issue `qz7au` queue (Round 1); 8 of 16 already LANDED during the window itself (otii0, n4m5j, t7ywe, wsj2i, geo1a, jvi3u, mhdul, hduc5) — the window didn't just spec, it shipped the money-path core         |
| 2   | Locked-in schema/data-model decisions with migration specs                  | ✅ icqqm/c7mx0/6lobd/e7tgc.1 designs approved (SQL-review gate each); exotic-traits decided NO-schema (mapping on `oey96.9`); 4maxb Class-1/Class-2 taxonomy                                                                          |
| 3   | Verified prod-migration runbook awaiting authorization                      | ✅→superseded: v58ta turned out repaired 2026-06-16 — the Day-5 review caught that three handoff docs still carried the stale FAILED premise, one with a destructive re-run instruction (now corrected; `45222` fixes the older docs) |
| 4   | CI/test-infra diagnosis + path to retire `--no-verify`                      | ✅ `docs/debugging-reports/2026-07-06-master-gate-diagnosis.md`; ip8kk landed in-window; only `3ewqy` + the restoration ladder remain (HANDOFF §2)                                                                                    |
| 5   | Correct XP-pipeline architecture spec                                       | ✅ `docs/architecture/show-xp-award-architecture.md` + fleet-ready `oey96.4` (all XP-writer prereqs landed in-window); Day-5 added the settlement-skip addendum (`wmwbr`)                                                             |
| 6   | Security false-green audit                                                  | ✅ Day-4 middleware drift audit → Round 4 batch + SECURITY.md lane; REMOVE decisions recorded (.30/hjnrc)                                                                                                                             |
| 7   | Fleet-executable backlog + dependency-ordered HANDOFF.md                    | ✅ HANDOFF.md written Day 5 after a 4-layer adversarial review (Blind Hunter 24, Edge Case Hunter 16, Acceptance Auditor 11, Backlog Auditor 16 findings over 172 issues) and full remediation                                        |

**All seven criteria met.** The sprint plan's own hedge ("if you get through only the first three…") proved unnecessary.

## Part 2 — What the adversarial review caught (and what it teaches)

**The dominant failure class was documentation staleness, not spec quality.** All four layers converged
on the same diagnosis: the bd issue layer was strong (file:line evidence, literal ACs, recorded
decisions), but the coordination prose (master sequence, round tables) accreted corrections as appended
notes instead of applied edits — leaving "Ready" markers on closed issues, `[PENDING APPROVAL]` on
executed actions, and one genuinely dangerous stale instruction (re-running the already-repaired prod
migration).

**Top catches by severity:**

1. The six fleet docs were **untracked/unpushed** — invisible to the very worktree fan-out they mandate (Constitution §1 violation in the handoff itself).
2. Stale P0-1 instructed a **destructive prod migration re-run** against a repaired database.
3. Two **false-premise issues** would have misdirected agents (`20o40` deleting a live module; `ek242` bypassing a user-owned decision).
4. **Prose-only ordering**: ~10 lane constraints had no bd deps, so `bd ready` surfaced gated work.
5. **Migration-approval ambiguity**: "review before prod apply" read as Railway-only while the local canonical DB holds real player data (the exact c3kb6 surface).
6. Spec-level edge cases: foalBreedId FK time-bomb, GDPR-anonymize stranding, settlement-skip on failed entry tx.

**Lessons carried into the fleet phase (all structural, all applied):**

- **One order document.** HANDOFF.md is canonical; the master sequence is banner-superseded. Two maintained orders = guaranteed drift.
- **Apply corrections, never append them.** A changelog entry that contradicts the operative section above it is worse than either alone.
- **Encode ordering as bd `blocks` deps**, not prose — `bd ready` is what agents actually consult.
- **Every "approved" needs its gate spelled out** at the point of use (SQL review before ANY canonical-DB run).
- **Sentinel semantics must match the defect class**: behavioral red tests for live defects, source-level sentinels for unreachable ones, before/after greps for doc fixes, P2002-assertion (not index-dropping) for DB-constraint invariants.
- **Status tables in prompt docs rot within hours** during active landing windows — they now carry refresh dates and defer to bd.

**Action items (owner: fleet/user, all already tracked):** the HANDOFF §3 user queue; `wmwbr`/`cgx4h`/`cpu7v`/`vb48u` (filed Day 5); the Wave-0 restoration ladder.

## Part 3 — Next-phase preparation

- The fleet starts on the unconditional lanes (Wave 0 + Lane A head + Lane C head + stud fast path + pool) with no user decision required on day 1.
- The first Quality-Gate green will expose ~3 weeks of starved downstream gates — expect a triage day, budget it, attribute reds against the pre-fleet baseline before blaming fleet commits.
- The user's highest-leverage hour: the §3 verify-and-close batch (clears ~10 phantom items off `bd ready`) and the scorer-engine + roster-curve decisions (unblock Lane A tail + Lane B head).
- Readiness verdict: **GO with 4 conditions** — `docs/implementation-readiness-report-2026-07-06.md`.
