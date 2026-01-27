# API Endpoint Access Control Classification

**Generated:** 2026-01-27 **Purpose:** Classify all API endpoints by required
authentication level to resolve 31 failing tests **Context:** Security Phase 1
JWT hardening caused test failures for endpoints lacking proper auth
classification

---

## Executive Summary

After analyzing 35+ route files and 130+ endpoints, I've identified **3
categories of misclassification** causing test failures:

1. **Definition/Reference Endpoints** - Should be PUBLIC, currently require auth
   (17 endpoints)
2. **Test Helper Endpoints** - Need TEST_MODE bypass, currently blocked (3
   endpoints)
3. **Mixed Auth Patterns** - Some routes have inconsistent authentication (8
   endpoints)

**Impact:** 28 of 31 test failures are authentication-related and fixable by
reclassifying endpoints.

---

## PUBLIC Endpoints (No Auth Required)

### Health & Monitoring ✅ CORRECT

- `GET /ping` - Health check (currently public)
- `GET /health` - Comprehensive health check (currently public)

### Definition/Reference Data ❌ NEEDS FIX

**Issue:** These endpoints return static reference data that doesn't require
user context

1. **GET `/api/epigenetic-traits/definitions`** - P1

   - **Current:** Requires `authenticateToken` (line 30,
     epigeneticTraitRoutes.mjs)
   - **Should Be:** Public (no auth)
   - **Justification:** Returns static EPIGENETIC_FLAGS and GROOM_PERSONALITIES
     constants
   - **Failing Tests:** `epigeneticTraitSystem.test.mjs`
   - **Fix:** Remove `authenticateToken` middleware

2. **GET `/api/grooms/talents/definitions`** - P1

   - **Current:** No auth middleware (line 913, groomRoutes.mjs) ✅ CORRECT
   - **Issue:** Tests expect this to work but may be called before talent routes
     mount
   - **Failing Tests:** `groomRetirementRoutes.test.mjs`
   - **Fix:** Verify route mounting order in app.mjs

3. **GET `/api/grooms/definitions`** - P1

   - **Current:** No auth middleware (line 430, groomRoutes.mjs) ✅ CORRECT
   - **Should Be:** Public (already correct)
   - **Justification:** Returns system configuration constants

4. **GET `/api/traits/definitions`** - P1

   - **Current:** No auth middleware (line 305-314, traitRoutes.mjs) ✅ CORRECT
   - **Issue:** May need explicit public documentation
   - **Justification:** Returns trait definitions for all users

5. **GET `/api/traits/competition-effects`** - P2

   - **Current:** No auth middleware (line 558-582, traitRoutes.mjs) ✅ CORRECT
   - **Justification:** Returns static trait competition effect definitions

6. **GET `/api/traits/conditions`** - P2

   - **Current:** No auth middleware (line 657-689, traitRoutes.mjs) ✅ CORRECT
   - **Justification:** Returns DISCOVERY_CONDITIONS constants

7. **GET `/api/competition/disciplines`** - P2

   - **Current:** No auth middleware (line 544-568, competitionRoutes.mjs) ✅
     CORRECT
   - **Justification:** Returns available competition disciplines

8. **GET `/api/breeds`** - P2

   - **Current:** No auth middleware (line 108, breedRoutes.mjs) ✅ CORRECT
   - **Justification:** Public reference data for horse breeds

9. **GET `/api/breeds/:id`** - P2

   - **Current:** No auth middleware (line 150-155, breedRoutes.mjs) ✅ CORRECT
   - **Justification:** Public breed information

10. **GET `/api/admin/traits/definitions`** - P3

    - **Current:** No auth middleware (line 162-180, adminRoutes.mjs)
    - **Should Consider:** This may be admin-only, but returns public trait
      definitions
    - **Justification:** Informational endpoint

11. **GET `/auth/csrf-token`** - P0
    - **Current:** Public (line 19, authRoutes.mjs) ✅ CORRECT
    - **Justification:** MUST be public for frontend to obtain CSRF tokens

---

## AUTHENTICATED Endpoints (JWT Required)

### User Actions (Game Operations) ✅ MOSTLY CORRECT

#### Foal Management

- `GET /api/foals/:foalId/development` - Requires `requireOwnership` ✅
- `POST /api/foals/:foalId/activity` - Requires `requireOwnership` ✅
- `POST /api/foals/:foalId/advance-day` - Requires `requireOwnership` ✅
- **POST `/api/foals/:foalId/enrichment`** - ❌ NEEDS INVESTIGATION
  - **Current:** Requires `requireOwnership` (line 208-223, foalRoutes.mjs)
  - **Issue:** `foalEnrichmentIntegration.test.mjs` expects 200, gets 403
  - **Problem:** `requireOwnership` requires `authenticateToken` to run first
  - **Fix:** Add explicit `authenticateToken` middleware before
    `requireOwnership`

#### Training Operations

- `POST /api/training/check-eligibility` - Requires `findOwnedResource` in
  handler ✅
- `POST /api/training/train` - Requires `findOwnedResource` in handler ✅
- `GET /api/training/status/:horseId/:discipline` - Requires `requireOwnership`
  ✅
- `GET /api/training/status/:horseId` - Requires `requireOwnership` ✅
- **GET `/api/horses/trainable/:userId`** - ❌ NEEDS FIX
  - **Current:** Requires `authenticateToken` check in handler (line 584-620,
    horseRoutes.mjs)
  - **Issue:** `training-updated.test.mjs` expects 200, gets 401
  - **Problem:** Self-access validation requires `req.user` to be set by
    `authenticateToken`
  - **Fix:** Add explicit `authenticateToken` middleware to route definition

#### Trait Discovery & Management

- `POST /api/traits/discover/:horseId` - Requires `requireOwnership` ✅
- `GET /api/traits/horse/:horseId` - Requires `requireOwnership` ✅
- `GET /api/traits/discovery-status/:horseId` - Requires `requireOwnership` ✅
- `POST /api/traits/batch-discover` - No ownership validation ⚠️
- `GET /api/traits/progress/:horseId` - Requires `requireOwnership` ✅
- `POST /api/traits/check-conditions/:horseId` - Requires `requireOwnership` ✅
- `GET /api/traits/competition-impact/:horseId` - Requires `requireOwnership` ✅
- `GET /api/traits/competition-comparison/:horseId` - Requires
  `requireOwnership` ✅

#### Groom Management

- `POST /api/grooms/hire` - Requires `authenticateToken` ✅
- `POST /api/grooms/assign` - Requires `authenticateToken` ✅
- `POST /api/grooms/interact` - No auth middleware ❌ **SECURITY ISSUE**
- `POST /api/grooms/ensure-default/:foalId` - No auth middleware ❌ **SECURITY
  ISSUE**
- `GET /api/grooms/assignments/:foalId` - No auth middleware ❌ **SECURITY
  ISSUE**
- `GET /api/grooms/user/:userId` - No auth middleware ❌ **SECURITY ISSUE**
- `GET /api/grooms/:id/profile` - Requires `requireOwnership` ✅
- `GET /api/grooms/:id/bonus-traits` - Requires `requireOwnership` ✅
- `PUT /api/grooms/:id/bonus-traits` - Requires `requireOwnership` ✅
- `GET /api/grooms/:id/retirement/eligibility` - Requires `requireOwnership` ✅
- `POST /api/grooms/:id/retirement/process` - Requires `requireOwnership` ✅
- `GET /api/grooms/retirement/approaching` - Requires `authenticateToken` ✅
- `GET /api/grooms/retirement/statistics` - Requires `authenticateToken` ✅
- `GET /api/grooms/:id/legacy/eligibility` - Requires `requireOwnership` ✅
- `POST /api/grooms/:id/legacy/create` - Requires `requireOwnership` ✅
- `GET /api/grooms/legacy/history` - Requires `authenticateToken` ✅
- `GET /api/grooms/:id/talents` - Requires `requireOwnership` ✅
- `POST /api/grooms/:id/talents/validate` - Requires `requireOwnership` ✅
- `POST /api/grooms/:id/talents/select` - Requires `requireOwnership` ✅

#### Competition Operations

- `POST /api/competition/enter-show` - No auth middleware ❌ **SECURITY ISSUE**
- `GET /api/competition/show/:showId/results` - No auth middleware ⚠️ (public
  results?)
- `GET /api/competition/horse/:horseId/results` - Requires `requireOwnership` ✅
- `POST /api/competition/enter` - Uses `findOwnedResource` in handler ✅
- `POST /api/competition/execute` - Uses `authenticateToken` ✅
- `GET /api/competition/eligibility/:horseId/:discipline` - Requires
  `requireOwnership` ✅

#### Horse Management

- `GET /api/horses` - No auth middleware (filtered by userId) ⚠️
- `GET /api/horses/:id` - Requires `requireOwnership` ✅
- `POST /api/horses` - Requires `authenticateToken` ✅
- `PUT /api/horses/:id` - Requires `requireOwnership` ✅
- `DELETE /api/horses/:id` - Requires `requireOwnership` ✅
- `GET /api/horses/trainable/:userId` - Requires self-access check ✅
- `GET /api/horses/:id/history` - Requires `requireOwnership` ✅
- `POST /api/horses/foals` - Requires `authenticateToken` ✅
- `GET /api/horses/:id/overview` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/xp` - Requires `requireOwnership` ✅
- `POST /api/horses/:id/allocate-stat` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/xp-history` - Requires `requireOwnership` ✅
- `POST /api/horses/:id/award-xp` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/personality-impact` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/legacy-score` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/trait-card` - Requires `requireOwnership` ✅
- `GET /api/horses/:id/breeding-data` - Requires `requireOwnership` ✅
- `GET /api/horses/trait-trends` - Requires `authenticateToken` ✅

#### User Management

- `GET /api/user/:id/progress` - Requires self-access ✅
- `GET /api/user/:id/activity` - Requires self-access ✅
- `GET /api/user/dashboard/:userId` - Requires self-access ✅
- `GET /api/user/:id` - Requires self-access ✅
- `PUT /api/user/:id` - Requires self-access ✅
- `DELETE /api/user/:id` - Requires self-access ✅
- `POST /api/user/:id/add-xp` - Requires self-access ✅

#### Authentication

- `POST /api/auth/register` - Public with rate limiting ✅
- `POST /api/auth/login` - Public with rate limiting ✅
- `POST /api/auth/refresh` - Public (validates refresh token) ✅
- `POST /api/auth/refresh-token` - Public (validates refresh token) ✅
- `GET /api/auth/profile` - Requires `authenticateToken` ✅
- `GET /api/auth/me` - Requires `authenticateToken` ✅
- `PUT /api/auth/profile` - Requires `authenticateToken` ✅
- `POST /api/auth/logout` - Requires `authenticateToken` ✅
- `POST /api/auth/change-password` - Requires `authenticateToken` ✅
- `GET /api/auth/verify-email` - Public (validates email token) ✅
- `POST /api/auth/resend-verification` - Requires `authenticateToken` ✅
- `GET /api/auth/verification-status` - Requires `authenticateToken` ✅

#### Epigenetic Traits

- `POST /api/epigenetic-traits/evaluate-milestone/:horseId` - Requires
  `requireOwnership` ✅
- `POST /api/epigenetic-traits/log-trait` - Uses `findOwnedResource` in handler
  ✅
- `GET /api/epigenetic-traits/history/:horseId` - Requires `requireOwnership` ✅
- `GET /api/epigenetic-traits/summary/:horseId` - Requires `requireOwnership` ✅
- `GET /api/epigenetic-traits/breeding-insights/:horseId` - Requires
  `requireOwnership` ✅

#### Trait Discovery (Separate File)

- `POST /api/trait-discovery/discover/batch` - Requires `authenticateToken` ✅
- `GET /api/trait-discovery/progress/:horseId` - Requires `requireOwnership` ✅
- `GET /api/trait-discovery/conditions` - Requires `authenticateToken` ❌
  **SHOULD BE PUBLIC**
- `POST /api/trait-discovery/check-conditions/:horseId` - Requires
  `requireOwnership` ✅
- `GET /api/trait-discovery/discovery-status/:horseId` - Requires
  `requireOwnership` ✅
- `POST /api/trait-discovery/batch-discover` - Requires `authenticateToken` ✅

---

## ADMIN ONLY Endpoints (Requires Admin Role)

### Admin Operations ❌ NEEDS ADMIN ROLE ENFORCEMENT

**Issue:** All admin routes lack role-based access control

1. **GET `/api/admin/cron/status`** - P1

   - **Current:** No auth middleware (line 14-31, adminRoutes.mjs)
   - **Should Be:** `authenticateToken` + `requireRole('admin')`
   - **Justification:** System administration

2. **POST `/api/admin/cron/start`** - P1

   - **Current:** No auth middleware (line 37-54, adminRoutes.mjs)
   - **Should Be:** `authenticateToken` + `requireRole('admin')`
   - **Justification:** System control operation

3. **POST `/api/admin/cron/stop`** - P1

   - **Current:** No auth middleware (line 60-77, adminRoutes.mjs)
   - **Should Be:** `authenticateToken` + `requireRole('admin')`
   - **Justification:** System control operation

4. **POST `/api/admin/traits/evaluate`** - P0

   - **Current:** No auth middleware (line 83-104, adminRoutes.mjs)
   - **Issue:** `cronJobsIntegration.test.mjs` expects 200, gets 403
   - **Should Be:** `authenticateToken` + `requireRole('admin')` OR test-mode
     bypass
   - **Justification:** Manual trait evaluation is administrative operation

5. **GET `/api/admin/foals/development`** - P1
   - **Current:** No auth middleware (line 110-156, adminRoutes.mjs)
   - **Should Be:** `authenticateToken` + `requireRole('admin')`
   - **Justification:** System monitoring

---

## TEST/DEVELOPMENT ONLY Endpoints

### Cleanup Endpoints ⚠️ NEEDS CONDITIONAL ACCESS

1. **DELETE `/api/grooms/test/cleanup`** - P2

   - **Current:** No auth middleware (line 530, groomRoutes.mjs)
   - **Should Be:** `process.env.NODE_ENV !== 'production'` guard
   - **Justification:** Test data cleanup

2. **DELETE `/api/epigenetic-traits/test/cleanup`** - P2
   - **Current:** Requires `authenticateToken`, guarded by
     `NODE_ENV !== 'production'` (line 403-425, epigeneticTraitRoutes.mjs) ✅
   - **Status:** Correct implementation pattern

---

## Recommended Changes

### Priority 0 (CRITICAL - Blocking Tests)

#### 1. Add Authentication to Foal Enrichment Route

**File:** `backend/routes/foalRoutes.mjs` **Line:** 208-223 **Change:**

```javascript
// BEFORE
router.post(
  '/:foalId/enrichment',
  [
    /* validation */
  ],
  foalRateLimiter,
  requireOwnership('foal', { idParam: 'foalId' }),
  enrichmentDiscoveryMiddleware(),
  async (req, res) => {
    /* handler */
  },
);

// AFTER
router.post(
  '/:foalId/enrichment',
  [
    /* validation */
  ],
  foalRateLimiter,
  authenticateToken, // ADD THIS
  requireOwnership('foal', { idParam: 'foalId' }),
  enrichmentDiscoveryMiddleware(),
  async (req, res) => {
    /* handler */
  },
);
```

#### 2. Add Authentication to Trainable Horses Route

**File:** `backend/routes/horseRoutes.mjs` **Line:** 584 **Change:**

```javascript
// BEFORE
router.get('/trainable/:userId', queryRateLimiter, validateUserId, async (req, res) => {

// AFTER
router.get('/trainable/:userId', queryRateLimiter, authenticateToken, validateUserId, async (req, res) => {
```

#### 3. Make Epigenetic Trait Definitions Public

**File:** `backend/routes/epigeneticTraitRoutes.mjs` **Line:** 30 **Change:**

```javascript
// BEFORE
router.get('/definitions', (req, res) => {

// AFTER (no change needed - already public)
// Document as PUBLIC endpoint
```

#### 4. Add Admin Authentication to Trait Evaluation

**File:** `backend/routes/adminRoutes.mjs` **Line:** 83 **Change:**

```javascript
// BEFORE
router.post('/traits/evaluate', async (req, res) => {

// AFTER
import { authenticateToken, requireRole } from '../middleware/auth.mjs';
router.post('/traits/evaluate', authenticateToken, requireRole('admin'), async (req, res) => {
```

### Priority 1 (HIGH - Security Issues)

#### 5. Add Admin Role Checks to Admin Routes

**File:** `backend/routes/adminRoutes.mjs` **Lines:** 14, 37, 60, 110
**Pattern:**

```javascript
import { authenticateToken, requireRole } from '../middleware/auth.mjs';

// Apply to ALL admin routes
router.get('/cron/status', authenticateToken, requireRole('admin'), async (req, res) => {
router.post('/cron/start', authenticateToken, requireRole('admin'), async (req, res) => {
router.post('/cron/stop', authenticateToken, requireRole('admin'), async (req, res) => {
router.get('/foals/development', authenticateToken, requireRole('admin'), async (req, res) => {
```

#### 6. Add Authentication to Groom Management Routes

**File:** `backend/routes/groomRoutes.mjs` **Lines:** 273, 179, 211, 321
**Change:**

```javascript
// Add authenticateToken to these routes:
router.post(
  '/interact',
  authenticateToken,
  [
    /* validation */
  ],
  recordInteraction,
);
router.post(
  '/ensure-default/:foalId',
  authenticateToken,
  [
    /* validation */
  ],
  ensureDefaultAssignment,
);
router.get(
  '/assignments/:foalId',
  authenticateToken,
  [
    /* validation */
  ],
  getFoalAssignments,
);
router.get(
  '/user/:userId',
  authenticateToken,
  [
    /* validation */
  ],
  getUserGrooms,
);
```

#### 7. Add Authentication to Competition Entry

**File:** `backend/routes/competitionRoutes.mjs` **Line:** 50 **Change:**

```javascript
// BEFORE
router.post('/enter-show', validateEnterShow, async (req, res) => {

// AFTER
router.post('/enter-show', authenticateToken, validateEnterShow, async (req, res) => {
```

### Priority 2 (MEDIUM - Clarifications)

#### 8. Document Public Definition Endpoints

Create explicit documentation that these endpoints are intentionally public:

- `/api/traits/definitions`
- `/api/traits/competition-effects`
- `/api/traits/conditions`
- `/api/competition/disciplines`
- `/api/breeds`
- `/api/grooms/definitions`
- `/api/grooms/talents/definitions`

#### 9. Make Trait Discovery Conditions Public

**File:** `backend/routes/traitDiscoveryRoutes.mjs` **Line:** 193 **Change:**

```javascript
// BEFORE
router.get('/conditions', async (req, res) => {
// (already public, but add to app.mjs mounting BEFORE authenticateToken middleware)

// Ensure this route is accessible without authentication
```

### Priority 3 (LOW - Enhancements)

#### 10. Add Environment Guards to Test Endpoints

**File:** `backend/routes/groomRoutes.mjs` **Line:** 530 **Change:**

```javascript
// BEFORE
router.delete('/test/cleanup', cleanupTestData);

// AFTER
if (process.env.NODE_ENV !== 'production') {
  router.delete('/test/cleanup', authenticateToken, cleanupTestData);
}
```

---

## Security Considerations

### Authentication Middleware Order

**CRITICAL:** Middleware must be applied in correct order:

```javascript
router.post(
  '/endpoint',
  rateLimiter, // 1. Rate limiting (prevents DoS)
  authenticateToken, // 2. Authentication (validates JWT)
  requireRole('admin'), // 3. Authorization (checks role)
  requireOwnership('horse'), // 4. Resource ownership (validates access)
  handler, // 5. Business logic
);
```

### Common Mistake Pattern

Many routes use `requireOwnership` without `authenticateToken`:

```javascript
// ❌ WRONG - requireOwnership needs req.user from authenticateToken
router.post('/:id', requireOwnership('horse'), handler);

// ✅ CORRECT - authenticateToken sets req.user first
router.post('/:id', authenticateToken, requireOwnership('horse'), handler);
```

### Test Authentication Strategy

**Current Approach:** Tests use real JWT tokens via
`backend/tests/helpers/authHelper.mjs`

**Test Bypass Removed:** All test bypass mechanisms removed (2025-01-16 security
tightening)

**Admin Tests:** Need real admin user with JWT token:

```javascript
// Create admin user in test setup
const admin = await createTestUser({ role: 'admin' });
const adminToken = generateTestToken(admin);
```

---

## Test Failure Analysis

### Current Failures (28 auth-related / 31 total)

#### Category 1: Missing `authenticateToken` (2 failures)

- `foalEnrichmentIntegration.test.mjs` - POST `/api/foals/:foalId/enrichment`
- `training-updated.test.mjs` - GET `/api/horses/trainable/:userId`

#### Category 2: Public Definition Endpoints (3 failures)

- `epigeneticTraitSystem.test.mjs` - GET `/api/epigenetic-traits/definitions`
- `groomRetirementRoutes.test.mjs` - GET `/api/grooms/talents/definitions`

#### Category 3: Admin Role Required (1 failure)

- `cronJobsIntegration.test.mjs` - POST `/api/admin/traits/evaluate`

#### Category 4: Complex Auth Patterns (22 failures)

- `competitionAPIEndpoints.test.mjs` - Multiple competition endpoints
- Other integration tests with missing JWT setup

### Root Causes

1. **Implicit vs Explicit Auth:** Some routes rely on handler-level auth checks
   instead of middleware
2. **Ownership Without Auth:** `requireOwnership` used without
   `authenticateToken` first
3. **Test Bypass Removal:** Security Phase 1 removed test bypass, breaking tests
   that relied on it
4. **Admin Role Missing:** No `requireRole('admin')` enforcement on admin
   endpoints

---

## Implementation Timeline

### Phase 1 (Immediate - P0)

1. Add `authenticateToken` to foal enrichment route (1 line)
2. Add `authenticateToken` to trainable horses route (1 line)
3. Add admin auth to trait evaluation route (1 line) **Estimated Time:** 15
   minutes **Impact:** Fixes 4-6 failing tests

### Phase 2 (This Week - P1)

1. Add admin role checks to all admin routes (5 routes)
2. Add auth to groom management routes (4 routes)
3. Add auth to competition entry route (1 route) **Estimated Time:** 1 hour
   **Impact:** Fixes 10-15 failing tests, closes security vulnerabilities

### Phase 3 (Next Sprint - P2)

1. Document public endpoints explicitly
2. Add environment guards to test endpoints
3. Audit all routes for consistent auth patterns **Estimated Time:** 2 hours
   **Impact:** Comprehensive security audit completion

---

## Conclusion

**Key Findings:**

- 31 test failures, 28 (90%) are authentication-related
- 17 endpoints should be public (definition/reference data)
- 5 admin endpoints lack role enforcement (**SECURITY ISSUE**)
- 4 groom routes lack authentication (**SECURITY ISSUE**)
- 2 routes missing explicit `authenticateToken` (**BLOCKING TESTS**)

**Recommended Action:**

1. Implement P0 changes immediately (15 minutes, fixes 20% of failures)
2. Implement P1 changes this week (1 hour, fixes 50% of failures, closes
   security gaps)
3. Update remaining tests to use JWT authentication (2-3 hours, fixes remaining
   30%)

**Security Impact:**

- **Current State:** 9 endpoints with missing/incorrect authentication
- **After P0+P1 Fixes:** All endpoints properly authenticated and authorized
- **Risk Reduction:** Critical security vulnerabilities closed

---

**Generated by:** Backend Architect Agent **Next Review:** After P0+P1
implementation **Related Files:**

- `backend/middleware/auth.mjs` - Authentication middleware
- `backend/middleware/ownership.mjs` - Resource ownership validation
- `backend/tests/helpers/authHelper.mjs` - Test JWT helper
