# Security Testing Strategy

**Status:** active source-first index
**Last verified:** 2026-09-16

This document routes security-test work to current code and configuration. It does not certify current security posture, freeze coverage totals, or replace a fresh assessment.

## Loading rule

Load this file only when changing security controls, security tests, security CI, or a security-coverage claim. For ordinary backend/frontend tests, use `AGENTS.md`, `CLAUDE.md`, and current package scripts.

## Non-negotiable evidence rules

- Exercise the real security middleware and an intended disposable test database for integration evidence.
- Do not cite bypass headers, route interception, test-only production branches, skipped tests, empty placeholders, or mocked security boundaries as readiness evidence.
- Assert fail-closed behavior on rejection paths.
- Pair static/doctrine scans with sentinel-positive validation where feasible.
- Reproduce every security claim against current source; dated audit totals are not evidence.

## Current sources

| Concern                            | Authority                                                             |
| ---------------------------------- | --------------------------------------------------------------------- |
| Security operating rules           | `.claude/rules/SECURITY.md`                                           |
| Security test selection/thresholds | `backend/jest.config.security.mjs`                                    |
| Security test command              | `backend/package.json`                                                |
| Security test inventory            | Current files selected by `backend/jest.config.security.mjs`          |
| Middleware and controls            | `backend/middleware/`, `backend/modules/auth/`, `backend/config/`     |
| Security automation                | `.github/workflows/security-scan.yml`, `.github/workflows/codeql.yml` |
| Dependency updates                 | `.github/dependabot.yml`                                              |
| Doctrine/evidence gates            | `.github/workflows/` and `scripts/doctrine-checks/`                   |

Before naming a test path, verify it exists; security tests have been relocated more than once.

## What the security suite selects

The Security Gate does **not** run the whole backend suite. It did until Equoria-ugxuc,
and that was a defect: ~12.4k tests in one Jest process, and five foal-creation cases
failing on HTTP 429. This config does not load `backend/tests/setup.mjs`, so the
`TEST_RATE_LIMIT_*` knobs are unset and `mutationRateLimiter` runs at its literal
30-per-60-seconds rather than the 1000/15min the shard matrix uses — a domain suite that
issues more than 30 mutations a minute fails here and nowhere else. The tighter caps are
the more honest profile for a security suite and are kept; what was wrong is that the
security gate was running domain suites at all. `backend/jest.config.security.mjs` now
selects in three declared layers.

Practical consequence when adding a suite here: budget mutations against
`mutationRateLimiter`'s 30/60s, not against the shard matrix's 1000/15min.

**1 — Control-source scope.** The test homes of the sources in the "Middleware and
controls" row above: `backend/__tests__/**` (middleware sentinels and cross-module
integration, per `.claude/rules/CONTRIBUTING.md`) and `backend/modules/auth/__tests__/**`.

**2 — Naming convention for module-resident control tests.** Control tests are not
filed by control source. IDOR, authz, admin-MFA, ownership, admin-guard and per-route
rate-limit suites live with the domain module whose route they guard. Any `.test.mjs` or
`.spec.mjs` file under `backend/modules/**/__tests__/**` (any depth, any module except
`auth`, which layer 1 already covers in full) whose **file name** contains one of these
**case-sensitive** tokens is in the gate:

| Token                 | Control class                                              |
| --------------------- | ---------------------------------------------------------- |
| `Idor`                | Insecure direct object reference / cross-owner read scope  |
| `Authz`               | Route authorization and role gates                         |
| `Security`            | Route security pipeline, search/query hardening            |
| `Mfa`                 | Admin second-factor enforcement                            |
| `Ownership`           | Ownership checks on assignment and mutation                |
| `AdminGuard`          | Admin-only endpoint guards                                 |
| `ServerAuthoritative` | Server-authoritative award/economy values the client sends |
| `-rate-limiting`      | Per-route rate-limit suites (kebab suffix, not a token)    |

**Name a new control test with one of these and it lands in the gate with no config
edit.** The tokens are case-sensitive because Jest's `testMatch` globs are; spell them
exactly as above. Add a token to this table and to `MODULE_CONTROL_TOKENS` in the config
in the same commit.

**3 — Explicit list.** `EXPLICIT_MODULE_CONTROL_TESTS` in the config, for control suites
the convention cannot name (parentage hijack, the two mass-assignment sentinels,
deliberately closed endpoints, an environment-gated bypass route). Add to it rather than
renaming a suite whose name already means something — `horseUpdateBreedMassAssign` is
spelled `MassAssign`, its sibling `userUpdateMassAssignment` is not, and neither spelling
is a token. Add the file to `REQUIRED_MODULE_CONTROL_TESTS` in the sentinel at the same
time, or the list is unguarded.

`backend/__tests__/securitySuiteScope.sentinel.test.mjs` pins all three. It asks Jest
itself (`--listTests`) what the config selects, and fails if the selection is empty, if a
pattern escapes the backend test trees, if the `modules/auth` scope is dropped, if a
pinned control suite or a convention match is not selected, or if the domain suites are
swept back in. Its list of required control suites is deliberately independent of the
config, so deleting a token cannot quietly shrink the gate.

Everything outside these three layers is a domain test and still runs, blocking, in the
`Backend Tests` shard matrix. Selection is a scope, never a way to make a red gate green.

## Commands

From the repository root:

```bash
npm --prefix backend run test:security
npm --prefix backend run test:security:coverage
bash scripts/doctrine-checks/run-all.sh
```

For a narrow area, pass the current test path through the repository's targeted backend runner rather than copying an old raw Jest invocation:

```bash
npm run test:backend:targeted -- path/to/current-security-test.mjs
```

Use a disposable test database selected for the test profile. Never point security tests at production or a shared canonical database.

## Coverage claims

Do not state “OWASP 10/10,” a test count, a coverage percentage, or a control status from memory or this document. Derive it from:

1. current middleware/control source;
2. current security-test files and assertions;
3. current executable tests and their assertions;
4. current CI configuration and an actual run;
5. current issue state for known gaps.

An N/A category must be justified by the absence of an attack surface. A placeholder test with no production assertion is not coverage. A file logger or best-effort telemetry stream is not automatically a tamper-evident audit trail.

## Change checklist

1. Identify the production boundary and its failure mode.
2. Confirm middleware ordering and every route mounting the control.
3. Add/update a failing real-path test that proves the defect or invariant.
4. Implement the smallest complete control fix without bypasses.
5. Run the focused test, security suite, relevant integration/E2E path, and doctrine gates.
6. Keep current status in issues/evidence, not in this strategy document.
