# Security Testing Strategy

**Status:** Canonical index — authored 2026-05-18 (Equoria-zma4)
**Scope:** How Equoria's security controls are verified, where the tests live,
how to run them, and what is intentionally out of scope.

This document is the entry point for security-testing strategy. It links the
detailed per-attack catalogue (`backend/__tests__/integration/SECURITY_TEST_COVERAGE.md`),
the control documentation (`.claude/rules/SECURITY.md`), and the CI pipeline.
Paths below were verified against the repository on 2026-05-18; no coverage
numbers are fabricated — figures are stated only where the source artifact is
named so they can be re-derived.

---

## 1. Testing Philosophy (Non-Negotiable)

Per the project Testing Philosophy (`CLAUDE.md`):

- **No mocks.** Backend security tests run against the real test database with
  the real security middleware mounted. A test that passes while hiding a
  broken control is worse than no test.
- **No bypass headers as evidence.** `x-test-skip-csrf`, `x-test-bypass-auth`,
  `x-test-bypass-rate-limit`, `x-test-user`, `x-test-bypass-ownership`,
  `VITE_E2E_TEST`, and route interception MUST NOT be cited as security-readiness
  evidence. A helper that still injects those headers keeps its suite out of
  readiness claims until replaced with a real-token helper.
- **Fail-closed verification.** Security boundary tests assert the request is
  _rejected_ (not `next()`'d) on the failure path, so a fall-through /
  fail-open regression actually fails the test.
- **Sentinel-positive.** A check is verified by demonstrating it fires on a
  planted violation, not only that it passes when nothing is wrong (see
  `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` §2).

---

## 2. Where the Security Tests Live

Equoria has multiple `__tests__` roots. Security coverage is distributed
across the following verified locations:

| Area                               | File(s)                                                                                                                                                             | What it covers                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attack simulation (OWASP)          | `backend/modules/services/__tests__/security-attack-simulation.test.mjs`                                                                                            | IDOR, broken access control, injection, sensitive-data-exposure scenarios. Catalogued in `SECURITY_TEST_COVERAGE.md`.                                                              |
| OWASP comprehensive                | `backend/modules/services/__tests__/owasp-comprehensive.test.mjs`                                                                                                   | A06/A08/A09/A10 categories (component integrity, logging/monitoring, SSRF).                                                                                                        |
| Auth bypass attempts               | `backend/modules/services/__tests__/auth-bypass-attempts.test.mjs`                                                                                                  | Forged/expired/replayed JWTs, header manipulation, direct endpoint access (HTTP stack).                                                                                            |
| Auth middleware (unit/integration) | `backend/__tests__/middleware/authMiddlewareCoverage.test.mjs`                                                                                                      | Direct real-DB coverage of `middleware/auth.mjs`: token verification, algorithm-confusion rejection, CWE-613 iat-predates-rotation, role checks, fail-closed paths (Equoria-fzt5). |
| SQL injection                      | `backend/modules/services/__tests__/sql-injection-attempts.test.mjs`                                                                                                | Parameterised-query / ORM injection resistance.                                                                                                                                    |
| Parameter / prototype pollution    | `backend/modules/services/__tests__/parameter-pollution.test.mjs`, `requestBodySecurity.test.mjs`, `request-body-security-p0-follow.test.mjs`                       | CWE-1321 prototype pollution, duplicate-key, depth-cap, fail-closed request-body security (21R-SEC-\*).                                                                            |
| Rate limiting                      | `backend/modules/services/__tests__/rate-limit-*.test.mjs`, `rate-limiting.test.mjs`, plus per-module `*-rate-limiting.test.mjs` (auth, competition, horses, users) | Enforcement, circuit-breaker, key derivation, no-bypass.                                                                                                                           |
| CSRF                               | `backend/modules/auth/__tests__/csrf-integration.test.mjs`, `csrf-production-cookie.test.mjs`, `authenticated-auth-routes-csrf.test.mjs`                            | CSRF token issuance + enforcement, production cookie flags.                                                                                                                        |
| Bypass-header hardening            | `backend/__tests__/middleware/bypassHeaderHardening.test.mjs`                                                                                                       | Confirms test-only bypass headers are inert in non-test environments.                                                                                                              |
| Security validation                | `backend/modules/services/__tests__/security.test.mjs`, `securityValidation.test.mjs`, `securityValidationExtended.test.mjs`                                        | Input validation / sanitisation primitives.                                                                                                                                        |

The authoritative per-attack catalogue (attack vector → expected defense →
test) is `backend/__tests__/integration/SECURITY_TEST_COVERAGE.md`. This
strategy doc is the index; that doc is the detail.

---

## 3. How to Run

```bash
# Backend security suite via the strict per-file-threshold config
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --config=jest.config.security.mjs --runInBand

# A single security area
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --testPathPattern="auth-bypass-attempts|authMiddlewareCoverage" --runInBand --no-coverage

# Security-scoped coverage artifact (regenerates coverage-security/)
npm run test:security:coverage
```

`jest.config.security.mjs` enforces hard per-file coverage thresholds on the
security-critical middleware (`middleware/security.mjs`,
`sessionManagement.mjs`, `validationErrorHandler.mjs`,
`utils/validateEnvironment.mjs` at 100%; documented honest reductions noted in
that config). It deliberately omits a `global` threshold because the narrow
security slice would drag a whole-tree average down — per-file is the contract.

---

## 4. CI / Pipeline Security Gates

Verified against `.github/` on 2026-05-18:

- **`.github/workflows/security-scan.yml`** — "OWASP ZAP Security Scan":
  - **Dependency Vulnerability Scan** job: `npm audit` for backend, frontend,
    and root; uploads `security-audit-reports`; comments on the PR when
    vulnerabilities are found.
  - **ZAP Baseline + API scans**: advisory mode driven by
    `.github/zap-rules.tsv` (IGNORE/WARN/FAIL classification). WARN-threshold
    alerts collect for SARIF triage without failing CI; FAIL-tagged rules hard
    block. Scheduled weekly (`cron: '0 2 * * 1'`).
- **`.github/workflows/codeql.yml`** — CodeQL static analysis.
- **`.github/dependabot.yml`** — daily `npm` updates for `/backend`,
  `/frontend`, `/` and `github-actions` updates; security-priority patching.
- **`.github/workflows/doctrine-gate.yml`, `evidence-verification.yml`,
  `pr-body-evidence.yml`, `blind-hunter-gate.yml`** — enforce the no-bypass /
  evidence doctrine on PRs.
- **`scripts/check-beta-readiness.sh`** — the final beta signoff gate. Relevant
  security gates: Gate 6 (no HTTP test-cleanup routes), Gate 7 (no mock primary
  paths), Gate 8 (no bypass headers in E2E specs or api-client; doctrine-allow
  markers are filtered, not blanket-excluded). Must run with all gates enabled
  and no skip flags.

---

## 5. OWASP Top 10:2021 Mapping

Control implementation and the test files proving each category are documented
in `.claude/rules/SECURITY.md` (§ "OWASP Top 10:2021 Compliance") and
`docs/SECURITY_ASSESSMENT_REPORT.md` (§2). Those are the authority for the
control→test mapping; this doc does not duplicate it to avoid drift.

**Honest summary (do not restate as "10/10" — that was a corrected
false-green; see SECURITY_ASSESSMENT_REPORT.md §2 and Equoria-9s9f / zuva):**

- **A01–A06, A08:** implemented controls with real HTTP-stack test coverage in
  the §2 files.
- **A07:** single-factor only — **no MFA** (zero TOTP/MFA code; tracked
  Equoria-2vwwh). Auth-failure / rate-limit tests cover the implemented path.
- **A09:** **PARTIAL** — Winston file logging + Sentry only; **no DB-backed,
  queryable, tamper-evident audit trail** and the `auditLog()` middleware is
  opt-in per route, not globally enforced (tracked Equoria-jw10w). The
  `owasp-comprehensive.test.mjs` A09 block asserts file-path behavior, not a
  DB trail.
- **A10:** **N/A** — there is no external-URL/SSRF attack surface in
  production. The `owasp-comprehensive.test.mjs` A10 `it()` blocks are **empty
  placeholders** (all bodies commented out, no assertions) for hypothetical
  future URL-input features — they exercise zero production code and must not
  be cited as A10 coverage. An SSRF-guard is a prerequisite gate before any
  user-supplied-URL feature (tracked Equoria-4dva).

So the accurate statement is **8/10 categories implemented, A09 partial, A10
N/A** — not "all 10 have dedicated coverage".

---

## 6. Intentionally Out of Scope

- **Load/stress security testing** beyond rate-limit enforcement correctness is
  not part of this suite.
- **Live penetration testing** is a manual activity (see SECURITY.md §"Manual
  Testing"); it is not automated here.
- **Frontend security unit tests with mocked APIs** are not added; user-facing
  security flows are covered by Playwright E2E against the real backend (no
  bypass headers) instead.
- **SSRF outbound-request hardening** beyond the A10 simulation in
  `owasp-comprehensive.test.mjs` is gated on a feature decision and is not
  expanded here.

---

## 7. Related Documents

- `.claude/rules/SECURITY.md` — security controls + OWASP compliance matrix.
- `backend/__tests__/integration/SECURITY_TEST_COVERAGE.md` — per-attack
  catalogue (attack vector → defense → test).
- `.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md` /
  `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` — fix discipline for security
  defects (no bypasses, sentinel-positive tests).
- `docs/SENTRY_SETUP.md` — security event alerting configuration.
