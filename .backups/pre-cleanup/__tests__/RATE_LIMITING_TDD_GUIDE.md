# Rate Limiting Test-Driven Development Guide

## Overview

This document outlines the TDD approach for implementing rate limiting in the Equoria authentication system. Following TDD red-green-refactor principles, we have created comprehensive **FAILING** tests that define expected behavior before implementation.

---

## Current Status

### Phase: RED (Tests Written, Failing)

**Test Files Created:**
1. ✅ `__tests__/config/test-helpers.mjs` - Test utilities and factories
2. ✅ `__tests__/integration/rate-limiting.test.mjs` - Integration tests (22 tests)
3. ✅ `__tests__/unit/auth-rate-limiter.test.mjs` - Unit tests (20+ tests)
4. ✅ `__tests__/integration/auth-cookies.test.mjs` - Fixed (added firstName/lastName)

**Issues Fixed:**
- ✅ Missing firstName/lastName in user creation (auth-cookies.test.mjs)
- ✅ Rate limiting infrastructure tests created
- ✅ Test helpers for data factories and cleanup

**Expected Test Status:**
- All rate limiting tests should FAIL (by design - TDD red phase)
- Auth cookie tests should now pass (fixed missing fields)

---

## Test Coverage Map

### 1. Integration Tests (rate-limiting.test.mjs)

#### Login Rate Limiting (6 tests)
- ✅ `should_allow_up_to_5_failed_login_attempts`
- ✅ `should_block_6th_failed_login_attempt_with_429`
- ✅ `should_reset_rate_limit_after_successful_authentication`
- ✅ `should_include_retry_after_in_rate_limit_response`
- ✅ `should_track_rate_limits_per_ip_address`

#### Registration Rate Limiting (2 tests)
- ✅ `should_rate_limit_registration_attempts`
- ✅ `should_include_rate_limit_headers_on_registration`

#### Token Refresh Rate Limiting (1 test)
- ✅ `should_rate_limit_token_refresh_attempts`

#### Rate Limit Headers (3 tests)
- ✅ `should_include_standard_rate_limit_headers`
- ✅ `should_update_ratelimit_remaining_with_each_request`
- ✅ `should_provide_accurate_reset_timestamp`

#### Rate Limit Reset (1 test)
- ✅ `should_reset_rate_limit_after_time_window`

#### Concurrent Requests (1 test)
- ✅ `should_handle_concurrent_requests_correctly`

#### Edge Cases (3 tests)
- ✅ `should_handle_missing_ip_address_gracefully`
- ✅ `should_handle_malformed_requests_with_rate_limiting`
- ✅ `should_not_leak_user_existence_through_rate_limiting`

#### Test Environment (1 test)
- ✅ `should_respect_test_environment_rate_limit_config`

**Total Integration Tests: 22**

---

### 2. Unit Tests (auth-rate-limiter.test.mjs)

#### Rate Limiter Configuration (3 tests)
- ✅ `should_create_rate_limiter_with_default_config`
- ✅ `should_create_rate_limiter_with_custom_config`
- ✅ `should_validate_configuration_parameters`

#### Request Tracking (3 tests)
- ✅ `should_track_requests_by_ip_address`
- ✅ `should_allow_requests_within_limit`
- ✅ `should_block_requests_exceeding_limit`

#### Rate Limit Headers (3 tests)
- ✅ `should_set_ratelimit_headers_on_every_request`
- ✅ `should_update_remaining_count_with_each_request`
- ✅ `should_calculate_accurate_reset_timestamp`

#### Time Window Reset (2 tests)
- ✅ `should_reset_count_after_time_window`
- ✅ `should_maintain_separate_windows_for_different_ips`

#### Success Reset Mechanism (2 tests)
- ✅ `should_reset_count_on_successful_authentication`
- ✅ `should_provide_method_to_reset_specific_ip`

#### Error Handling (3 tests)
- ✅ `should_handle_missing_ip_address`
- ✅ `should_handle_concurrent_requests_atomically`
- ✅ `should_not_crash_on_invalid_configuration`

#### Memory Management (3 tests)
- ✅ `should_clean_up_expired_entries`
- ✅ `should_have_configurable_cleanup_interval`
- ✅ `should_limit_maximum_storage_size`

#### Express Integration (3 tests)
- ✅ `should_work_as_express_middleware`
- ✅ `should_call_next_when_within_limit`
- ✅ `should_not_call_next_when_rate_limited`

#### Response Format (2 tests)
- ✅ `should_send_consistent_429_response_format`
- ✅ `should_include_retry_after_in_seconds`

**Total Unit Tests: 24**

---

## Expected Implementation Structure

### File Structure to Create

```
backend/
├── middleware/
│   ├── authRateLimiter.mjs          # NEW - Rate limiter middleware
│   └── security.mjs                  # EXISTING - Update authLimiter
├── utils/
│   └── rateLimitStore.mjs            # NEW - In-memory store
├── config/
│   └── rateLimitConfig.mjs           # NEW - Configuration
└── __tests__/
    ├── integration/
    │   └── rate-limiting.test.mjs    # ✅ CREATED
    ├── unit/
    │   └── auth-rate-limiter.test.mjs # ✅ CREATED
    └── config/
        └── test-helpers.mjs           # ✅ CREATED
```

---

## Implementation Requirements

### 1. Rate Limiter Configuration (config/rateLimitConfig.mjs)

```javascript
export const RATE_LIMIT_CONFIG = {
  // Production limits
  production: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 attempts
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Test environment (lenient)
  test: {
    windowMs: 1000,             // 1 second (fast tests)
    max: 10000,                 // Very high limit
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Development (moderate)
  development: {
    windowMs: 5 * 60 * 1000,   // 5 minutes
    max: 20,                    // 20 attempts
    standardHeaders: true,
    legacyHeaders: false,
  },
};
```

### 2. Rate Limit Store (utils/rateLimitStore.mjs)

**Required Methods:**
- `increment(ip)` - Increment request count for IP
- `getCount(ip)` - Get current count for IP
- `reset(ip)` - Reset count for IP (on successful auth)
- `cleanup()` - Remove expired entries
- `getSize()` - Get number of tracked IPs

**Data Structure:**
```javascript
{
  '192.168.1.1': {
    count: 3,
    resetAt: 1704123456789,  // Timestamp
  },
  '192.168.1.2': {
    count: 1,
    resetAt: 1704123456789,
  },
}
```

### 3. Auth Rate Limiter Middleware (middleware/authRateLimiter.mjs)

**Required Exports:**
- `createAuthRateLimiter(config)` - Factory function
- `resetAuthRateLimiter()` - Global reset (for tests)
- `authRateLimiter` - Default instance

**Middleware Behavior:**
1. Extract IP from `req.ip` or `req.headers['x-forwarded-for']`
2. Check current count for IP
3. If within limit:
   - Increment count
   - Set rate limit headers
   - Call `next()`
4. If exceeded:
   - Set rate limit headers
   - Return 429 with retry-after
   - Do NOT call `next()`

**Rate Limit Headers:**
- `RateLimit-Limit` - Max requests allowed
- `RateLimit-Remaining` - Requests remaining
- `RateLimit-Reset` - Unix timestamp when limit resets

### 4. Update Existing Security Middleware (middleware/security.mjs)

**Replace authLimiter:**
```javascript
// OLD (express-rate-limit)
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5);

// NEW (custom rate limiter with reset on success)
import { authRateLimiter } from './authRateLimiter.mjs';
export { authRateLimiter };
```

### 5. Auth Controller Integration (controllers/authController.mjs)

**Add to login() function:**
```javascript
// After successful authentication
import { resetAuthRateLimiter } from '../middleware/authRateLimiter.mjs';

export const login = async (req, res) => {
  // ... existing login logic

  // On successful authentication
  if (user && validPassword) {
    // Reset rate limit for this IP
    resetAuthRateLimiter(req.ip);

    // ... return tokens
  }
};
```

---

## Verification Commands

### 1. Run Rate Limiting Tests (Should Fail Initially)

```bash
# Integration tests
npm test -- --testPathPattern=rate-limiting

# Unit tests
npm test -- --testPathPattern=auth-rate-limiter

# All rate limiting tests
npm test -- --testPathPattern="rate-limit"
```

**Expected Output (RED Phase):**
```
FAIL  __tests__/integration/rate-limiting.test.mjs
  ● Rate Limiting System › Login Rate Limiting › should_allow_up_to_5_failed_login_attempts
    expect(received).toBe(expected)
    Expected: 401
    Received: 429  // Too many requests (generic rate limiter)

Tests:       22 failed, 0 passed, 22 total
```

### 2. Run Fixed Auth Cookie Tests (Should Pass)

```bash
npm test -- --testPathPattern=auth-cookies
```

**Expected Output:**
```
PASS  __tests__/integration/auth-cookies.test.mjs
  ✓ should set httpOnly cookies on successful registration
  ✓ should NOT expose tokens in response body
  ...

Tests:       15 passed, 15 total
```

### 3. Run All Tests

```bash
npm test
```

---

## TDD Implementation Workflow

### RED Phase (Current) ✅
1. ✅ Write comprehensive failing tests
2. ✅ Document expected behavior
3. ✅ Fix existing test issues (firstName/lastName)
4. ✅ Verify all rate limiting tests fail

### GREEN Phase (Next Steps)

**Step 1: Create Rate Limit Store (30 min)**
```bash
# Create utils/rateLimitStore.mjs
# Run: npm test -- --testPathPattern=auth-rate-limiter
# Goal: Pass store-related unit tests
```

**Step 2: Create Auth Rate Limiter Middleware (45 min)**
```bash
# Create middleware/authRateLimiter.mjs
# Run: npm test -- --testPathPattern=auth-rate-limiter
# Goal: Pass all unit tests
```

**Step 3: Integrate with Auth Routes (15 min)**
```bash
# Update routes/authRoutes.mjs
# Update controllers/authController.mjs
# Run: npm test -- --testPathPattern=rate-limiting
# Goal: Pass integration tests
```

**Step 4: Add Configuration (15 min)**
```bash
# Create config/rateLimitConfig.mjs
# Update .env.example
# Run: npm test
# Goal: All tests pass
```

### REFACTOR Phase (Final)

**Step 5: Code Quality (30 min)**
- Extract common patterns
- Add JSDoc comments
- Optimize memory usage
- Add logging

**Step 6: Performance Testing (30 min)**
- Benchmark rate limiter overhead
- Test with 1000+ concurrent requests
- Optimize hotspots

**Step 7: Documentation (15 min)**
- Update API documentation
- Add usage examples
- Document configuration

---

## Test Isolation Strategy

### Problem: Rate Limits Affecting Multiple Tests

**Issue:**
```javascript
// Test 1 exhausts rate limit
for (let i = 0; i < 5; i++) {
  await request(app).post('/api/auth/login').send({ ... });
}

// Test 2 is blocked immediately
await request(app).post('/api/auth/login').send({ ... });
// ❌ FAIL: 429 Too Many Requests
```

**Solutions:**

1. **Test Environment Configuration**
```javascript
// Set very high limits for test env
if (process.env.NODE_ENV === 'test') {
  config.max = 10000;  // Effectively unlimited
}
```

2. **Reset Between Tests**
```javascript
afterEach(async () => {
  await resetRateLimitStore();
});
```

3. **Unique IPs Per Test**
```javascript
const testIp = `192.168.1.${testIndex}`;
await request(app)
  .post('/api/auth/login')
  .set('X-Forwarded-For', testIp)
  .send({ ... });
```

4. **Short Time Windows**
```javascript
// For tests only
const TEST_WINDOW_MS = 1000;  // 1 second
```

---

## Security Considerations

### 1. User Enumeration Prevention

❌ **Bad:**
```javascript
// Reveals if user exists
if (!user) {
  return res.status(401).json({ message: 'User not found' });
}
if (!validPassword) {
  return res.status(401).json({ message: 'Invalid password' });
}
```

✅ **Good:**
```javascript
// Generic message, same timing
if (!user || !validPassword) {
  return res.status(401).json({ message: 'Invalid credentials' });
}
```

### 2. IP Address Validation

✅ **Considerations:**
- Trust proxy headers only if behind trusted proxy
- Validate IP format to prevent injection
- Use leftmost IP in X-Forwarded-For (client IP)

```javascript
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();  // Leftmost = client
  }
  return req.ip || req.connection.remoteAddress || '0.0.0.0';
};
```

### 3. Memory DoS Prevention

✅ **Limits:**
```javascript
const MAX_TRACKED_IPS = 10000;  // Prevent unbounded growth

if (store.size >= MAX_TRACKED_IPS) {
  // Evict oldest entries
  store.evictOldest(1000);  // Remove 1000 oldest
}
```

---

## Performance Targets

### Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Middleware overhead | < 1ms | Time added per request |
| Memory per IP | < 100 bytes | 10,000 IPs = ~1 MB |
| Cleanup time | < 10ms | Expired entry removal |
| Concurrent requests | 1000+ req/s | No race conditions |

---

## Monitoring & Observability

### Logging

```javascript
// On rate limit trigger
logger.warn('[Rate Limit] IP blocked', {
  ip: req.ip,
  endpoint: req.path,
  count: currentCount,
  resetAt: resetTimestamp,
});

// On rate limit reset
logger.info('[Rate Limit] Reset for successful auth', {
  ip: req.ip,
  previousCount: count,
});
```

### Metrics to Track

1. **Rate limit hits per IP** - Identify attackers
2. **Average requests per IP** - Normal behavior baseline
3. **Reset frequency** - Successful auth rate
4. **Memory usage** - Store size over time

---

## Next Steps

### Immediate (GREEN Phase)
1. [ ] Create `utils/rateLimitStore.mjs`
2. [ ] Create `middleware/authRateLimiter.mjs`
3. [ ] Update `routes/authRoutes.mjs`
4. [ ] Update `controllers/authController.mjs`
5. [ ] Run tests and achieve GREEN

### Follow-up (REFACTOR Phase)
1. [ ] Add Redis backend for distributed systems
2. [ ] Implement sliding window algorithm
3. [ ] Add rate limit dashboard
4. [ ] Performance benchmarking

### Future Enhancements
1. [ ] User-based rate limiting (in addition to IP)
2. [ ] Adaptive rate limiting (dynamic limits)
3. [ ] Captcha integration after X failures
4. [ ] Notification system for repeated blocks

---

## Troubleshooting

### Tests Still Passing When They Should Fail?

**Possible Causes:**
1. Test environment has very high limits (intended)
2. Rate limiter not applied to test routes
3. Test isolation not working

**Debug:**
```bash
# Check rate limiter is applied
npm test -- --testPathPattern=rate-limiting --verbose

# Check environment
echo $NODE_ENV  # Should be 'test'
```

### Tests Failing Intermittently?

**Possible Causes:**
1. Time window issues (race conditions)
2. Shared state between tests
3. Concurrent test execution

**Fix:**
```javascript
// Add longer timeouts
jest.setTimeout(10000);

// Run tests sequentially
npm test -- --testPathPattern=rate-limiting --runInBand
```

---

## References

- [RFC 6585 - HTTP Status Code 429](https://tools.ietf.org/html/rfc6585)
- [OWASP: Blocking Brute Force Attacks](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling)
- [Express Rate Limit Documentation](https://express-rate-limit.mintlify.app/)

---

**Last Updated:** 2025-01-14
**Status:** RED Phase Complete ✅
**Next:** GREEN Phase - Implementation
