# Deep-Dive Architect Debugging Plan (2025-12-17)

## Overall Test Status
- **Backend (Jest)**: All critical failures resolved.
- **Frontend (Vitest)**: All suites passing.

---

## 🟥 CRITICAL PRIORITY: Core Systemic Failures

### 1. Backend: Database Connection Stability
- **Status**: ✅ FIXED
- **Action Taken**: 
    - Identified `groomHiringWorkflow.test.mjs` as using global `deleteMany({})` which caused deadlocks.
    - Refactored `groomHiringWorkflow.test.mjs` to use scoped cleanup (deleting only test-specific user IDs).
    - Verified `horseAgingSystem.test.mjs` already used scoped cleanup.

### 2. Backend: Documentation & Environment Validation
- **Status**: ✅ FIXED
- **Action**: Restored `jest` global injection in `jest.config.js` to fix 161 suite failures.

---

## 🟧 HIGH PRIORITY: Component & Logic Failures

### 3. Frontend: Progression & Dashboard Collapse
- **Status**: ✅ FIXED
- **Action Taken**: 
    - `MyGroomsDashboard`: Added missing MSW handlers for `GET /api/grooms/user/:id`, `assignments`, and `salaries` to `frontend/src/test/msw/handlers.ts`. Tests now pass (23/23).
    - `HorseDetailPage`: Tests found to be passing (19/19) upon re-verification. Likely fixed by environmental stabilization or side-effect of previous fixes.

### 4. Backend: Validation & Integrity Errors
- **Status**: ✅ FIXED
- **Action Taken**: 
    - Resolved race condition in `auth-bypass-attempts.test.mjs` where `afterAll` cleanup was deleting all users, breaking parallel tests like `groomMarketplaceAPI`. Refactored to scope cleanup to created IDs only.

---

## 🟨 MODERATE PRIORITY: UI & Polish Failures

### 5. Frontend: Chart & Animation Context
- **Status**: ✅ FIXED
- **Action Taken**: 
    - Installed `jest-canvas-mock` in frontend.
    - Created `frontend/src/test/shim.ts` to map `vi` to `global.jest` (required by jest-canvas-mock).
    - Updated `frontend/vitest.config.ts` to include the shim.
    - Verified `StatHistoryGraph.test.tsx` passes (35/35 tests).

### 6. Frontend: CSS State Assertions
- **Status**: ✅ FIXED
- **Action Taken**: 
    - Verified `StatHistoryGraph.test.tsx` passes after fixing the environment issues. The assertion `toHaveClass('active')` works correctly with `@testing-library/jest-dom`.

---

## 🟩 LOW PRIORITY: Maintenance

### 7. Log Hygiene
- **Status**: ✅ FIXED
- **Action Taken**: 
    - Added `console.log`, `console.info`, and `console.debug` suppression to `backend/tests/setup.mjs`.
    - Added similar suppression to `frontend/src/test/setup.ts`.
    - Deleted unused `frontend/jest.setup.js`.

---

## Execution Progress

- [x] Initial full-codebase audit.

- [x] Fix Backend Database Pool/Concurrency.

- [x] Restore Documentation/OpenAPI paths.

- [x] Fix Frontend Auth/Context Provider crashes (Prop Data mismatches).

- [x] Fix Frontend Chart context and class assertions.

- [x] Fix Backend Validation & Integrity Errors.

- [x] Fix Frontend Dashboard & Progression Failures.

- [x] Implement Log Hygiene (Suppress console logs).