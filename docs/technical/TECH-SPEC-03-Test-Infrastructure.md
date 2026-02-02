# TECH-SPEC-03: Test Infrastructure Fix

**Status:** Draft
**Version:** 1.0.0
**Created:** 2025-12-02
**Source:** TODO.md, ES_MODULES_REQUIREMENTS.md, GENERAL_RULES.md

---

## Overview

Fix the Babel configuration conflict causing "require is not defined" errors in the test suite. The project uses ES Modules exclusively, but Babel's CommonJS output is conflicting with the module system.

## Problem Statement

### Current Error
```
ReferenceError: require is not defined
    at Object.<anonymous> (backend/tests/someTest.mjs)
```

### Root Cause
1. Babel transforming ES Modules to CommonJS (`module.exports`, `require()`)
2. Jest configured incorrectly for ES Modules
3. Conflicting `babel.config.json` and `jest.config.mjs` settings

### Impact
- ~10% of tests failing (42/468)
- CI/CD pipeline unreliable
- Development velocity reduced

---

## Phase 1: Diagnosis (Priority: P0)

**Estimated Hours:** 2-3

### 1.1 Audit Current Configuration

**Files to Review:**
- `backend/babel.config.json` (or `.babelrc`)
- `backend/jest.config.mjs`
- `backend/package.json` (type: "module")
- `backend/.eslintrc.json`

### 1.2 Identify Conflicting Settings

**Common Issues:**
1. `@babel/preset-env` targeting CommonJS
2. Jest using `transform` that outputs CommonJS
3. Missing `transformIgnorePatterns` for ES module packages
4. Incorrect `moduleFileExtensions` order

---

## Phase 2: Configuration Fix (Priority: P0)

**Estimated Hours:** 4-6

### 2.1 Jest Configuration Update

**File:** `backend/jest.config.mjs`

```javascript
export default {
  // Use ES Modules natively
  testEnvironment: 'node',

  // Transform only specific packages that need it
  transform: {},

  // Allow .mjs files to be tested without transformation
  extensionsToTreatAsEsm: ['.mjs'],

  // Module file extensions in correct order
  moduleFileExtensions: ['mjs', 'js', 'json', 'node'],

  // Don't transform node_modules except specific packages
  transformIgnorePatterns: [
    'node_modules/(?!(@prisma|some-esm-package)/)'
  ],

  // Use experimental VM modules
  testRunner: 'jest-circus/runner',

  // Handle ESM properly
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.mjs',
    '**/*.test.mjs',
    '**/*.spec.mjs'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.mjs',
    'services/**/*.mjs',
    'controllers/**/*.mjs',
    '!**/node_modules/**'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.mjs'],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

### 2.2 Babel Configuration (Remove or Simplify)

**Option A: Remove Babel Entirely** (Recommended)

Since Node.js 18+ natively supports ES Modules, Babel may not be needed:

```bash
# Remove babel-related dependencies
npm uninstall @babel/core @babel/preset-env babel-jest
rm babel.config.json
```

**Option B: Configure Babel for ES Modules**

If Babel is required for other reasons:

**File:** `backend/babel.config.json`

```json
{
  "presets": [
    ["@babel/preset-env", {
      "targets": {
        "node": "18"
      },
      "modules": false
    }]
  ],
  "env": {
    "test": {
      "plugins": []
    }
  }
}
```

### 2.3 Package.json Updates

**File:** `backend/package.json`

```json
{
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:coverage": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch"
  }
}
```

---

## Phase 3: Test File Updates (Priority: P1)

**Estimated Hours:** 4-6

### 3.1 Import Statement Fixes

Ensure all test files use ES Module syntax:

```javascript
// CORRECT
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { myFunction } from '../src/myModule.mjs';

// INCORRECT (CommonJS)
const { describe, test } = require('@jest/globals');
const myFunction = require('../src/myModule');
```

### 3.2 Mock Updates

Update mocking patterns for ES Modules:

```javascript
// CORRECT - ES Module mocking
import { jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn()
  }
};

jest.unstable_mockModule('../prismaClient.mjs', () => ({
  default: mockPrisma
}));

// Import after mock setup
const { userService } = await import('../services/userService.mjs');
```

### 3.3 Setup File

**File:** `backend/tests/setup.mjs`

```javascript
import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Suppress console during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

---

## Phase 4: CI/CD Updates (Priority: P1)

**Estimated Hours:** 2-3

### 4.1 GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Run tests
        run: npm test -- --ci --coverage
        working-directory: backend
        env:
          NODE_OPTIONS: '--experimental-vm-modules'
```

### 4.2 Test Coverage Gates

Update coverage thresholds to match project standards:

```javascript
// jest.config.mjs
coverageThreshold: {
  global: {
    branches: 80,
    functions: 85,
    lines: 85,
    statements: 85
  }
}
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current configuration files
- [ ] Document current test pass/fail counts
- [ ] Identify tests with CommonJS patterns

### Migration Steps
- [ ] Update jest.config.mjs
- [ ] Remove or update babel.config.json
- [ ] Update package.json test scripts
- [ ] Update test setup files
- [ ] Fix import statements in test files
- [ ] Update mocking patterns

### Post-Migration
- [ ] Run full test suite
- [ ] Compare pass/fail counts
- [ ] Update CI/CD pipeline
- [ ] Document changes

---

## Verification

### Success Criteria
1. All 468+ tests pass
2. No "require is not defined" errors
3. Test execution time unchanged or improved
4. Coverage reports generate correctly
5. CI/CD pipeline passes

### Verification Commands
```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --verbose

# Run single test file
npm test -- path/to/test.mjs

# Check for CommonJS patterns
grep -r "require(" backend/tests/ --include="*.mjs"
grep -r "module.exports" backend/tests/ --include="*.mjs"
```

---

## Rollback Plan

If migration fails:

1. Restore backup configuration files
2. Revert package.json changes
3. Reset jest.config.mjs
4. Re-run tests to confirm baseline

```bash
# Restore from backup
git checkout HEAD~1 -- backend/jest.config.mjs
git checkout HEAD~1 -- backend/babel.config.json
git checkout HEAD~1 -- backend/package.json
```

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Diagnosis | 2-3 hours | None |
| Configuration Fix | 4-6 hours | Phase 1 |
| Test File Updates | 4-6 hours | Phase 2 |
| CI/CD Updates | 2-3 hours | Phase 3 |
| **Total** | **12-18 hours** | |
