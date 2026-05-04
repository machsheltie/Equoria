<!--
Equoria PR template (B3 / Equoria-qj75). The "Doctrine evidence" sections
below are checked by the `pr-body-evidence` CI workflow on every pull
request. Empty checkboxes, missing exit codes, or blank evidence blocks
will fail the gate. If a section does not apply to your PR, replace its
body with `N/A — <one-sentence reason>` rather than deleting the heading.

Why this exists: under deadline pressure (or autonomous-agent completion
drive), the cheapest path is to claim a fix is verified without showing
the verification. This template forces the verification to be pasted
into the PR description itself, where it stays for review and audit.
-->

## Summary

<!-- 1–3 bullets describing what this PR changes and why. -->

-

## Test plan

<!-- Bulleted markdown checklist of what was tested. -->

- [ ]

## Doctrine evidence (required for merge — 21R hardening)

### 1. Doctrine-gate result

<!--
  Run the relevant doctrine checks for this PR. For most changes:
    bash scripts/doctrine-checks/run-all.sh
  Paste the exit code and the last 5 lines of output below. If
  doctrine-checks does not yet have coverage for the change class, run
  `npm test` or the relevant suite and paste THAT exit code + tail.
-->

**Exit code:** _<paste exit code here>_

**Last 5 lines of output:**

```
<paste here>
```

### 2. No new bypass mechanisms

<!-- Tick every box. If a check does not apply to your PR, tick it
     anyway and add a one-line note explaining why it is N/A. -->

- [ ] No new `--exclude-dir=` flags added to CI grep scans
- [ ] No new `continue-on-error: true` on security, coverage, or doctrine steps
- [ ] No new `it.skip` / `test.skip` / `describe.skip` / `test.fixme` in beta-readiness paths
- [ ] No new `if: github.ref == 'refs/heads/master'` on jobs named `*-gate*` (gates must run on PRs to be useful)

### 3. Gate enforcement (only for PRs that ADD a new CI gate)

<!--
  If this PR adds a new CI job that is supposed to BLOCK merges, tell
  the reviewer where the block is wired. If the PR adds no new gate,
  replace this whole section with `N/A — no new gate added`.
-->

- Workflow file:
- Job name:
- Deployment-gate needs-list line number:
- Branch-protection rule required for master: `[ ]`

### 4. Middleware test coverage (only for PRs that ADD new middleware)

<!--
  If this PR adds a new file under `backend/middleware/*Security*`,
  `backend/middleware/csrf*`, `backend/middleware/auth*`, or any
  request-pipeline middleware, link the test file. If the PR adds no
  new middleware, replace this section with `N/A — no new middleware`.
-->

- New middleware file:
- Test file:
