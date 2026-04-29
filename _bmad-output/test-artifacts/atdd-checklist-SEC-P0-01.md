---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy']
lastStep: 'step-03-test-strategy'
lastSaved: '2026-04-24'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design/equoria-security-p0-implementation-backlog.md'
  - 'backend/__tests__/unit/security/validate-environment.test.mjs'
  - 'backend/__tests__/integration/csrf-production-cookie.test.mjs'
  - 'backend/scripts/validate-environment.mjs'
  - 'backend/config/config.mjs'
  - 'backend/middleware/csrf.mjs'
---

# ATDD Checklist - Story SEC-P0-01: Enforce Runtime Secret Validation

**Date:** 2026-04-24  
**Author:** Murat  
**Primary Test Level:** Unit + Integration

---

## Story Summary

This story hardens runtime secret handling for deployable Equoria environments. The current state accepts committed placeholder JWT secrets in beta-oriented runtime profiles and allows CSRF to fall back to a hardcoded secret, which is unacceptable for a go-live path.

**As a** platform and backend team  
**I want** deployable modes to reject weak, placeholder, or missing auth secrets  
**So that** insecure configurations cannot boot and ship by accident

---

## Acceptance Criteria

1. `beta`, `beta-readiness`, and `production` startup paths reject missing `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. Deployable modes reject placeholder or test JWT secrets, including the current repo defaults in `env.beta` and `env.beta-readiness`.
3. CSRF secret generation/validation does not use a fallback literal when `JWT_SECRET` is absent.
4. CI-visible environment validation reports these conditions as failures, not warnings.
5. Existing valid test-mode behavior remains intact for explicit test environments.

---

## Failing Tests Created (RED Phase)

### API / Startup Tests (4 tests)

**Primary Files:**

- Existing: [backend/__tests__/unit/security/validate-environment.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validate-environment.test.mjs)
- New target: `backend/__tests__/unit/security/runtime-secret-policy.test.mjs`
- New target: `backend/__tests__/integration/security/deployable-env-validation.test.mjs`

- ✅ **Test:** `rejects placeholder JWT secrets in deployable modes`
  - **Status:** RED
  - **Expected failure reason:** current validation does not explicitly fail repo placeholder/test secrets for runtime profiles
  - **Verifies:** `beta`, `beta-readiness`, and `production` cannot pass with known fake secrets

- ✅ **Test:** `rejects missing JWT secrets in beta and beta-readiness boot path`
  - **Status:** RED
  - **Expected failure reason:** current boot checks only confirm presence, not deployable policy behavior end-to-end
  - **Verifies:** app/config bootstrap aborts when required secrets are missing

- ✅ **Test:** `validate-environment script exits non-zero for placeholder runtime secrets`
  - **Status:** RED
  - **Expected failure reason:** CLI validation script currently checks strength, but not the exact placeholder/test-secret policy required for deployable lanes
  - **Verifies:** CI-facing script blocks unsafe runtime config

- ✅ **Test:** `test mode still permits explicit test-only secrets`
  - **Status:** RED after policy change until scoped correctly
  - **Expected failure reason:** new policy may overreach and break legitimate `NODE_ENV=test`
  - **Verifies:** hardening is scoped to deployable modes, not test harnesses

### Integration / Middleware Tests (2 tests)

**Primary Files:**

- Existing: [backend/__tests__/integration/csrf-production-cookie.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/csrf-production-cookie.test.mjs)
- New target: `backend/__tests__/integration/security/csrf-secret-policy.test.mjs`

- ✅ **Test:** `csrf module initialization fails when JWT_SECRET is absent in deployable mode`
  - **Status:** RED
  - **Expected failure reason:** [`backend/middleware/csrf.mjs`](</C:/Users/heirr/OneDrive/Desktop/Equoria/backend/middleware/csrf.mjs:33>) currently falls back to `'fallback-secret-for-dev'`
  - **Verifies:** no hardcoded fallback secret survives

- ✅ **Test:** `csrf token issuance under production-like config requires real configured secret`
  - **Status:** RED
  - **Expected failure reason:** current behavior can still succeed with fallback path
  - **Verifies:** CSRF token generation is bound to real secret configuration only

---

## Data Factories Created

No new entity factories are needed for this story. This is configuration- and startup-policy testing, not domain-data testing.

---

## Fixtures Created

### Environment Mutation Fixture

**Target File:** `backend/__tests__/helpers/runtimeEnv.fixture.mjs`

**Fixtures:**

- `withEnvSnapshot` - captures and restores `process.env` per test
  - **Setup:** clone current `process.env`, apply controlled overrides
  - **Provides:** deterministic environment mutation for config/bootstrap tests
  - **Cleanup:** restore original `process.env` and reset modules

**Example Usage:**

```js
await withEnvSnapshot(
  {
    NODE_ENV: 'beta',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-only-32chars',
  },
  async () => {
    const { validateEnvironment } = await import('../../../utils/validateEnvironment.mjs');
    validateEnvironment();
  },
);
```

---

## Mock Requirements

No external service mocks are required. Keep this story close to real config/bootstrap behavior.

Only acceptable test doubles:

- logger spies
- `process.exit` spy
- module reset/import isolation

Do not mock:

- `validateEnvironment`
- config module behavior
- CSRF module secret resolution

---

## Required data-testid Attributes

None. Backend-only story.

---

## Implementation Checklist

### Test: Reject placeholder JWT secrets in deployable modes

**Files:**

- [backend/utils/validateEnvironment.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/utils/validateEnvironment.mjs)
- [backend/__tests__/unit/security/validate-environment.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validate-environment.test.mjs)
- `backend/__tests__/unit/security/runtime-secret-policy.test.mjs`

**Tasks to make this test pass:**

- [ ] add explicit placeholder/test-secret detection for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] scope deployable policy to `production`, `beta`, and `beta-readiness`
- [ ] preserve explicit `test` behavior
- [ ] run targeted unit tests
- [ ] ✅ test passes (green phase)

**Estimated Effort:** ~2-4 hours

---

### Test: Reject missing JWT secrets in beta and beta-readiness boot path

**Files:**

- [backend/config/config.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/config/config.mjs)
- `backend/__tests__/integration/security/deployable-env-validation.test.mjs`

**Tasks to make this test pass:**

- [ ] ensure config bootstrap fails hard on missing auth secrets in deployable modes
- [ ] cover both `beta` and `beta-readiness`
- [ ] ensure error messaging is operator-usable without leaking secret values
- [ ] run targeted integration tests
- [ ] ✅ test passes (green phase)

**Estimated Effort:** ~2-3 hours

---

### Test: validate-environment script exits non-zero for placeholder runtime secrets

**Files:**

- [backend/scripts/validate-environment.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/scripts/validate-environment.mjs)
- `backend/__tests__/integration/security/deployable-env-validation.test.mjs`

**Tasks to make this test pass:**

- [ ] align script-level validation with library-level placeholder policy
- [ ] ensure CLI exits non-zero for unsafe deployable config
- [ ] keep output CI-friendly and deterministic
- [ ] run script-focused tests
- [ ] ✅ test passes (green phase)

**Estimated Effort:** ~1-2 hours

---

### Test: CSRF module initialization fails without real secret

**Files:**

- [backend/middleware/csrf.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/middleware/csrf.mjs)
- [backend/__tests__/integration/csrf-production-cookie.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/integration/csrf-production-cookie.test.mjs)
- `backend/__tests__/integration/security/csrf-secret-policy.test.mjs`

**Tasks to make this test pass:**

- [ ] remove `'fallback-secret-for-dev'` path
- [ ] fail early when CSRF secret source is not configured in deployable modes
- [ ] confirm production cookie contract still works with real secret
- [ ] run CSRF integration tests
- [ ] ✅ test passes (green phase)

**Estimated Effort:** ~1-3 hours

---

### Test: test mode still permits explicit test-only secrets

**Files:**

- [backend/utils/validateEnvironment.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/utils/validateEnvironment.mjs)
- [backend/__tests__/unit/security/validate-environment.test.mjs](/C:/Users/heirr/OneDrive/Desktop/Equoria/backend/__tests__/unit/security/validate-environment.test.mjs)

**Tasks to make this test pass:**

- [ ] explicitly codify allowed `NODE_ENV=test` behavior
- [ ] verify new runtime policy does not break existing security suites
- [ ] run current test-mode validation suite
- [ ] ✅ test passes (green phase)

**Estimated Effort:** ~1 hour

---

## Running Tests

```bash
# Targeted unit and integration security checks for this story
npm --prefix backend run test:security -- --runTestsByPath backend/__tests__/unit/security/validate-environment.test.mjs backend/__tests__/integration/csrf-production-cookie.test.mjs

# Script validation
node backend/scripts/validate-environment.mjs
```

---

## Red-Green-Refactor Workflow

### RED Phase (This Checklist)

- Add the 6 tests above first.
- Confirm they fail for the right reason:
  - placeholder secrets accepted today
  - missing deployable secrets not fully blocked end-to-end
  - CSRF fallback secret still present

### GREEN Phase

- Update validation policy in `validateEnvironment.mjs`
- align `scripts/validate-environment.mjs`
- harden `config.mjs`
- remove CSRF fallback in `csrf.mjs`
- make tests green without weakening test-mode support

### REFACTOR Phase

- centralize placeholder-secret patterns in one helper
- remove duplicated env-policy logic across script and runtime validator
- tighten test helper/fixture reuse for env mutation and module reloading

---

## Notes

- This is a pure backend/config story. Keep UI and E2E out of the first slice unless needed for a final smoke check.
- The main failure mode to avoid is over-hardening `NODE_ENV=test`; keep deployable and test policies separate.
- Do not weaken this story with warnings. Unsafe runtime secret config must fail.
