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
- [ ] **§9 self-critique pass executed** (see below) — gaps surfaced, fixed or filed.
- [ ] **§10 evidence is post-change** — full test suite re-run AFTER the iteration's edits, with raw output captured. "No expected regressions" is not evidence; the actual run is.
- [ ] User has confirmed closure (per `COMPLETION_VERIFICATION_POLICY.md`).

Any unchecked item = work pending. Do not call it done.

### 9. Self-critique pass — required BEFORE writing the "done" summary.

The pattern this rule prevents: agent does the work, declares done, user runs `/ultra-think` and finds 5+ real gaps, agent fixes them, declares done again, user runs `/ultra-think` again, finds more gaps, repeat. Each round is real work. Each round wastes the user's time and erodes trust.

The fix: **the agent runs the adversarial critique on its own work BEFORE writing the bd-notes "complete" summary, not in response to user pressure.**

Before writing any "this is done" or "AC met; hardening complete" or "all items addressed" message, the agent MUST:

1. **Re-read the work** — every file changed, every test added, every line of bd notes drafted.
2. **Apply the §1 audit lens** — does the literal AC actually solve the problem?
3. **Apply the §2 sentinel lens** — does each test actually catch the failure mode it claims to catch? Are any tests vacuously-true / silently-skipped / using conditional assertions that no-op? Are boundaries covered, not just middles?
4. **Apply the §3 adjacent-locations lens** — what other files / functions / patterns have the same defect? Are they filed as follow-ups?
5. **Apply the §4 documentation lens** — do all comments / commit messages / bd notes describe what's ACTUALLY in the commit (no forward references, no overclaim)?
6. **Apply the §5 alternative lens** — was at least one alternative considered? Is the chosen approach the cleanest, or just the cheapest?
7. **Apply the §6 honesty lens** — what was NOT done? Is the bd notes' top-line framing honest about the scope of "fixed"?
8. **Audit until convinced the work is sound. Report what you find regardless of count.** If you find zero genuine gaps, explicitly state in the bd notes that you ran §9 and found none — DO NOT pad the report with trivia to hit a number. A pretend-finding is worse than no finding because it dilutes signal and trains future readers (including future-you) that §9 output is mostly noise. If you find ten, list ten. If three, list three. The goal is honesty, not throughput.

For each genuine gap found:
- If small + in-scope: fix it now, before declaring done.
- If larger or out-of-scope: file as follow-up bd issue, link to the parent.
- Document both categories in the bd notes' "what was NOT done" section.

Then — and only then — write the "done" summary.

**Single requirement**: §9 runs before every "done" message. There is no soft/hard gate distinction (the previous wording was incoherent — a "soft gate" the agent enforces on itself is not a gate). This rule is on the honor system; the user holds the agent accountable, and failing §9 means the user has to ask for the critique pass — which is the exact failure mode this rule exists to prevent. If the agent is uncertain whether §9 has been run for the current iteration, run it again before declaring done. Cost of a redundant §9 pass: small. Cost of skipping it: the loop the user has been ending all session.

Padding §9 with trivia to "look thorough" is itself a §9 violation. The next §9 pass should catch the padding.

### 10. Post-change evidence, not pre-change inferences.

When claiming "no regressions" or "tests still pass" or "the suite is green":

- ❌ "Last suite run was N suites passing; this iteration only adds tests, so no expected regressions."
- ✅ Re-run the full suite AFTER the iteration's edits. Capture raw output. Cite it.

The pre-change baseline is irrelevant evidence for the post-change state. Adding tests CAN cause regressions (test-ordering flakes, shared mutable state, mock leakage, runtime contention). The only way to know is to actually run.

If the suite takes a long time, run it in the background and continue with other work. Don't ship a "no expected regressions" hedge to save 5 minutes of compute. The user said it's the wrong trade-off.

---

## Enforcement

This file lives in `.claude/rules/` and is referenced from `CLAUDE.md`. It loads as session context. The rules are non-negotiable when working any defect-fix issue, hardening issue, or PR addressing reviewer feedback.

If you find yourself thinking:

- "The AC is met, that's enough" — re-read §1, §2, §6.
- "I shouldn't bundle this with other work" — re-read §3 (file separate issues, don't ignore).
- "The user probably doesn't want me to spend more time" — re-read §7.
- "It's a small thing, the comment is close enough" — re-read §4.
- "First approach worked, ship it" — re-read §5.
- "I'll just write the done summary now and the user will tell me if anything's wrong" — re-read §9. Do the self-critique pass first. Every time. Without exception.
- "I need to find 3 things in §9 even if there aren't 3 real ones" — re-read §9. The quota was removed; padding is itself a violation.
- "Re-running the full suite to prove no regressions takes too long" — re-read §10. The user has explicitly said time is not the constraint. Correctness is.

Then act on what you re-read.
