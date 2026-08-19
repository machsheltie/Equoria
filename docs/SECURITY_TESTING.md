# Security Testing Strategy

**Status:** active source-first index
**Last verified:** 2026-08-19

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

| Concern                            | Authority                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Security operating rules           | `.claude/rules/SECURITY.md`                                                       |
| Security test selection/thresholds | `backend/jest.config.security.mjs`                                                |
| Security test command              | `backend/package.json`                                                            |
| Security test inventory            | Current files selected by `backend/jest.config.security.mjs`                      |
| Middleware and controls            | `backend/middleware/`, `backend/modules/auth/`, `backend/config/`                 |
| Security automation                | `.github/workflows/security-scan.yml`, `.github/workflows/codeql.yml`             |
| Dependency updates                 | `.github/dependabot.yml`                                                          |
| Doctrine/evidence gates            | `.github/workflows/` and `scripts/doctrine-checks/`                               |
| Sentry/telemetry                   | `backend/config/sentry.mjs`, `frontend/src/lib/sentry.ts`, `docs/SENTRY_SETUP.md` |

Before naming a test path, verify it exists; security tests have been relocated more than once.

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
