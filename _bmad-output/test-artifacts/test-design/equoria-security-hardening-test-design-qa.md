---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-24'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/project-context.md'
  - 'backend/package.json'
  - 'backend/__tests__/integration/security/parameter-pollution.test.mjs'
  - 'tests/e2e/readiness/production-parity.guard.spec.ts'
  - '.github/workflows/test.yml'
  - '.github/workflows/security-scan.yml'
---

# Test Design for QA: Equoria Security Hardening

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-04-24  
**Author:** Murat (TEA)  
**Status:** Draft  
**Project:** Equoria

**Related:** See Architecture doc `equoria-security-hardening-test-design-architecture.md` for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Security validation for auth/session configuration, token-at-rest protection, parser-layer malicious input rejection, and release-gate enforcement.

**Risk Summary:**

- Total Risks: 8 (6 high-priority, 1 medium, 1 low)
- Critical Categories: `SEC`, `OPS`

**Coverage Summary:**

- P0 tests: ~24
- P1 tests: ~18
- P2 tests: ~10
- P3 tests: ~6
- **Total:** ~58 tests (~2-3 weeks with 1 QA plus backend/platform support)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Full gameplay regression** | This plan targets security hardening, not complete product validation | Existing functional suites continue to run separately |
| **Manual penetration testing** | Valuable but not the fastest blocking control for this sprint | Keep as follow-on after automated gate exists |

**Note:** These exclusions are acceptable only because the goal is immediate hardening of known launch risks.

---

## Dependencies & Test Blockers

### Backend/Architecture Dependencies

1. **Secret validation implementation** - Backend/Platform - before next deploy
   - QA needs startup rejection behavior for placeholder and missing secrets.
   - Without it, release governance remains non-verifiable.

2. **Hashed token storage migration** - Backend - before next deploy
   - QA needs migrated refresh and verification token storage.
   - Without it, P0 token-at-rest validation cannot pass.

3. **Parser-layer hostile payload defense** - Backend - this sprint
   - QA needs duplicate-key and prototype-pollution rejection ahead of handlers.
   - Without it, known skipped security tests stay blocked.

4. **Blocking security CI gate** - Platform - before next deploy
   - QA needs one deployment prerequisite that consumes security evidence.
   - Without it, the pipeline still ships failures.

### QA Infrastructure Setup

1. **Security fixtures**
   - Valid and invalid auth sessions
   - Placeholder-secret env profiles
   - Token-family reuse data

2. **Environment lanes**
   - Local API lane for fast integration tests
   - CI lane for blocking `backend test:security`
   - Controlled readiness lane with retained artifacts

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| **R-001** | SEC | Predictable runtime secrets and CSRF fallback secret | **9** | Boot validation, negative startup, and secret-source checks |
| **R-002** | SEC | Plaintext refresh tokens at rest | **9** | DB assertion plus login/refresh/reuse regression tests |
| **R-003** | SEC | Plaintext email verification tokens at rest | **9** | DB assertion plus verification lifecycle tests |
| **R-004** | SEC/OPS | Advisory security gates | **9** | CI policy validation and deployment dependency checks |
| **R-005** | SEC | Parser-layer malicious payload gaps | **6** | Unskipped hostile-payload tests and endpoint coverage expansion |
| **R-006** | OPS | Manual readiness signoff | **6** | Artifacted readiness validation in controlled lane |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| R-007 | DATA | Missing traceability from risk to gate | 4 | Add evidence matrix and required artifact checks |
| R-008 | PERF | Security controls add auth latency | 2 | Small k6 auth/profile smoke threshold check |

---

## Entry Criteria

- [ ] Secret validation code merged
- [ ] Token hashing migration merged
- [ ] Parser hardening merged
- [ ] Security gate job present in CI
- [ ] Local/CI test environments accessible
- [ ] Known skipped security tests re-enabled or actively under implementation

## Exit Criteria

- [ ] All P0 tests passing
- [ ] All P1 tests passing or formally waived
- [ ] No open score-9 security risks
- [ ] No skipped P0 security tests
- [ ] Blocking security gate enforced in deployment workflow

---

## Test Coverage Plan

**Note:** `P0/P1/P2/P3` = priority and risk level, not execution timing.

### P0 (Critical)

**Criteria:** Blocks secure launch, no workaround, direct compromise or shippable governance failure.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P0-001** | App rejects missing `JWT_SECRET` in deployable mode | API/Startup | R-001 | Negative startup validation |
| **P0-002** | App rejects placeholder `JWT_SECRET` in beta/beta-readiness | API/Startup | R-001 | Covers committed runtime profiles |
| **P0-003** | CSRF middleware has no fallback secret path | Unit | R-001 | Static/config assertion |
| **P0-004** | Refresh token records store only hashes | Integration | R-002 | DB verification |
| **P0-005** | Refresh flow still succeeds after token hashing | Integration | R-002 | Happy path |
| **P0-006** | Refresh token reuse invalidates token family after hashing | Integration | R-002 | Reuse detection |
| **P0-007** | Logout invalidates hashed refresh tokens | Integration | R-002 | Session cleanup |
| **P0-008** | Email verification records store only hashes | Integration | R-003 | DB verification |
| **P0-009** | Email verification happy path works after hashing | Integration | R-003 | Token consume |
| **P0-010** | Expired email verification token is rejected | Integration | R-003 | Negative path |
| **P0-011** | Used email verification token is rejected | Integration | R-003 | Replay defense |
| **P0-012** | Duplicate JSON keys rejected before handler execution | Integration | R-005 | Unskip existing test |
| **P0-013** | Prototype-pollution body rejected before handler execution | Integration | R-005 | Unskip existing test |
| **P0-014** | Constructor/prototype payload rejected across high-risk routes | Integration | R-005 | Expand beyond horse route |
| **P0-015** | `backend test:security` fails pipeline on security regressions | CI validation | R-004 | Blocking job behavior |
| **P0-016** | Deployment gate depends on blocking security gate | CI validation | R-004 | Workflow contract |
| **P0-017** | PR/security workflow fails on high npm audit severity threshold | CI validation | R-004 | No advisory escape hatch |
| **P0-018** | Readiness lane proves auth + CSRF + ownership with artifacts | E2E | R-006 | Controlled lane |
| **P0-019** | Readiness lane contains no bypass headers or contamination | E2E/static | R-006 | Existing parity guard remains green |
| **P0-020** | Login and protected route still work after hardening | E2E | R-001/R-002 | Minimal browser proof |
| **P0-021** | Password reset remains one-time-use and invalidates sessions | Integration | R-002 | Regression guard |
| **P0-022** | Verification resend remains rate-limited and non-enumerating | Integration | R-003 | Abuse resistance |
| **P0-023** | Audit artifact includes risk-to-gate evidence set | CI validation | R-007 | Traceability |
| **P0-024** | No deployable env file contains placeholder secrets | Static/CI | R-001 | Repo policy check |

**Total P0:** ~24 tests

---

### P1 (High)

**Criteria:** Important security behavior, common misuse paths, meaningful regression risk.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P1-001** | Auth/profile APIs remain within expected latency after hardening | k6/API | R-008 | Threshold smoke |
| **P1-002** | Refresh failures return generic errors without token leakage | Integration | R-002 | Response hygiene |
| **P1-003** | Verification failures return generic errors without sensitive leakage | Integration | R-003 | Response hygiene |
| **P1-004** | Secret validation messages are safe for operators, not secret-revealing | Startup/unit | R-001 | Error envelope |
| **P1-005** | ZAP high findings still fail dedicated security scan workflow | CI validation | R-004 | Existing dynamic scan contract |
| **P1-006** | Readiness artifacts retained for triage | CI/E2E | R-006 | Operational evidence |
| **P1-007** | Hostile payloads rejected on auth/profile/preferences endpoints | Integration | R-005 | Broader coverage |
| **P1-008** | Hostile query/form payloads rejected consistently | Integration | R-005 | Mixed content types |
| **P1-009** | Session rotation does not emit raw token values to logs | Unit/integration | R-002 | Logging hygiene |
| **P1-010** | Verification issuance does not emit raw token values to logs | Unit/integration | R-003 | Logging hygiene |
| **P1-011** | Security gate publishes artifacts and summary on failure | CI validation | R-004 | Fast triage |
| **P1-012** | Forced re-login migration is user-visible but safe | E2E | R-002 | Expected UX regression |
| **P1-013** | Beta/readiness configs differ only in allowed operational ways | Static/CI | R-001/R-006 | Config drift |
| **P1-014** | Auth routes remain resistant to bypass headers in readiness lane | E2E/API | R-004/R-006 | Defense-in-depth |
| **P1-015** | Existing ownership and auth-bypass suites remain green after hardening | Integration | R-004 | Regression guard |
| **P1-016** | Traceability report maps each blocker risk to a passing suite | CI/report | R-007 | Governance evidence |
| **P1-017** | Verification token rotation invalidates prior outstanding token | Integration | R-003 | Replay control |
| **P1-018** | Refresh family invalidation handles concurrent refresh correctly | Integration | R-002 | Race condition |

**Total P1:** ~18 tests

---

### P2 (Medium)

**Criteria:** Secondary abuse paths, regression prevention, operational confidence.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P2-001** | Readiness lane runs under burn-in with stable results | E2E | R-006 | Flake detection |
| **P2-002** | Security gate enforces branch protections/documented waivers | CI/process | R-004 | Governance |
| **P2-003** | Auth/profile k6 smoke includes Redis/rate limit happy path | k6/API | R-008 | Light operational pressure |
| **P2-004** | Secret scanning covers workflow and deploy config surfaces | Static/CI | R-001 | Broader repo policy |
| **P2-005** | Parser hardening preserves expected validation error shape | Integration | R-005 | Client contract |
| **P2-006** | Verification and reset token cleanup jobs handle hashed records | Integration | R-002/R-003 | Maintenance |
| **P2-007** | Readiness summary includes absolute artifact references | CI/report | R-007 | Auditability |
| **P2-008** | Negative startup cases covered for all deployable NODE_ENV values | Startup | R-001 | Completeness |
| **P2-009** | Auth cookie flags remain intact after token service changes | Integration | R-002 | Cookie regression |
| **P2-010** | Dependency audit policy documented in repo summary output | CI/report | R-004 | Clarity |

**Total P2:** ~10 tests

---

### P3 (Low)

**Criteria:** Exploratory, benchmark, or informational confidence builders.

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| **P3-001** | Exploratory review of auth failure UX copy after forced re-login | Manual/E2E | User communication |
| **P3-002** | Benchmark auth request delta before vs after hardening | k6 | Informational |
| **P3-003** | Manual inspection of security workflow summaries | Manual | Process clarity |
| **P3-004** | Exploratory negative cases for malformed cookies | API/manual | Edge cases |
| **P3-005** | Manual review of readiness artifact readability | Manual | Audit usability |
| **P3-006** | Optional ZAP tuning review for false positives | Manual/security | Noise reduction |

**Total P3:** ~6 tests

---

## Execution Strategy

### Every PR: Functional Security Tests (~10-15 min)

- `backend test:security`
- targeted backend integration suites for auth/token/parser hardening
- static config checks for placeholder secrets and workflow policy
- minimal Playwright auth/security smoke if auth/session code changed

### Nightly: Dynamic Security + Load (~30-60 min)

- ZAP security scan
- k6 auth/profile threshold smoke
- readiness lane against controlled environment

### Weekly: Burn-In + Deep Governance (~hours)

- burn-in on changed security specs
- extended readiness or staging rehearsal
- waiver and artifact audit

**Why:** Security proof should run in PRs unless it requires expensive infrastructure or long-running environment orchestration.

---

## QA Effort Estimate

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| P0 | ~24 | ~6-9 days | Core blocking coverage plus CI assertions |
| P1 | ~18 | ~4-6 days | Regression and evidence hardening |
| P2 | ~10 | ~2-4 days | Broader governance and operational checks |
| P3 | ~6 | ~1-2 days | Exploratory and benchmark tasks |
| **Total** | ~58 | **~2-3 weeks** | **1 QA engineer with backend/platform support** |

**Assumptions:**

- Existing security suites and workflows are reused where possible.
- Backend and platform owners implement blockers in parallel with QA.
- Artifact/report plumbing uses current GitHub Actions patterns.

---

## Implementation Planning Handoff

| Work Item | Owner | Target Milestone | Dependencies/Notes |
| --- | --- | --- | --- |
| Secret validation and CSRF fallback removal | Backend + Platform | Immediate | Required for P0-001 to P0-003 |
| Refresh token hash migration | Backend | Immediate | Required for P0-004 to P0-007 |
| Email verification hash migration | Backend | Immediate | Required for P0-008 to P0-011 |
| Parser-layer hostile payload defense | Backend | This sprint | Required for P0-012 to P0-014 |
| Blocking security gate in CI | Platform | Immediate | Required for P0-015 to P0-017 |
| Readiness lane evidence upgrade | QA + Platform | This sprint | Required for P0-018 to P0-019 |

---

## Appendix A: Code Examples & Tagging

```ts
// Suggested tags for Playwright/Jest alignment:
// @P0 @Security @Auth @Tokens
// @P0 @Security @Parser
// @P0 @Security @CI
// @P1 @Security @Readiness
```

```bash
# Suggested execution slices
npm --prefix backend run test:security
npx playwright test tests/e2e/readiness tests/e2e/auth.spec.ts --grep "@P0|@P1"
```

---

## Appendix B: Knowledge Base References

- `risk-governance.md`
- `probability-impact.md`
- `test-levels-framework.md`
- `test-priorities-matrix.md`
- `nfr-criteria.md`
- `ci-burn-in.md`

---

**Generated by:** BMad TEA Agent  
**Workflow:** `bmad-testarch-test-design`
