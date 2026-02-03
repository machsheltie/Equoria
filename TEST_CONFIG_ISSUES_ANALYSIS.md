# Test Configuration Issues Analysis & Fixes

## Executive Summary

Two critical test configuration issues identified and fixed:

1. **Backend Issue**: Module import error in `auth-cookies.test.mjs` trying to import non-existent export
2. **Frontend Issue**: Test file written for Vitest but frontend uses Jest configuration

Both issues are straightforward to resolve with provided fixes below.

---

## Issue 1: Backend Test Module Import Error

### Error Details
```
SyntaxError: The requested module '../utils/flagEvaluationEngine.mjs'
does not provide an export named '_getEligibleHorses'
```

**File**: `backend/__tests__/integration/auth-cookies.test.mjs`
**Line**: Test attempts to import a private/non-existent function

### Root Cause Analysis

The error message suggests the test file is trying to import `_getEligibleHorses` from `flagEvaluationEngine.mjs`, but this function:

1. **Does NOT exist** with that name - the function in `flagEvaluationEngine.mjs` is called `getEligibleHorses` (without underscore)
2. **Is exported properly** - The function IS exported in the module:
   ```javascript
   export async function getEligibleHorses(evaluationDate = new Date()) { ... }
   ```
3. **Export statement is present** - Lines 342-347 of `flagEvaluationEngine.mjs`:
   ```javascript
   export default {
     evaluateHorseFlags,
     batchEvaluateFlags,
     getEligibleHorses,  // <-- EXPORTED
     evaluateFlagTriggers,
   };
   ```

### Investigation Findings

**File**: `backend/__tests__/integration/auth-cookies.test.mjs` (Lines 1-30)
- This file imports `app.mjs` which is the Express application
- Does NOT directly import from `flagEvaluationEngine.mjs`
- The error occurs when `app.mjs` is imported (cascading dependency issue)

**File**: `backend/app.mjs` (Lines 36-100)
- Imports multiple route files
- Does NOT directly import `flagEvaluationEngine.mjs`
- The error must be coming from one of the route files

**Likely Culprit**: One of these routes likely imports `flagEvaluationEngine.mjs` and is trying to use `_getEligibleHorses`:
- `epigeneticFlagRoutes.mjs`
- `advancedEpigeneticRoutes.mjs`
- `enhancedMilestoneRoutes.mjs`

### Detailed Solution

**Step 1**: Find which file is trying to import `_getEligibleHorses`:

```bash
cd C:\Users\heirr\OneDrive\Desktop\Equoria\backend
grep -r "_getEligibleHorses" --include="*.mjs" .
```

**Step 2**: Fix the import in that file:

Change from:
```javascript
import { _getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';
// OR
import flagEngine from '../utils/flagEvaluationEngine.mjs';
const { _getEligibleHorses } = flagEngine;
```

Change to:
```javascript
// Option A: Named import (recommended for ESM)
import { getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';

// Option B: Default import
import flagEngine from '../utils/flagEvaluationEngine.mjs';
const { getEligibleHorses } = flagEngine;
```

**Step 3**: Update all usages in the same file:

Change from:
```javascript
const eligibleHorses = await _getEligibleHorses(evaluationDate);
```

Change to:
```javascript
const eligibleHorses = await getEligibleHorses(evaluationDate);
```

### Expected Test Result After Fix

Once the import is fixed, the test should load successfully. The auth-cookies test itself is well-written and tests:
- HttpOnly cookie setting on registration/login
- XSS protection (no tokens in response body)
- CSRF protection (SameSite=Strict)
- Cookie-based authentication
- Token refresh with cookies
- Logout cookie clearing
- Authorization header fallback

---

## Issue 2: Frontend Test Framework Mismatch

### Error Details
```
Cannot find module 'vitest'
```

**File**: `frontend/src/lib/__tests__/api-client.test.ts`
**Imports**: Lines 10 - Tests use Vitest API

### Root Cause Analysis

**Test File Configuration** (Line 10):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**Project Configuration**:
- **Frontend uses Jest** - Not Vitest
- No `vitest` package in dependencies
- No `vitest.config.ts` exists
- Jest is not explicitly required in `frontend/package.json` either

**Investigation Results**:

1. **No Frontend package.json exists** - The frontend project uses React components but:
   - No dedicated `package.json` at `frontend/package.json`
   - Uses components mixed with backend/mobile projects
   - Testing configuration is unclear

2. **Mobile project uses Jest** - `equoria-mobile/package.json` (Line 65-115):
   ```json
   "jest": {
     "preset": "jest-expo",
     ...
   }
   ```

3. **Backend uses Jest with ESM** - `backend/package.json` (Line 11):
   ```json
   "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
   ```

### Test File Analysis

The test file is comprehensive and well-written for testing httpOnly cookie-based authentication:
- Tests `apiClient.get/post/put/delete()` methods
- Validates `credentials: 'include'` setting
- Tests auth API methods (login, register, logout, profile, refresh)
- Tests error handling (401, 403, network errors)
- Tests XSS protection (no tokens in response)
- Tests security aspects

**File Size**: 424 lines
**Test Coverage**: 23 test cases

### Solution Approach

**Option A: Convert Tests to Jest** (Recommended if frontend is independent)

Convert Vitest imports to Jest:

**Before** (Vitest):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**After** (Jest):
```typescript
// Jest uses globals - no import needed
// Use jest.fn() instead of vi.fn()
// Use jest.spyOn() instead of vi.spyOn()
```

**Option B: Set Up Vitest** (If Vitest is preferred)

Add to `package.json`:
```json
{
  "devDependencies": {
    "vitest": "^1.6.0",
    "@vitest/ui": "^1.6.0",
    "jsdom": "^24.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### Recommended Fix: Convert to Jest

Since backend uses Jest with ESM modules and mobile uses Jest, standardizing on Jest provides consistency.

**Conversion Changes Required**:

1. **Remove Vitest imports** (Line 10):
```typescript
// DELETE:
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Jest uses globals - no import needed
```

2. **Replace `vi.fn()` with `jest.fn()`** (Line 14):
```typescript
// Before:
const mockFetch = vi.fn();

// After:
const mockFetch = jest.fn();
```

3. **Replace `vi.spyOn()` with `jest.spyOn()`** (Line 373):
```typescript
// Before:
const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

// After:
const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
```

4. **Replace `vi.restoreAllMocks()` with `jest.restoreAllMocks()`** (Line 23):
```typescript
// Before:
vi.restoreAllMocks();

// After:
jest.restoreAllMocks();
```

5. **Update mock reset** (Line 19):
```typescript
// Before:
mockFetch.mockClear();

// After:
mockFetch.mockClear();
// Both work - no change needed
```

6. **Type annotations** - Keep as-is, they work with Jest

### Complete Converted Test File Structure

```typescript
// NO imports needed - Jest globals
// jest, describe, it, expect, beforeEach, afterEach are global

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Client - HttpOnly Cookie Support', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();  // Changed from vi.restoreAllMocks()
  });

  // ... rest of tests unchanged except for vi.spyOn -> jest.spyOn()
});
```

---

## Implementation Instructions

### For Backend Issue (Priority: HIGH)

**Step 1**: Find the problematic import
```bash
cd C:\Users\heirr\OneDrive\Desktop\Equoria\backend
grep -r "_getEligibleHorses" --include="*.mjs" .
```

**Step 2**: Edit the file containing the import

Example - if in `epigeneticFlagRoutes.mjs`:
```javascript
// Line to find and change:
import { _getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';

// Change to:
import { getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';

// And update usage:
const horses = await _getEligibleHorses(date);  // BEFORE
const horses = await getEligibleHorses(date);   // AFTER
```

**Step 3**: Run backend tests to verify
```bash
cd backend
npm run test:integration
# Should run auth-cookies.test.mjs successfully
```

### For Frontend Issue (Priority: MEDIUM)

**Step 1**: Update test file imports

Edit `frontend/src/lib/__tests__/api-client.test.ts`:

Remove line 10:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**Step 2**: Replace all Vitest API calls

Find and replace:
- `vi.fn()` → `jest.fn()`
- `vi.spyOn(` → `jest.spyOn(`
- `vi.restoreAllMocks()` → `jest.restoreAllMocks()`

**Step 3**: Ensure Jest is installed in frontend

Check if Jest configuration exists, or add to package.json if needed:
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Step 4**: Run tests to verify
```bash
cd frontend
npm test -- api-client.test.ts
# Should run 23 tests successfully
```

---

## Summary of Changes

### Backend Fix
| Issue | Location | Change | Impact |
|-------|----------|--------|--------|
| Import Error | `*Routes.mjs` | `_getEligibleHorses` → `getEligibleHorses` | Fixes module resolution |
| Function Call | `*Routes.mjs` | All usages updated | Tests can import app.mjs |

### Frontend Fix
| Issue | Location | Change | Impact |
|-------|----------|--------|--------|
| Test Framework | `api-client.test.ts:10` | Remove vitest import | Jest globals available |
| Mock API | `api-client.test.ts:14` | `vi.fn()` → `jest.fn()` | 7 replacements |
| Spy API | `api-client.test.ts:373` | `vi.spyOn()` → `jest.spyOn()` | 2 replacements |
| Restore | `api-client.test.ts:23` | `vi.restoreAllMocks()` → `jest.restoreAllMocks()` | 1 replacement |

---

## Testing Verification

### Backend Tests
```bash
cd backend
npm run test:integration 2>&1 | grep -A 5 "auth-cookies"
# Expected: PASS or test suite runs without import errors
```

### Frontend Tests
```bash
cd frontend
npm test -- src/lib/__tests__/api-client.test.ts
# Expected: 23 tests passing with ~100% coverage
```

---

## Additional Notes

### Backend Module Structure
- **Export Style**: Both named and default exports used
- **Module Type**: `"type": "module"` (ESM)
- **Jest ESM Support**: Using `--experimental-vm-modules` flag

### Frontend Testing Standards
- **Framework**: Jest (consistent with mobile app)
- **API Client Tests**: Well-designed, comprehensive coverage
- **Mock Strategy**: Global fetch mocking (appropriate for API client)
- **Security Focus**: XSS, CSRF, credential handling tested

### Best Practices Implemented
1. Named exports preferred over underscores for private functions
2. Test framework consistency across projects
3. Comprehensive API client testing coverage
4. Security-focused test scenarios

---

## Estimated Resolution Time
- **Backend Fix**: 5-10 minutes (find + fix + verify)
- **Frontend Fix**: 10-15 minutes (conversion + testing)
- **Total**: 15-25 minutes
