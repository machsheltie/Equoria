# Story 21S-6: Make `e2e_critical_path` Readiness Gate Non-Skippable

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change E / Finding P0-5
**Owner:** QualityAssuranceAgent
**Reopens:** Story `21r-6` (was marked done with a skipped gate)

## Problem

`docs/beta-signoff.yaml:32` records:

```yaml
e2e_critical_path: SKIP
skipped: e2e_critical_path (--skip-e2e; requires running backend+frontend servers)
```

Sprint status says _"all 8 beta-readiness gates passing (1 skipped E2E requires live servers)"_ — that's 8 of 9. A readiness gate that can be `SKIP` is not a gate. Story `21r-6`'s own acceptance criterion was _"Beta release candidate cannot be marked ready unless all gates pass"_ — violated.

## Acceptance Criteria

- [ ] `scripts/check-beta-readiness.sh` (or equivalent) removes the `--skip-e2e` branch.
- [ ] Script bootstraps its own backend (port 3001, `NODE_ENV=beta`) and frontend (port 3000) using Playwright's webServer pattern OR a dedicated shell helper. Waits for `/health` on both.
- [ ] Script runs `npx playwright test tests/e2e/beta-critical-path.spec.ts --project=chromium` in the bootstrapped environment.
- [ ] Teardown is reliable (kills child processes on pass, fail, or interrupt).
- [ ] Script fails loudly if either server cannot start.
- [ ] `docs/beta-signoff.yaml` update logic rejects any run where `gates_skipped > 0`.
- [ ] Successful run produces:
  ```yaml
  gates_passed: 9
  gates_skipped: 0
  e2e_critical_path: PASS
  ```

## Dependencies

- Depends on Story 21S-3 (beta profile) — script needs `NODE_ENV=beta` to exist.
- Depends on Story 21S-2 (bypass removal) — critical-path spec must still pass after bypasses are gone.

## Verification

```bash
bash scripts/check-beta-readiness.sh
# Expected: all 9 gates PASS, no SKIP
grep "gates_skipped" docs/beta-signoff.yaml
# Expected: gates_skipped: 0
```

## Out of Scope

- CI integration — that belongs to its own follow-up once this story lands. Script must work locally first.
