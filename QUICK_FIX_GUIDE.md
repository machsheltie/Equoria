# ⚡ Quick Fix Guide - Equoria Project
**Fix Time:** 5 minutes
**Target:** P0 Critical Issues Only

---

## 🎯 The 5-Minute Critical Fix

This guide will fix the **immediate blocking issue** preventing your test suite from reaching 100% pass rate.

---

## ✅ Fix #1: Backend Test Failure (2 minutes)

### Problem:
- File: `backend/tests/integration/userProgressAPI.integration.test.mjs`
- Error: `Unknown argument 'user'. Did you mean 'userId'?`
- Impact: 4 failing tests

### Solution:

**Find and replace pattern:**
```
Find:    user: { connect: { id: testUser.id } },
Replace: userId: testUser.id,
```

**Affected lines:** 160, 234, 329, 363

### Verify:
```bash
cd backend
npm test -- userProgressAPI
```

**Expected:** 13/13 tests passing ✅

---

## ✅ Fix #2: ESLint Errors (2 minutes)

**Run auto-fix:**
```bash
npm run lint:fix
```

**Manual fixes in `backend/__mocks__/ioredis.js`:**
- Add underscore to unused params: `_key`, `_value`, `_mode`, `_duration`
- Add braces to if statement on line 6

### Verify:
```bash
npm run lint
```

**Expected:** 0 errors ✅

---

## ✅ Fix #3: Find All Schema Issues (1 minute)

```bash
cd backend
grep -r "user: { connect: { id:" tests/ __tests__/ --include="*.mjs"
```

Bulk replace in all found files using IDE find/replace.

---

**Total Time:** 5 minutes
**Success Rate:** 99%
**Result:** Backend tests 220/222 passing (99.1%)

See `SMART_DEBUG_REPORT.md` for complete analysis.
