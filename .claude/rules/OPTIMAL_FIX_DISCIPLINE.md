# Optimal Fix Discipline

**Effective:** 2026-04-28
**Trigger:** Recurring pattern of "AC met, ship it" fixes during 21R hardening that satisfied literal acceptance criteria while leaving real architectural gaps, missing positive tests, and inaccurate documentation. The user repeatedly stressed "correct, not fastest." This file codifies the depth of verification that "correct" requires, so it doesn't depend on remembering.

This rule complements `EDGE_CASE_FIX_DISCIPLINE.md`. That rule prevents bypasses (no skips, no continue-on-error, no widened regex). This rule prevents shallow fixes (AC met but problem not actually solved well).

---

## The Pattern This Prevents

**"Done" defaults to the cheapest interpretation.** When two readings are available — strict (AC literally met) and rigorous (problem solved correctly with verification of no hidden gaps) — the cheap reading wins by default. That default is wrong for this codebase.

Symptoms of the pattern:
- AC says "command X returns zero output." Fix makes command X return zero output. No test that command X would return non-zero output if the defect re-appeared.
- Comment in code references a convention that exists in a different (not-yet-merged) PR.
- Fix introduces an exclusion / exemption / special case but doesn't enforce that the exemption stays minimal.
- Fix never considers an architectural alternative that would eliminate the need for the fix entirely.
- "Adjacent locations" with the same defect pattern are not checked or surfaced.
- The agent reports "done" without enumerating what it deliberately did NOT do.

If any of those symptoms appear in a fix, the fix is not done — it's pending.

---

## The Rules

### 1. Audit the AC before satisfying it.

Before writing fix code:

1. Re-read the AC.
2. Ask: **"If I literally satisfy this AC, does the underlying problem actually go away, or just the symptom the AC describes?"**
3. Ask: **"Could the AC pass while the original defect persists in a slightly different form?"**
4. If yes to either, propose AC additions to the user before starting. Do not silently broaden the AC; do not silently narrow it.

The AC is a hypothesis about what proves the fix. Sometimes the hypothesis is incomplete.

### 2. Sentinel-positive test required.

For every fix that adds, modifies, or strengthens a check / gate / scan / validator:

- Write a test that **demonstrates the check fires on a real violation**, not just that the check passes when nothing is wrong.
- "It returns zero matches now" is not a test of the check. "It returns the violation when I plant one, and zero when I remove it" is.
- The sentinel must run in CI, not just locally. If the check ever silently degrades, the sentinel must fail.

A check without a positive test is a placebo.

### 3. Adjacent-locations check: is this defect a class or an instance?

Before declaring a fix done:

1. Search the codebase for the same defect pattern in other locations (`grep`/`Grep` for the offending construct).
2. If the pattern appears elsewhere, those are likely the same defect (or its siblings).
3. **Do not bundle the fix** (per `EDGE_CASE_FIX_DISCIPLINE.md` §7). Instead: file separate issues for each adjacent occurrence. Reference them in the current fix's commit message.

The point: surface the class. Don't let "I only fixed the one I was told about" leave four others lurking.

### 4. Document accuracy: no forward references.

Comments, README sections, commit messages, and verification logs must describe the actual state of the commit they ship in. Specifically:

- ❌ Comment: "Uses the doctrine-allow marker convention" — when no doctrine-allow markers exist in the current commit.
- ❌ Comment: "See B1 PR for the full enforcement" — when B1 PR doesn't exist or isn't linked.
- ❌ Doc: "The new sentinel test catches X" — when the sentinel doesn't exist yet.

If the doc references a future state, mark it explicitly: "(planned in <issue-id>)". Better: don't ship the comment until the referenced thing exists.

### 5. Evaluate at least one architectural alternative.

For every non-trivial fix:

1. Brainstorm at least one alternative approach to solve the same problem.
2. Articulate why the chosen approach is preferred (or, if it isn't, why it ships anyway — e.g., scope, time, dependency).
3. If the alternative is materially better but out of scope, file an issue for it. Reference the issue in the commit.

The point: avoid "first thing I thought of becomes the design." Even one alternative considered improves quality of choice.

### 6. State what was NOT done.

In the verification log / commit message / completion report:

- Enumerate the things you considered and chose not to do, with reasons.
- Enumerate the things you didn't have time / scope to do, with linked follow-up issues.
- Enumerate the gaps you know about that the AC doesn't catch.

A completion report that lists only what was done is misleading by omission. The user needs to make decisions based on the full state, not the rosy summary.

### 7. The user-time fallacy.

It is **never** "respecting the user's time" to ship a shallow fix without surfacing the gaps. The user's time is best respected by:

- Doing the work correctly the first time so they don't have to reopen it.
- Surfacing the trade-offs so they can choose the depth they want.
- Trusting that when they say "I don't care how long, do it correctly," they mean it.

Defaulting to "fast" because the user might not want "thorough" is a projection of training priors, not a respect of stated preferences.

### 8. Definition of "Done" — checklist.

Before reporting a defect-fix as complete, all of these must be true:

- [ ] AC met literally (raw command + raw output in the issue).
- [ ] Sentinel-positive test added and verified to fail when defect re-introduced.
- [ ] Adjacent-locations search done; siblings filed as separate issues if found.
- [ ] All comments / docs / commit messages accurate at the current commit (no forward references).
- [ ] At least one architectural alternative considered and noted (preferred or filed as spike).
- [ ] What-was-NOT-done section in the verification log.
- [ ] User has confirmed closure (per `COMPLETION_VERIFICATION_POLICY.md`).

Any unchecked item = work pending. Do not call it done.

---

## Enforcement

This file lives in `.claude/rules/` and is referenced from `CLAUDE.md`. It loads as session context. The rules are non-negotiable when working any defect-fix issue, hardening issue, or PR addressing reviewer feedback.

If you find yourself thinking:

- "The AC is met, that's enough" — re-read §1, §2, §6.
- "I shouldn't bundle this with other work" — re-read §3 (file separate issues, don't ignore).
- "The user probably doesn't want me to spend more time" — re-read §7.
- "It's a small thing, the comment is close enough" — re-read §4.
- "First approach worked, ship it" — re-read §5.

Then act on what you re-read.
