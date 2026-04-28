# Edge Case Fix Discipline

**Effective:** 2026-04-28
**Trigger:** Edge Case Hunter audit of CI hardening + request-body security middleware identified P0 fail-open / fail-bypass defects. This rule prevents future "make it green" shortcuts during the fix cycle.

---

## The Rails

These rules are **non-negotiable** while working any issue tagged `21R-CI-*`, `21R-SEC-*`, or `21R-TEST-*`. They also apply to any future hardening work where a defect was identified by adversarial review.

### 1. Failing test FIRST. Always.

Before writing a single line of fix code:

1. Write the test that proves the AC.
2. Run it. **Confirm it fails.** Paste the failure output into the issue.
3. Only then write the fix.
4. Run the test again. Confirm it passes. Paste the passing output into the issue.

If you cannot make the test fail before the fix, the test does not prove the AC.

### 2. No gate weakening. Ever.

If a CI gate fails:
- ❌ Do NOT add `continue-on-error: true`
- ❌ Do NOT widen a regex to "make it stop matching"
- ❌ Do NOT add `--exclude-dir=` for legitimate matches
- ❌ Do NOT add `it.skip` / `test.skip`
- ❌ Do NOT lower `--audit-level`
- ❌ Do NOT delete the test
- ❌ Do NOT comment out the assertion

The only acceptable response is: **fix the underlying defect**.

The exception: `--exclude-dir=readiness` for `21R-CI-1` is fixing a bug in the gate itself (it was scanning intentional doctrine literals). This is a one-time correction, not a precedent.

### 3. No silent catches. Ever.

In security-critical code (anything in `backend/middleware/*Security*`, `backend/middleware/csrf*`, `backend/middleware/auth*`):

- ❌ `try { ... } catch (e) { /* swallow */ }`
- ❌ `try { ... } catch (e) { if (e instanceof X) throw e; }` (silent for non-X)
- ✅ `try { ... } catch (e) { if (e instanceof X) throw e; throw new GenericSecurityError(); }` (fail-closed)

Fail-closed means: on unexpected error in a security boundary, the request is rejected, not allowed through.

### 4. No optimistic completion claims.

Per `COMPLETION_VERIFICATION_POLICY.md`, before marking any issue closed:

1. Re-read the AC literally.
2. Run each AC command.
3. Paste raw output into the issue (not a summary — the actual command + output).
4. **Stop.** Ask the user to confirm closure. Do not close yourself.

### 5. One issue per ralph-loop iteration.

Each `/ralph-loop fix-issue <id>` works ONE issue end-to-end:
1. Read AC.
2. Write failing test.
3. Confirm failure.
4. Implement fix.
5. Confirm test passes.
6. Run the broader test suite for that area.
7. Append verification log to issue.
8. Stop. Do not auto-close. Do not start the next issue.

The loop's job is iteration on a single defect, not throughput.

### 5a. Ralph-loop MUST be invoked with a completion promise.

**Mandatory.** Every `/ralph-loop` invocation for fix work MUST set `--completion-promise` to a literal, machine-checkable assertion. Without one, the loop runs forever and burns tokens after the work is done.

The completion promise must be:
- **Specific** — names the issue ID and the exact verification that proves it done.
- **Literal** — a string the model only outputs when the verification has been run and passed.
- **Tied to AC** — directly mirrors the issue's acceptance criteria, not an interpretation.

**Template:**

```
/ralph-loop fix-issue <Equoria-id> --completion-promise "21R-<X>-N converged: AC grep returns zero matches, doctrine literals intact, verification log appended to <bd-id>, no continue-on-error/skip/regex-weakening introduced. Awaiting user closure."
```

**Concrete example (matches CI-1 work):**

```
/ralph-loop fix-issue Equoria-iswu --completion-promise "21R-CI-1 converged: bypass-header grep with --exclude-dir=readiness returns exit 1 (zero matches) in both workflows; doctrine literals at production-parity.guard.spec.ts:25,32,33,34 and support/prodParity.ts:6,7,8 intact; verification log persisted in bd show Equoria-iswu; no continue-on-error or skip introduced. Implementation complete, awaiting user closure approval."
```

**Rules for the promise:**
- ❌ Do NOT use vague phrases ("looks good", "tests pass", "done") — those let the model exit prematurely.
- ❌ Do NOT include the promise string in user-facing chat or in the loop prompt body — only as the `--completion-promise` argument.
- ✅ Once the model emits the promise verbatim, the loop exits. The model must NOT emit it until every condition is literally true.
- ✅ If the AC includes "no X in codebase", the promise must reference the actual grep/test command and its expected exit code or output.

**If a ralph-loop run starts without a completion promise — stop, kill the loop, restart with one.** A loop without a promise is a runaway process; do not let it spin "just to see how far it gets."

### 6. Iterate until literal AC is met.

If after a loop iteration the AC command does not return the expected result:
- ❌ Do NOT relax the AC.
- ❌ Do NOT mark "good enough."
- ❌ Do NOT defer to a follow-up issue.
- ✅ Run another loop iteration on the same issue.
- ✅ If 3 iterations don't converge, stop and report the obstacle to the user.

### 7. No bundling.

Each defect = one issue = one PR. Do not "while I'm in there" fix anything else. Surface drift to a new issue and continue with the assigned one.

### 8. No new bypasses.

While fixing these issues, you may not introduce ANY of the following — even temporarily:
- `x-test-skip-csrf`, `x-test-bypass-auth`, `x-test-bypass-rate-limit`, `x-test-user`
- `VITE_E2E_TEST` checks in production code
- `MOCK_*` constants in production paths
- `it.skip`, `test.skip`, `describe.skip`, `test.fixme`
- `continue-on-error` in CI workflows
- `expect.assertions(0)` or assertion-free tests

If a fix appears to require one of these, stop and ask the user.

### 9. Roll-up before umbrella closure.

When all `21R-CI-*` and `21R-SEC-*` issues are individually verified and approved by the user, before marking the umbrella `21R` epic complete:

1. Run `bash scripts/check-beta-readiness.sh` end-to-end.
2. Paste full output to a roll-up issue.
3. Re-run each AC command from each closed issue.
4. Paste outputs.
5. Explicit statement: "no gate was relaxed, no test was weakened, no skip was added, no bypass was introduced."
6. Ask user for umbrella closure approval.

### 10. Honest reporting on obstacles.

If a fix legitimately can't be done within the constraints (e.g., a depth cap of 32 breaks a real legitimate payload), the correct action is:

1. Document what was tried.
2. Show the failing case.
3. Propose 2-3 alternatives with tradeoffs.
4. Ask the user which to take.

Never silently weaken the AC to make the fix "work."

---

## Enforcement

This file lives in `.claude/rules/` so every session inherits it via CLAUDE.md context. Violations are tracked as separate bugs with notes explaining why they exist.

If you find yourself thinking "this is good enough" or "the AC is too strict" — stop. Re-read this file. Then ask the user.
