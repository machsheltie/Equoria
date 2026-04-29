---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-24'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/project-context.md'
  - 'backend/config/config.mjs'
  - 'backend/middleware/csrf.mjs'
  - 'backend/utils/tokenRotationService.mjs'
  - 'backend/utils/emailVerificationService.mjs'
  - 'backend/__tests__/integration/security/parameter-pollution.test.mjs'
  - '.github/workflows/test.yml'
  - '.github/workflows/ci-cd.yml'
  - '.github/workflows/security-scan.yml'
---

# Test Design for Architecture: Equoria Security Hardening

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-04-24  
**Author:** Murat (TEA)  
**Status:** Architecture Review Pending  
**Project:** Equoria  
**PRD Reference:** N/A - brownfield security hardening scope  
**ADR Reference:** Existing backend auth/session architecture

---

## Executive Summary

**Scope:** Security hardening for auth/session management, token storage, parser-layer input defense, and CI quality gates across the live Equoria game platform.

**Business Context:**

- **Revenue/Impact:** Account takeover, privilege abuse, or broken release governance would materially damage launch readiness and player trust.
- **Problem:** The current codebase contains confirmed high-severity security flaws plus a non-blocking pipeline posture that allows them to ship.
- **GA Launch:** Immediate pre-launch concern.

**Architecture:**

- **Key Decision 1:** JWT access/refresh token auth with cookie-based session handling.
- **Key Decision 2:** CSRF double-submit protection via `csrf-csrf`.
- **Key Decision 3:** Monorepo with Express backend, React frontend, Jest/Vitest/Playwright, GitHub Actions.

**Expected Scale:**

- Multi-user public game platform
- Shared beta/readiness lanes
- Auth, profile, training, competition, and inventory operations behind the same release process

**Risk Summary:**

- **Total risks:** 8
- **High-priority (>=6):** 6 risks requiring immediate mitigation
- **Test effort:** ~55-85 tests (~2-3 weeks for 1 QA with dev support)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide

1. **R-001: Runtime secrets policy** - Remove committed runtime JWT secrets and fail startup on missing secrets (owner: Backend/Platform).
2. **R-002: Token-at-rest policy** - Replace plaintext refresh and email verification tokens with hashed storage plus forced session invalidation migration (owner: Backend).
3. **R-003: Parser-layer security** - Add duplicate-key and prototype-pollution rejection before handlers run (owner: Backend).
4. **R-004: Security gate policy** - Make security jobs blocking in CI and define formal waiver rules with expiry (owner: Platform/Engineering leadership).

**What we need from team:** Complete these 4 items before calling the platform launch-ready.

---

### ⚠️ HIGH PRIORITY - Team Should Validate

1. **R-005: Readiness signoff gap** - Move from local/manual beta-readiness evidence to CI-runnable signoff or a controlled staging gate (Backend + Platform).
2. **R-006: Security observability gap** - Add deterministic evidence for secret/config validation, token misuse detection, and blocked malicious payloads (Backend).

**What we need from team:** Approve the implementation direction and assign owners this sprint.

---

### 📋 INFO ONLY - Solutions Provided

1. **Test strategy:** API/integration-heavy security suite with minimal E2E confirmation for critical user journeys.
2. **Tooling:** Jest security suite, Playwright critical auth E2E, npm audit, ZAP, and k6 for core API pressure checks.
3. **Tiered CI/CD:** PR blocking security gate, nightly dynamic security scan, weekly burn-in and deep scan.
4. **Coverage:** ~55-85 scenarios prioritized P0-P3 with explicit risk linkage.
5. **Quality gates:** Zero open score-9 security risks, zero skipped P0 security tests, blocking security pipeline.

---

## For Architects and Devs - Open Topics

### Risk Assessment

**Total risks identified:** 8 (6 high-priority, 1 medium, 1 low)

#### High-Priority Risks (Score >=6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-001** | **SEC** | Predictable JWT secrets committed in runtime beta profiles; CSRF has fallback secret path | 3 | 3 | **9** | Remove committed runtime secrets, disable fallback secret, enforce startup validation | Backend + Platform | Before next deploy |
| **R-002** | **SEC** | Plaintext refresh tokens in DB enable session takeover on DB read exposure | 3 | 3 | **9** | Store only token hash, validate by hash, force re-login migration | Backend | Before next deploy |
| **R-003** | **SEC** | Plaintext email verification tokens in DB enable account state manipulation on DB read exposure | 3 | 3 | **9** | Store only token hash, rotate outstanding tokens | Backend | Before next deploy |
| **R-004** | **SEC/OPS** | Security jobs are advisory, so known high-risk failures can still ship | 3 | 3 | **9** | Add blocking `security-gate` job to deployment prerequisites | Platform | Before next deploy |
| **R-005** | **SEC** | Parser layer still allows documented duplicate-key and prototype-pollution gaps | 2 | 3 | **6** | Add parser-layer guards and unskip security tests | Backend | This sprint |
| **R-006** | **OPS** | Beta-readiness signoff depends on local/manual execution, not reproducible CI evidence | 2 | 3 | **6** | Move readiness to controlled CI/staging path with artifacted evidence | Platform + QA | This sprint |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | DATA | Existing auth/security tests do not provide full traceability from risk to release gate | 2 | 2 | 4 | Add traceability matrix and required evidence outputs | QA + Platform |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-008 | PERF | Security checks may add small latency to auth/profile flows | 1 | 2 | 2 | Monitor |

#### Risk Category Legend

- **TECH**: Technical/Architecture
- **SEC**: Security
- **PERF**: Performance
- **DATA**: Data Integrity
- **BUS**: Business Impact
- **OPS**: Operations

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
| --- | --- | --- | --- | --- |
| **Committed runtime secrets** | Security tests can pass against insecure defaults; shared environments become unsafe | Startup must reject placeholder or missing secrets in every non-test mode | Backend + Platform | Before next deploy |
| **Plaintext token persistence** | DB leak becomes immediate auth compromise | Hash-at-rest design for refresh and verification tokens with migration path | Backend | Before next deploy |
| **Manual readiness signoff** | No reproducible launch evidence; release decisions stay political | CI/staging lane with preserved artifacts and pass/fail semantics | Platform | This sprint |
| **Skipped parser security tests** | Known exploit classes remain outside enforced coverage | Parser middleware or hardened body parsing that rejects malicious payloads globally | Backend | This sprint |

#### 2. Architectural Improvements Needed

1. **Central secret validation on boot**
   - **Current problem:** Config loads runtime env files that contain test JWT secrets; CSRF can fall back to a hardcoded secret.
   - **Required change:** Single validator must reject placeholders and abort boot in all deployable modes.
   - **Impact if not fixed:** Auth and CSRF guarantees remain conditional instead of enforced.
   - **Owner:** Backend + Platform
   - **Timeline:** Before next deploy

2. **Hashed token persistence**
   - **Current problem:** Refresh and verification tokens are stored as usable plaintext values.
   - **Required change:** Persist hashes only; use `jti` or family metadata for traceability.
   - **Impact if not fixed:** Any DB read incident escalates to active compromise.
   - **Owner:** Backend
   - **Timeline:** Before next deploy

3. **Global hostile-payload filtering**
   - **Current problem:** Route-level validation exists, but parser-layer defenses are incomplete.
   - **Required change:** Reject duplicate JSON keys and prototype-pollution payloads before request handlers.
   - **Impact if not fixed:** Input hardening remains partial and inconsistent.
   - **Owner:** Backend
   - **Timeline:** This sprint

4. **Blocking security governance**
   - **Current problem:** `npm audit` and other security evidence are advisory in CI.
   - **Required change:** One blocking security gate with explicit waiver workflow and expiry.
   - **Impact if not fixed:** Critical risks remain shippable by process design.
   - **Owner:** Platform
   - **Timeline:** Before next deploy

---

### Testability Assessment Summary

#### What Works Well

- ✅ Existing security test assets already cover rate limiting, token rotation, auth bypass attempts, and readiness contamination checks.
- ✅ ZAP scan workflow already produces artifacted evidence and can fail on high findings.
- ✅ Auth/session logic is centralized enough that a focused hardening sprint can materially reduce risk without redesigning the game.

#### Accepted Trade-offs

- **Keep browser E2E thin** - Security proof should sit mostly at API/integration level; E2E is only for critical end-user confirmation.
- **Temporary forced re-login** - Acceptable for the token-hashing migration because security value outweighs short-term session churn.

---

### Risk Mitigation Plans

#### R-001: Predictable Runtime Secrets (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Remove placeholder secrets from deployable env files.
2. Delete CSRF fallback secret path.
3. Add boot-time validation for secret strength and placeholder detection.
4. Add CI validation that fails on placeholder secrets in deployable modes.

**Owner:** Backend + Platform  
**Timeline:** Before next deploy  
**Status:** Planned  
**Verification:** Deployable modes refuse startup with placeholder or missing secrets; tests prove rejection.

#### R-002: Plaintext Refresh Tokens (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Add `tokenHash` persistence and lookup path.
2. Update rotation/reuse detection to operate on hashes plus metadata.
3. Invalidate existing token families during migration.
4. Add integration coverage for login, refresh, reuse detection, and logout after migration.

**Owner:** Backend  
**Timeline:** Before next deploy  
**Status:** Planned  
**Verification:** Database contains no usable refresh tokens; all token lifecycle tests green.

#### R-003: Plaintext Email Verification Tokens (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Replace raw token persistence with hashed storage.
2. Update creation, resend, and consume logic accordingly.
3. Expire or rotate all outstanding verification tokens.
4. Add regression tests for happy path, expired token, used token, and enumeration behavior.

**Owner:** Backend  
**Timeline:** Before next deploy  
**Status:** Planned  
**Verification:** Verification table stores only hashes; all verification flows pass.

#### R-004: Advisory Security Gates (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Create blocking `security-gate` workflow job.
2. Require `backend test:security`, env validation, dependency audit threshold, and secret/config checks.
3. Make deployment gate depend on `security-gate`.
4. Add waiver process with approver, reason, and expiry.

**Owner:** Platform  
**Timeline:** Before next deploy  
**Status:** Planned  
**Verification:** Deployment cannot proceed when security gate fails.

#### R-005: Parser-Layer Input Gaps (Score: 6) - HIGH

**Mitigation Strategy:**

1. Add duplicate-key and prototype-pollution rejection middleware.
2. Unskip the two known security tests.
3. Add coverage for high-risk endpoints beyond horses.

**Owner:** Backend  
**Timeline:** This sprint  
**Status:** Planned  
**Verification:** Previously skipped tests run and pass in CI.

#### R-006: Manual Readiness Signoff (Score: 6) - HIGH

**Mitigation Strategy:**

1. Define minimum reproducible readiness lane.
2. Move readiness execution into CI or a controlled staging gate.
3. Preserve artifacted evidence for auth, CSRF, ownership, and security checks.

**Owner:** Platform + QA  
**Timeline:** This sprint  
**Status:** Planned  
**Verification:** Release evidence no longer depends on a developer workstation.

---

### Assumptions and Dependencies

#### Assumptions

1. Shared beta or readiness environments are treated as meaningful security surfaces, not disposable sandboxes.
2. Forced re-login is operationally acceptable if it closes token-at-rest exposure.
3. The team wants security findings to be release-blocking, not informational.

#### Dependencies

1. GitHub Actions remains the primary release gate mechanism.
2. Backend team can alter Prisma schema and token services in the same sprint.
3. Platform team can update deployment gate dependencies immediately after job creation.

#### Risks to Plan

- **Risk:** Token migration introduces auth regressions.
  - **Impact:** Session churn or broken refresh flows.
  - **Contingency:** Run a staged rollout with explicit login/refresh regression suite before deploy.

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Approve the four blocker decisions.
2. Assign owners and dates for R-001 through R-006.
3. Confirm forced re-login migration is acceptable.
4. Hand off to QA execution plan and implementation sprint planning.
