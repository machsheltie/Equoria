# Phase 2: HIGH Priority Infrastructure Implementation Plan

**Task:** Equoria-vkz
**Status:** In Progress
**Estimated Time:** 24-30 hours
**Priority:** 2 (HIGH)
**Created:** 2026-01-27

---

## Executive Summary

Phase 2 focuses on implementing Redis circuit breakers for rate limiting and caching, plus fixing IDOR (Insecure Direct Object Reference) vulnerabilities. This builds on Phase 1's authentication security fixes and ensures production infrastructure resilience.

**Key Objectives:**

1. Implement circuit breaker patterns for Redis operations
2. Add graceful degradation and fallback strategies
3. Fix IDOR vulnerabilities by applying ownership middleware
4. Comprehensive testing of failure scenarios

---

## Current State Analysis

### Redis Usage Audit

**Files Using Redis:**

- `backend/utils/cacheHelper.mjs` - Caching implementation (506 lines)
- `backend/middleware/rateLimiting.mjs` - Rate limiting (415 lines)
- `backend/middleware/authRateLimiter.mjs` - Auth-specific rate limiting
- `backend/middleware/trainingRateLimit.mjs` - Training-specific limits

**Current Implementation Strengths:**
✅ Redis connection with retry strategy (3 retries max)
✅ Automatic fallback to in-memory cache/storage
✅ Event handlers for connection state (error, connect, close, ready)
✅ Connection timeouts (2 seconds)
✅ Exponential backoff for reconnection
✅ Offline queue disabled (prevents command queuing when offline)
✅ Graceful degradation (fail open, not closed)

**Current Implementation Gaps:**
❌ NO formal circuit breaker pattern
❌ NO failure rate tracking to open circuit proactively
❌ NO half-open state for recovery testing
❌ NO cascading failure prevention during sustained Redis issues
❌ NO health monitoring metrics for circuit state
❌ NO configurable thresholds for circuit breaker triggers

### Ownership Middleware Analysis

**Current Implementation:**
✅ `backend/middleware/ownership.mjs` exists and is comprehensive (362 lines)
✅ Single-query ownership validation pattern (50% reduction in DB queries)
✅ Atomic ownership validation (no race conditions)
✅ Prevents ownership disclosure (returns 404, not 403)
✅ Supports nested owner fields (e.g., `horse.ownerId`)
✅ Batch ownership validation for multiple resources
✅ Resource-to-model mapping configuration

**Supported Resources:**

- horse, foal, groom, groom-assignment
- breeding, competition, competition-entry
- training, training-session

**IDOR Risk Assessment:**

- **High Risk:** Endpoints accessing resources by ID without `requireOwnership` middleware
- **Medium Risk:** Endpoints using `findOwnedResource` helper (non-middleware)
- **Low Risk:** Endpoints protected by `requireOwnership` middleware

### Security Findings from Phase 1 Audit

**Production Readiness:** 87/100

**Remaining Security Concerns:**

1. Rate limit enforcement test file is placeholder (-3 points)
2. `$executeRawUnsafe` in admin service needs audit (-3 points)
3. Test-only headers remain in codebase (-3 points)
4. MFA not implemented (-2 points)

---

## Architecture Decisions

### Circuit Breaker Pattern Selection

**Recommended Library:** `opossum` (Circuit Breaker for Node.js)

- Industry standard, 4.5k+ stars on GitHub
- Supports async/await and Promises
- Configurable timeouts, error thresholds, reset timeout
- Half-open state for graceful recovery
- Health monitoring events
- Metrics collection built-in

**Alternative Considered:** `cockatiel` (Microsoft)

- More modern TypeScript implementation
- Excellent documentation
- Slightly less adoption than opossum

**Decision:** Use `opossum` for proven stability and ecosystem support.

### Circuit Breaker Configuration

**Failure Threshold:** 50% error rate over 10 requests

- Open circuit after 5 failures in 10 attempts
- Prevents cascading failures during Redis downtime

**Timeout:** 3 seconds per Redis operation

- Balance between user experience and failure detection
- Aligns with current connection timeout (2 seconds)

**Reset Timeout:** 30 seconds

- Time to wait before attempting half-open state
- Allows Redis to recover without overwhelming it

**Half-Open Max Requests:** 3

- Test recovery with small number of requests
- Gradual recovery reduces risk of re-triggering failures

### Fallback Strategies

**Rate Limiting Fallback:**

1. **Primary:** Redis-backed distributed rate limiting
2. **Fallback:** In-memory rate limiting (express-rate-limit default)
3. **Degraded:** Allow requests with logging (circuit open)

**Caching Fallback:**

1. **Primary:** Redis cache with LRU eviction
2. **Fallback:** In-memory Map cache (1000 items max, FIFO eviction)
3. **Degraded:** Direct database queries (circuit open)

**Trade-offs:**

- Fallback to in-memory loses distributed coordination
- Multi-process deployments may have inconsistent limits
- Acceptable for brief outages, unacceptable for sustained issues

---

## Implementation Plan

### Subtask 2.1: Redis Circuit Breaker Implementation (10-12 hours)

**Objective:** Create reusable circuit breaker wrapper for all Redis operations

**Files to Create:**

- `backend/utils/redisCircuitBreaker.mjs` (new, 200-250 lines)

**Files to Modify:**

- `backend/utils/cacheHelper.mjs` (integrate circuit breaker)
- `backend/middleware/rateLimiting.mjs` (integrate circuit breaker)
- `backend/package.json` (add opossum dependency)

**Implementation Steps:**

1. **Install Dependencies** (15 minutes)

   ```bash
   cd backend
   npm install opossum@8.1.4
   ```

2. **Create Circuit Breaker Wrapper** (4-5 hours)

   - Create `redisCircuitBreaker.mjs` with:
     - `createRedisCircuitBreaker(redisClient, options)` factory function
     - Circuit breaker for common operations: get, set, setex, del, keys, flushdb
     - Event handlers: open, halfOpen, close, fallback, timeout, failure
     - Metrics collection: success/failure counts, circuit state, fallback count
     - Health monitoring endpoint data

3. **Integrate with Cache Helper** (2-3 hours)

   - Wrap Redis operations in `cacheHelper.mjs`
   - Update `getCachedQuery` to use circuit breaker
   - Update `invalidateCache` operations
   - Add circuit breaker metrics to `getCacheStatistics`
   - Test fallback to in-memory cache

4. **Integrate with Rate Limiting** (2-3 hours)

   - Wrap Redis operations in `rateLimiting.mjs`
   - Update `createRateLimiter` to use circuit breaker
   - Handle circuit open state (allow or deny?)
   - Add circuit breaker metrics
   - Test fallback to in-memory rate limiting

5. **Add Health Monitoring** (1-2 hours)
   - Create `GET /api/health/redis` endpoint
   - Return circuit breaker state, metrics, Redis availability
   - Include in main `/health` endpoint
   - Add Prometheus-compatible metrics (optional)

**Success Criteria:**

- ✅ Circuit breaker opens after 50% error rate
- ✅ Circuit breaker enters half-open after 30 seconds
- ✅ Fallback strategies work correctly
- ✅ Health monitoring shows circuit state
- ✅ All existing tests pass

---

### Subtask 2.2: Rate Limiting Circuit Breaker (4-5 hours)

**Objective:** Ensure rate limiting gracefully degrades during Redis failures

**Files to Modify:**

- `backend/middleware/rateLimiting.mjs`
- `backend/__tests__/integration/rate-limiting.test.mjs`

**Implementation Steps:**

1. **Update Rate Limiter Factory** (2 hours)

   - Integrate circuit breaker from Subtask 2.1
   - Implement fallback strategy:
     - Circuit closed: Use Redis (distributed)
     - Circuit open: Use in-memory (per-process)
     - Log circuit state changes
   - Handle RedisStore errors gracefully

2. **Circuit Open Behavior** (1 hour)

   - Decision: Allow requests or deny?
   - **Recommendation:** Allow with in-memory fallback
     - Better UX during outages
     - Prevents false rate limit violations
     - Logs degraded mode for monitoring
   - **Alternative:** Deny with 503 Service Unavailable
     - More conservative approach
     - Prevents abuse during outages
     - Requires clear user communication

3. **Testing** (1-2 hours)
   - Test circuit breaker integration
   - Test fallback to in-memory rate limiting
   - Test recovery after Redis comes back
   - Test concurrent requests during failure
   - Load testing with circuit breaker

**Success Criteria:**

- ✅ Rate limiting works during Redis outage
- ✅ Fallback to in-memory when circuit open
- ✅ Recovery to Redis when circuit closes
- ✅ No rate limit false positives during outage
- ✅ Metrics show fallback usage

---

### Subtask 2.3: Caching Circuit Breaker (4-5 hours)

**Objective:** Ensure caching gracefully degrades during Redis failures

**Files to Modify:**

- `backend/utils/cacheHelper.mjs`
- `backend/__tests__/unit/cacheHelper.test.mjs`

**Implementation Steps:**

1. **Update Caching Functions** (2 hours)

   - Integrate circuit breaker from Subtask 2.1
   - Update `getCachedQuery` to use circuit breaker
   - Update `invalidateCache` operations
   - Implement fallback strategy:
     - Circuit closed: Use Redis (distributed cache)
     - Circuit half-open: Test with get operations
     - Circuit open: Use in-memory Map (local cache)
     - Always try local cache as L2

2. **Multi-Tier Caching** (1-2 hours)

   - L1: Local in-memory Map (always available)
   - L2: Redis (via circuit breaker)
   - Circuit open: Only use L1
   - Circuit closed: Use L1 + L2
   - Cache warming on circuit close

3. **Testing** (1-2 hours)
   - Test cache hits/misses during Redis outage
   - Test fallback to in-memory cache
   - Test cache invalidation during outage
   - Test recovery and cache warming
   - Verify cache statistics accuracy

**Success Criteria:**

- ✅ Cache queries succeed during Redis outage
- ✅ Fallback to in-memory when circuit open
- ✅ Cache invalidation works in degraded mode
- ✅ Recovery to Redis when circuit closes
- ✅ Metrics show multi-tier cache usage

---

### Subtask 2.4: IDOR Vulnerability Fixes (6-8 hours)

**Objective:** Apply ownership middleware to all endpoints accessing resources by ID

**Implementation Steps:**

1. **Endpoint Audit** (2-3 hours)

   - Search all route files for `:id`, `:horseId`, `:groomId`, etc.
   - Identify endpoints that:
     - Access resources by ID
     - Don't use `authenticateToken` + `requireOwnership`
     - Use `findOwnedResource` helper (medium risk)
   - Create vulnerability report with risk levels

2. **Apply Ownership Middleware** (2-3 hours)

   - Add `requireOwnership` to high-risk endpoints
   - Prioritize by risk level and usage frequency
   - **High Priority Endpoints:**
     - `GET /api/horses/:id`
     - `PUT /api/horses/:id`
     - `DELETE /api/horses/:id`
     - `GET /api/grooms/:id`
     - `POST /api/training/:horseId`
     - `POST /api/breeding/:sireId/:damId`
     - `POST /api/competitions/:showId/enter`

3. **Test Ownership Checks** (1-2 hours)

   - Create IDOR attack tests for each endpoint
   - Test that user A cannot access user B's resources
   - Test proper error responses (404, not 403)
   - Test batch operations with mixed ownership
   - Verify no information disclosure

4. **Documentation Update** (1 hour)
   - Update API documentation with ownership requirements
   - Add security notes to endpoint descriptions
   - Document error responses for ownership violations
   - Create security best practices guide

**High-Risk Endpoints (Estimated 15-20):**

```javascript
// Horse management
GET /api/horses/:id
PUT /api/horses/:id
DELETE /api/horses/:id
PUT /api/horses/:id/training
PUT /api/horses/:id/stats

// Groom management
GET /api/grooms/:id
PUT /api/grooms/:id
DELETE /api/grooms/:id
POST /api/grooms/assign/:groomId/:foalId

// Breeding
POST /api/breeding/predict
POST /api/breeding/:sireId/:damId

// Training
POST /api/training/:horseId
GET /api/training/:horseId/history

// Competitions
POST /api/competitions/:showId/enter
GET /api/competitions/:resultId

// Foals
GET /api/foals/:id
POST /api/foals/:id/enrichment
GET /api/foals/:id/development
```

**Success Criteria:**

- ✅ All high-risk endpoints have ownership checks
- ✅ IDOR attack tests pass (unauthorized access denied)
- ✅ Proper error responses (404, not 403)
- ✅ No information disclosure in error messages
- ✅ API documentation updated

---

## Testing Strategy

### Circuit Breaker Testing

**Unit Tests:**

- Circuit breaker opens after threshold
- Circuit breaker enters half-open state
- Circuit breaker closes after successful recovery
- Fallback strategies execute correctly
- Metrics are accurately collected

**Integration Tests:**

- Simulate Redis connection failures
- Test fallback to in-memory storage
- Test recovery after Redis comes back
- Test concurrent requests during failure
- Load testing with circuit breaker

**Failure Scenarios:**

1. Redis connection refused
2. Redis connection timeout
3. Redis OOM (Out of Memory)
4. Redis network partition
5. Redis slow responses (> 3s)
6. Intermittent Redis failures

### IDOR Vulnerability Testing

**Attack Scenarios:**

1. User A tries to access User B's horse by ID
2. User A tries to modify User B's horse
3. User A tries to delete User B's groom
4. User A tries to enter User B's horse in competition
5. Batch operations with mixed ownership
6. Parameter manipulation (negative IDs, large IDs)

**Security Tests:**

- Test ownership validation for all resources
- Test error responses don't disclose ownership
- Test batch operations reject unauthorized IDs
- Test nested resource ownership (competition.horse.ownerId)
- Test edge cases (null IDs, invalid IDs)

---

## Risk Assessment

### High Risks

**1. Circuit Breaker False Positives**

- **Risk:** Circuit opens due to transient errors, not systemic failure
- **Mitigation:** Tune thresholds based on error rate, not count
- **Fallback:** Manual circuit reset via admin endpoint

**2. Fallback Inconsistency in Multi-Process**

- **Risk:** In-memory fallback creates inconsistent state across PM2 workers
- **Mitigation:** Document degraded mode behavior, add monitoring
- **Fallback:** Short circuit open duration (30s) minimizes inconsistency window

**3. IDOR Testing Coverage**

- **Risk:** Missing ownership checks on newly added endpoints
- **Mitigation:** Security review process for all new endpoints
- **Fallback:** Periodic security audits (quarterly)

### Medium Risks

**1. Circuit Breaker Performance Overhead**

- **Risk:** Additional layer adds latency to all Redis operations
- **Mitigation:** Benchmark before/after, optimize hot paths
- **Fallback:** Make circuit breaker optional via feature flag

**2. Test Bypass Mechanisms**

- **Risk:** Test environment bypasses remain in production code
- **Mitigation:** Audit all test bypass patterns, remove or gate with NODE_ENV
- **Fallback:** Security tests verify bypasses don't work in production

### Low Risks

**1. Circuit Breaker Library Dependencies**

- **Risk:** opossum dependency introduces security vulnerabilities
- **Mitigation:** Regular dependency updates, Dependabot alerts
- **Fallback:** Switch to cockatiel if opossum becomes unmaintained

---

## Success Metrics

### Phase 2 Completion Criteria

**Circuit Breaker Metrics:**

- ✅ Circuit breaker opens within 5 seconds of Redis failure
- ✅ Circuit breaker recovers within 30 seconds of Redis recovery
- ✅ Fallback strategies maintain 99% uptime during Redis outage
- ✅ < 5% performance overhead from circuit breaker
- ✅ Health monitoring endpoint returns circuit state

**IDOR Fix Metrics:**

- ✅ 0 high-risk endpoints without ownership checks
- ✅ 100% of IDOR attack tests pass
- ✅ API documentation updated for all protected endpoints
- ✅ Security audit shows 90+ production readiness score

**Overall Metrics:**

- ✅ All 4 subtasks complete
- ✅ 24-30 hours actual time spent
- ✅ 100% test pass rate
- ✅ Production deployment ready

---

## Dependencies and Blockers

### Dependencies

**Subtask 2.1 blocks:**

- Subtask 2.2 (rate limiting circuit breaker)
- Subtask 2.3 (caching circuit breaker)

**Phase 1 completion (DONE) blocks:**

- Phase 2 (this phase)

### External Blockers

**None identified** - All work can be completed with existing infrastructure

---

## Timeline

### Optimistic Timeline: 24 hours

| Subtask                    | Hours  | Completion |
| -------------------------- | ------ | ---------- |
| 2.1: Redis Circuit Breaker | 10     | Day 1-2    |
| 2.2: Rate Limiting CB      | 4      | Day 2      |
| 2.3: Caching CB            | 4      | Day 2-3    |
| 2.4: IDOR Fixes            | 6      | Day 3      |
| **Total**                  | **24** | **3 days** |

### Realistic Timeline: 30 hours

| Subtask                    | Hours  | Completion |
| -------------------------- | ------ | ---------- |
| 2.1: Redis Circuit Breaker | 12     | Day 1-2    |
| 2.2: Rate Limiting CB      | 5      | Day 2-3    |
| 2.3: Caching CB            | 5      | Day 3      |
| 2.4: IDOR Fixes            | 8      | Day 4      |
| **Total**                  | **30** | **4 days** |

---

## Next Steps

1. ✅ Create beads subtasks for Phase 2
2. ⏳ Start Subtask 2.1: Redis Circuit Breaker Implementation
3. ⏳ Sequential completion of remaining subtasks
4. ⏳ Security audit after Phase 2 completion
5. ⏳ Production deployment preparation

---

**Document Version:** 1.0
**Last Updated:** 2026-01-27
**Status:** Ready for Implementation
**Approval:** Pending Review
