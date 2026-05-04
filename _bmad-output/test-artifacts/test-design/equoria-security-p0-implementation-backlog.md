# Equoria Security P0 Implementation Backlog

**Date:** 2026-04-24  
**Author:** Murat (TEA)  
**Purpose:** Convert P0 security hardening risks into implementable stories with exact file targets, acceptance criteria, and test ownership.

**Source Artifacts**

- [Architecture Test Design](/C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/test-artifacts/test-design/equoria-security-hardening-test-design-architecture.md)
- [QA Test Design](/C:/Users/heirr/OneDrive/Desktop/Equoria/_bmad-output/test-artifacts/test-design/equoria-security-hardening-test-design-qa.md)

---

## Execution Order

1. `SEC-P0-01` Runtime secret enforcement
2. `SEC-P0-02` Refresh token hash migration
3. `SEC-P0-03` Email verification token hash migration
4. `SEC-P0-04` Parser-layer hostile payload rejection
5. `SEC-P0-05` Blocking security gate in CI
6. `SEC-P0-06` Readiness evidence lane

The dependency logic is simple: fix process and config first, then close active compromise paths, then restore blocked coverage, then lock the gate.

---

## SEC-P0-01: Enforce Runtime Secret Validation

**Risk IDs:** `R-001`, part of `R-004`  
**Owner:** Backend + Platform  
**Primary Test Level:** Unit + startup/integration

### Acceptance Criteria

1. Deployable modes reject missing `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. Deployable modes reject placeholder/test secrets in runtime profiles.
3. `backend/middleware/csrf.mjs` no longer uses a fallback secret.
4. Repo runtime env files used for beta/readiness do not contain deployable placeholder secrets.
5. CI fails if deployable config reintroduces placeholder secrets.

### Implementation Files

- [backend/config/config.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/config/config.mjs)
- [backend/middleware/csrf.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/middleware/csrf.mjs)
- [backend/scripts/validate-environment.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/scripts/validate-environment.mjs)
- [backend/utils/validateEnvironment.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/utils/validateEnvironment.mjs)
- [backend/env.beta](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/env.beta)
- [backend/env.beta-readiness](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/env.beta-readiness)

### Test Files

- Existing: [backend/__tests__/unit/security/validate-environment.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validate-environment.test.mjs)
- Existing: [backend/__tests__/integration/csrf-production-cookie.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/csrf-production-cookie.test.mjs)
- New: `backend/__tests__/unit/security/runtime-secret-policy.test.mjs`
- New: `backend/__tests__/integration/security/deployable-env-validation.test.mjs`

### Red-Phase Test Intent

- missing secret in `beta` or `beta-readiness` fails app boot
- placeholder secret in deployable mode fails boot
- CSRF middleware initialization fails without configured secret
- env validation reports placeholder runtime secrets as errors, not warnings

### Run Commands

```bash
npm --prefix backend run test:security -- --runTestsByPath backend/__tests__/unit/security/validate-environment.test.mjs
node backend/scripts/validate-environment.mjs
```

### Definition of Done

- No fallback secret path remains
- Runtime env validation is deterministic and blocking
- New tests fail before code change and pass after

---

## SEC-P0-02: Hash Refresh Tokens At Rest

**Risk IDs:** `R-002`  
**Owner:** Backend  
**Primary Test Level:** Unit + integration

### Acceptance Criteria

1. Refresh tokens are persisted as hashes, not plaintext.
2. Token validation and rotation use hashed lookup without losing reuse-detection behavior.
3. Token family invalidation still works under hashing.
4. Existing refresh sessions are invalidated safely during migration.
5. No log entry emits raw refresh or access token values.

### Implementation Files

- [backend/utils/tokenRotationService.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/utils/tokenRotationService.mjs)
- [packages/database/prisma/schema.prisma](/C:/Users/heirr/OneDrive/Desktop/Equoria/packages/database/prisma/schema.prisma)
- related migration under `packages/database/prisma/migrations/`
- [backend/modules/auth/controllers/authController.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/modules/auth/controllers/authController.mjs)

### Test Files

- Existing: [backend/__tests__/unit/token-rotation.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/token-rotation.test.mjs)
- Existing: [backend/__tests__/integration/session-lifecycle.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/session-lifecycle.test.mjs)
- Existing: [backend/__tests__/integration/token-rotation.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/token-rotation.test.mjs)
- New: `backend/__tests__/integration/security/refresh-token-storage.test.mjs`

### Red-Phase Test Intent

- DB no longer contains a JWT-looking token after login/refresh
- refresh flow still succeeds via cookie/body token
- reused token still invalidates family
- logout and password reset invalidate hashed token families
- log inspection confirms no raw token values emitted

### Run Commands

```bash
npm --prefix backend run test:security -- --runTestsByPath backend/__tests__/unit/token-rotation.test.mjs backend/__tests__/integration/token-rotation.test.mjs backend/__tests__/integration/session-lifecycle.test.mjs
```

### Definition of Done

- Schema and service no longer rely on plaintext refresh token persistence
- session lifecycle and token rotation suites remain green
- migration plan explicitly forces re-login or invalidates existing token families

---

## SEC-P0-03: Hash Email Verification Tokens At Rest

**Risk IDs:** `R-003`  
**Owner:** Backend  
**Primary Test Level:** Unit + integration

### Acceptance Criteria

1. Email verification tokens are stored as hashes, not raw values.
2. Verify/resend flows still work correctly with hashed lookup.
3. Expired and already-used token behavior is unchanged from the client’s perspective.
4. Outstanding plaintext verification tokens are rotated or invalidated.
5. No log line or DB assertion exposes raw verification tokens.

### Implementation Files

- [backend/utils/emailVerificationService.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/utils/emailVerificationService.mjs)
- [backend/modules/auth/controllers/authController.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/modules/auth/controllers/authController.mjs)
- [packages/database/prisma/schema.prisma](/C:/Users/heirr/OneDrive/Desktop/Equoria/packages/database/prisma/schema.prisma)
- related migration under `packages/database/prisma/migrations/`

### Test Files

- Existing: [backend/__tests__/unit/email-verification.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/email-verification.test.mjs)
- Existing: [backend/__tests__/integration/email-verification.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/email-verification.test.mjs)
- New: `backend/__tests__/integration/security/email-verification-storage.test.mjs`

### Red-Phase Test Intent

- created verification token is not recoverable from DB as plaintext
- verification succeeds with supplied raw token but DB stores only hash
- resend invalidates or supersedes prior token
- expired/used paths remain correct
- no raw token leakage in logs

### Run Commands

```bash
npm --prefix backend run test:security -- --runTestsByPath backend/__tests__/unit/email-verification.test.mjs backend/__tests__/integration/email-verification.test.mjs
```

### Definition of Done

- Verification table stores hash only
- all unit and integration verification suites remain green
- migration behavior for outstanding verification tokens is explicit and tested

---

## SEC-P0-04: Reject Hostile Payloads At Parser Layer

**Risk IDs:** `R-005`  
**Owner:** Backend  
**Primary Test Level:** Integration

### Acceptance Criteria

1. Duplicate JSON keys are rejected before request handlers execute.
2. `__proto__`, `constructor`, and prototype-pollution payloads are rejected at request-body layer.
3. Existing skipped parameter-pollution tests are re-enabled.
4. High-risk authenticated routes enforce the same body-layer protection consistently.
5. Response shape remains safe and deterministic.

### Implementation Files

- [backend/app.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/app.mjs)
- [backend/middleware/validationErrorHandler.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/middleware/validationErrorHandler.mjs)
- possible new middleware: `backend/middleware/requestBodyGuard.mjs`

### Test Files

- Existing: [backend/__tests__/integration/security/parameter-pollution.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/security/parameter-pollution.test.mjs)
- Existing: [backend/__tests__/unit/security/validation-error-handler.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validation-error-handler.test.mjs)
- New: `backend/__tests__/integration/security/request-body-guard.test.mjs`

### Red-Phase Test Intent

- unskip line-154 duplicate-key test
- unskip line-192 prototype-pollution test
- add route-spread coverage for auth/profile/preferences and at least one non-horse state-changing endpoint

### Run Commands

```bash
npm --prefix backend run test:security -- --runTestsByPath backend/__tests__/integration/security/parameter-pollution.test.mjs backend/__tests__/unit/security/validation-error-handler.test.mjs
```

### Definition of Done

- both previously skipped tests are live and green
- parser-layer defense is global, not route-specific theater
- no regression in normal JSON/form handling

---

## SEC-P0-05: Make Security Gate Blocking In CI

**Risk IDs:** `R-004`  
**Owner:** Platform  
**Primary Test Level:** CI validation

### Acceptance Criteria

1. Deployment gate depends on a blocking `security-gate` job.
2. `npm audit` high-severity findings are no longer purely advisory for deployable branches.
3. Security gate runs backend security suite plus config/secret validation.
4. Failure artifacts and summaries are retained for triage.
5. Waiver mechanism, if any, is explicit, time-boxed, and manual.

### Implementation Files

- [/.github/workflows/test.yml](/C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/test.yml)
- [/.github/workflows/ci-cd.yml](/C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/ci-cd.yml)
- [/.github/workflows/security-scan.yml](/C:/Users/heirr/OneDrive/Desktop/Equoria/.github/workflows/security-scan.yml)

### Test Files

- New static policy check: `backend/__tests__/integration/security/pipeline-policy.test.mjs` or repo script-based validation
- Existing supporting evidence: [tests/e2e/readiness/production-parity.guard.spec.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/production-parity.guard.spec.ts)
- Optional repo script: `backend/scripts/test-pipeline-validation.mjs`

### Red-Phase Test Intent

- detect `continue-on-error: true` on security-critical jobs for deployable branches
- detect deployment gate that omits security-gate dependency
- verify workflow summary no longer labels security as advisory for release

### Run Commands

```bash
node backend/scripts/test-pipeline-validation.mjs
npm --prefix backend run test:security
```

### Definition of Done

- a failed security suite or high-severity audit can block deploy
- workflow policy is enforced by test or validation script, not reviewer memory

---

## SEC-P0-06: Build Reproducible Readiness Evidence

**Risk IDs:** `R-006`, part of `R-007`  
**Owner:** QA + Platform  
**Primary Test Level:** E2E + workflow validation

### Acceptance Criteria

1. Readiness signoff no longer depends on a local-only shell script as sole evidence.
2. Controlled lane proves auth, CSRF, and protected mutations with artifact retention.
3. Readiness lane remains free of bypass headers and contamination.
4. Evidence can be linked to a commit and branch.
5. Security hardening stories above are represented in readiness evidence.

### Implementation Files

- [tests/e2e/readiness/auth-onboarding.spec.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/auth-onboarding.spec.ts)
- [tests/e2e/readiness/production-parity.guard.spec.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/production-parity.guard.spec.ts)
- [tests/e2e/readiness/support/prodParity.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/support/prodParity.ts)
- [playwright.beta-readiness.config.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/playwright.beta-readiness.config.ts)
- CI workflow that runs readiness lane in controlled environment

### Test Files

- Existing: [tests/e2e/readiness/auth-onboarding.spec.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/auth-onboarding.spec.ts)
- Existing: [tests/e2e/readiness/production-parity.guard.spec.ts](/C:/Users/heirr/OneDrive/Desktop/Equoria/tests/e2e/readiness/production-parity.guard.spec.ts)
- New: `tests/e2e/readiness/security-hardening.spec.ts`

### Red-Phase Test Intent

- readiness lane proves login, CSRF token acquisition, protected mutation, and expected denial paths
- artifact summary exists and is commit-linked
- no bypass headers or hardcoded shortcuts appear in readiness files

### Run Commands

```bash
npm run test:e2e:beta-readiness
npx playwright test tests/e2e/readiness --config=playwright.beta-readiness.config.ts
```

### Definition of Done

- readiness evidence is reproducible and retained
- launch signoff no longer relies on “trust me, I ran it locally”

---

## Cross-Story Test File Map

### Backend Security Suite

- [backend/__tests__/unit/security/validate-environment.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validate-environment.test.mjs)
- [backend/__tests__/unit/security/validation-error-handler.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validation-error-handler.test.mjs)
- [backend/__tests__/unit/token-rotation.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/token-rotation.test.mjs)
- [backend/__tests__/unit/email-verification.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/email-verification.test.mjs)
- [backend/__tests__/integration/token-rotation.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/token-rotation.test.mjs)
- [backend/__tests__/integration/session-lifecycle.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/session-lifecycle.test.mjs)
- [backend/__tests__/integration/email-verification.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/email-verification.test.mjs)
- [backend/__tests__/integration/security/parameter-pollution.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/security/parameter-pollution.test.mjs)

### New Tests To Add

- `backend/__tests__/unit/security/runtime-secret-policy.test.mjs`
- `backend/__tests__/integration/security/deployable-env-validation.test.mjs`
- `backend/__tests__/integration/security/refresh-token-storage.test.mjs`
- `backend/__tests__/integration/security/email-verification-storage.test.mjs`
- `backend/__tests__/integration/security/request-body-guard.test.mjs`
- `tests/e2e/readiness/security-hardening.spec.ts`

---

## Short Call

If you want the fastest safe path, implement `SEC-P0-01` and `SEC-P0-05` first. They stop you from shipping obviously bad state. Then do `SEC-P0-02` and `SEC-P0-03`, because those remove the active compromise paths. `SEC-P0-04` and `SEC-P0-06` finish the hardening loop by restoring missing defenses and making the evidence reproducible.
