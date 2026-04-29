# Doctrine Checks

Machine-checked enforcement of Equoria's documented rules. Each script in this
directory verifies one rule from `CLAUDE.md`,
`.claude/rules/COMPLETION_VERIFICATION_POLICY.md`, or the 21R beta-readiness
doctrine. Each script exits non-zero on violation.

`run-all.sh` invokes every check and aggregates failures.

## Why these exist

Doctrine in prose is bypassable: an agent can interpret around it, a developer
can forget it, a reviewer can miss it. Doctrine in CI is not bypassable: the
workflow fails, the merge is blocked, the rule is enforced.

If you find yourself wanting to add `--exclude-dir`, `continue-on-error: true`,
`it.skip`, or any other "small exception just for this case", that is a story
to fix the underlying problem. It is not a license to weaken the check.

## Scripts

- `check-no-bypass-headers.sh` — no `x-test-*` / `VITE_E2E_TEST` anywhere in
  E2E specs or frontend api-client. No directory exclusions allowed.
- `check-audit-level.sh` — every `npm audit` step in `.github/workflows/`
  uses `--audit-level=moderate` or stricter (`low`).
- `check-gates-run-on-prs.sh` — every job named `*-gate` (except those in
  `gates-allowlist.txt`) must run on PRs, not just master.
- `check-no-skips-in-readiness.sh` — no `it.skip` / `test.skip` /
  `describe.skip` / `test.fixme` in any beta-readiness Playwright spec.

## Adding a new check

1. Drop a script in this directory. It must exit `0` on pass, non-zero on
   fail, and print the offending file:line on fail.
2. Append it to `run-all.sh`.
3. If the rule needs an allowlist (e.g., `gates-allowlist.txt`), document why
   each entry is exempt directly in the allowlist file as a comment.
4. Add the rule to `CLAUDE.md` so humans see what the script enforces.

## Running locally

```bash
bash scripts/doctrine-checks/run-all.sh
```

The pre-push hook runs this automatically. CI re-runs it on the merge commit
to catch any push that used `--no-verify`.
