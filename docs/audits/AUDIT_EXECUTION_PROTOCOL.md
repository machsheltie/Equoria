# Audit Remediation — Execution Protocol (MANDATORY)

**Applies to:** every `bd` issue labeled `audit-20260702`.
**Audience:** the agent (Opus 4.8 / Sonnet 5) executing the issue.
**Status:** Reading this document end-to-end is part of every audit issue's acceptance criteria. If you have not read it in THIS session, read it now, before opening any source file.

---

## Who this protocol assumes you are

You are capable, fast, and enthusiastic. Your known failure mode — measured repeatedly in this repo (see `AUDIT_FINDINGS_21R_FALSE_CLOSURE.md`: 4 of 6 stories falsely marked done) — is **declaring work complete before verifying it meets all criteria**. You pass your own new test, feel the glow of a green checkmark, and close the ticket while the actual acceptance criteria sit unread. This protocol exists to make that impossible. Follow it literally. It is not advisory.

The one-sentence version: **you are done when every AC command has been run and its raw output is pasted into the issue — and even then, you do not close the issue. The user closes it.**

---

## The Iron Rules

1. **Re-verify the evidence before you start.** Every issue cites `file:line` evidence gathered on 2026-07-02. Code moves. Open each cited file and confirm the problem still exists exactly as described. If it doesn't — if someone already fixed it, or the code was refactored — **STOP. Do not improvise a different fix.** Post what you found to the issue (`bd update <id> --append-notes "..."`) and report to the user.
   _Carve-out (2026-07-06):_ **pure line-number drift with the defect intact is NOT a STOP.** Serial lanes deliberately rewrite hot files before downstream issues run, so cited line numbers WILL drift. If the described defect still exists — same file, same mechanism, just different lines — append the corrected `file:line` citations to the issue and continue. STOP only when the defect itself is gone or the mechanism changed.

2. **Failing test FIRST. Always.** (EDGE_CASE_FIX_DISCIPLINE §1.) Before any fix code:
   - Write the test that proves the defect (real DB, no mocks — see rule 4).
   - Run it. **Confirm it fails for the reason the issue describes** (not an import error, not a typo — the actual defect).
   - Paste the raw failure output into the issue.
   - Only then implement. Then run it again and paste the raw pass output.
   - If you cannot make the test fail before the fix, your test does not prove the AC. Rewrite it.
   - _Carve-out for DOC-ONLY issues (2026-07-06):_ where the entire change is documentation text, the "failing test" is the AC's grep/citation run BEFORE the edit showing the stale text present (pasted), and the same grep AFTER showing it corrected. Do not fabricate a vacuous executable test for a doc fix.

3. **The AC is literal.** (COMPLETION_VERIFICATION_POLICY §4.) If the AC says "grep returns zero matches," you run that exact grep and paste its output. "I built infrastructure that could satisfy this" is not meeting the AC. "My new unit test passes" is not meeting the AC. Interpretation is not permitted; execution is.

4. **Real DB, no mocks, no bypasses. Ever.** (CLAUDE.md Constitution §3.) Backend tests hit the real canonical DB via the existing patterns. Fixture horses use `createTestHorse()` or spread `...fixtureColor()` (see `.claude/rules/CONTRIBUTING.md`). Cleanup is scoped (`where: { id: { in: collectedIds } }` or `TestFixture-` name prefixes) — a bare `deleteMany()` is forbidden and destroys real player data. Frontend behavior gets Playwright E2E against the real backend, not new `vi.mock` tests. If a fix seems to require `test.skip`, a bypass header, `continue-on-error`, or weakening an assertion — **STOP and ask the user** (EDGE_CASE_FIX_DISCIPLINE §8).

5. **One issue, one commit (or two: test-then-fix), on master, pushed same-session.** (Constitution §1, §5.) No branches. If you discover an adjacent sibling defect: do NOT fix it in this commit — file a new `bd` issue for it, cite it in your commit message, and stay on your assigned issue (EDGE_CASE_FIX_DISCIPLINE §7).

6. **Docs move with code.** If your fix invalidates a doc claim (SECURITY.md, a PRD line, a story file), correct that doc line **in the same commit**, unless the issue explicitly assigns the doc fix elsewhere. No forward references — comments/docs must describe the commit they ship in (OPTIMAL_FIX_DISCIPLINE §4).

7. **Push discipline.** Before pushing: run `bash scripts/doctrine-checks/run-all.sh` and confirm exit 0 (mandatory — Equoria-64tby), then `git push origin master --no-verify` (active exception, CLAUDE.md). Never two pushes in parallel.

---

## The STOP gates (post to the issue and ask the user; do not proceed)

- The cited evidence no longer matches the code.
- The fix requires a **product decision** the issue marks as user-owned (several issues have an explicit "DECISION REQUIRED" section — those decisions are the user's, not yours; Constitution §6).
- Your change makes any previously-passing test fail and the failure isn't a test that needs _legitimate_ updating per the issue's plan. "The old test is brittle" is a conclusion you must earn with evidence, never a starting position.
- You want to add any bypass/skip/mock, weaken any assertion, or relax any AC.
- The work is ballooning past ~2 commits of change — split it: file follow-up issues, ship what's done.

---

## Verification & reporting protocol (before you say the word "done")

Run, in order, and record each in the issue via `bd update <id> --append-notes`:

1. **Every AC command in the issue, literally, with raw output pasted.** Not summarized — pasted.
2. **The area test suite** named in the issue (e.g., `npm test -- grooms` from `backend/`). Raw tail of the output pasted (totals line at minimum). This must be run AFTER your final edit (OPTIMAL_FIX_DISCIPLINE §10 — post-change evidence, not pre-change inference).
3. **The §9 self-critique pass** (OPTIMAL_FIX_DISCIPLINE §9): re-read your diff; audit AC-vs-problem, sentinel quality, adjacent locations, doc accuracy, alternatives, honesty. Report what you find — zero findings is a legitimate answer if true; padding is a violation.
4. **The what-was-NOT-done list** — every deferred item gets its own filed `bd` issue cited by ID (Constitution §5's deferral channel). A sentence in a report is not a deferral; an issue is.

Then post the completion report in this exact shape:

```
## Completion report — <issue-id>
- What was done: <files:lines changed, behavior now>
- AC evidence: AC1 <command> → <result> ... (raw output appended above)
- Post-change suite: <command> → <totals>
- §9 self-critique: <findings or "ran, none found">
- What was NOT done: <items, each with a filed bd issue ID, or "nothing">
- Risks / known limitations: <...>
Ready for user review. NOT closing — awaiting user approval (Constitution §6).
```

## Closure

**You may NOT run `bd close` on an audit issue. Ever.** The user reviews the completion report and closes it. Marking the issue `in_progress` at start (`bd update <id> --claim`) and appending notes is yours; closure is not. If you feel the urge to close because "everything passed" — that urge is the exact failure mode this protocol exists to stop. Post the report and stop.

---

## Quick command reference

```bash
# Claim the issue at start
bd update <id> --claim

# Backend tests (from backend/): pattern-scoped
npm test -- <pattern>            # e.g. npm test -- grooms
# Frontend unit (from frontend/):
npx vitest run <path-or-pattern>
# Playwright E2E (from repo root or frontend/ per config):
npx playwright test <file>

# Append evidence
bd update <id> --append-notes "AC1 output: ..."

# Doctrine gate before push (MANDATORY, must exit 0)
bash scripts/doctrine-checks/run-all.sh
git push origin master --no-verify
```
