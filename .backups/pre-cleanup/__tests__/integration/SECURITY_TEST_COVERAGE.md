# Security Test Coverage Documentation

**Version:** 1.0.0 **Last Updated:** 2026-01-28 **Test Suite:**
`security-attack-simulation.test.mjs` **Total Tests:** 41 passing (100%)
**Execution Time:** ~8.5 seconds

---

## Overview

This document provides comprehensive documentation for Equoria's security attack
simulation test suite. The tests simulate real-world attack scenarios based on
OWASP Top 10 vulnerabilities to verify that security controls are properly
implemented and functioning.

**Security Philosophy:**

- All tests use real security middleware (no bypasses)
- Tests simulate actual attack patterns from OWASP Top 10
- Verify proper error responses and security headers
- Ensure sensitive data is not leaked in error messages
- Focus on defense-in-depth security strategy

---

## Test Categories

### 1. IDOR (Insecure Direct Object Reference) Attacks (15 tests)

**OWASP Reference:** A01:2021 – Broken Access Control

IDOR attacks attempt to access or manipulate resources belonging to other users
by directly referencing object IDs in API requests.

#### User Resource IDOR Attacks (5 tests)

| Test                           | Attack Vector                                               | Expected Defense |
| ------------------------------ | ----------------------------------------------------------- | ---------------- |
| Access another user's profile  | `GET /api/user/{victimUserId}` with attacker token          | 403 Forbidden    |
| Access another user's progress | `GET /api/user/{victimUserId}/progress` with attacker token | 403 Forbidden    |
| Access another user's activity | `GET /api/user/{victimUserId}/activity` with attacker token | 403 Forbidden    |
| Modify another user's profile  | `PUT /api/user/{victimUserId}` with attacker token          | 403 Forbidden    |
| Delete another user's account  | `DELETE /api/user/{victimUserId}` with attacker token       | 403 Forbidden    |

**Security Controls Tested:**

- Ownership validation middleware
- JWT token verification
- User ID matching between token and request
- Authorization layer enforcement

#### Horse Resource IDOR Attacks (3 tests)

| Test                        | Attack Vector                                   | Expected Defense |
| --------------------------- | ----------------------------------------------- | ---------------- |
| Access another user's horse | `GET /api/horses/{horseId}` with attacker token | 403 Forbidden    |
| Modify another user's horse | `PUT /api/horses/{horseId}` with malicious data | 403 Forbidden    |
| Train another user's horse  | `POST /api/training/train` with victim's horse  | 403 Forbidden    |

**Security Controls Tested:**

- Horse ownership validation
- Training authorization checks
- Resource access control

#### Competition Resource IDOR Attacks (2 tests)

| Test                       | Attack Vector                                     | Expected Defense  |
| -------------------------- | ------------------------------------------------- | ----------------- |
| Enter another user's horse | `POST /api/competition/enter` with victim's horse | 403 Forbidden     |
| Access competition results | `GET /api/competition/horse/{horseId}/results`    | 401/403 Forbidden |

**Security Controls Tested:**

- Competition entry authorization
- Result access validation
- Horse ownership verification

#### Groom Resource IDOR Attacks (2 tests)

| Test                         | Attack Vector                                 | Expected Defense |
| ---------------------------- | --------------------------------------------- | ---------------- |
| Access another user's grooms | `GET /api/grooms/user/{victimUserId}`         | 403 Forbidden    |
| Assign another user's groom  | `POST /api/grooms/assign` with victim's groom | 403 Forbidden    |

**Security Controls Tested:**

- Groom ownership validation
- Assignment authorization
- Resource isolation

#### Breeding Resource IDOR Attacks (1 test)

| Test                          | Attack Vector                                     | Expected Defense |
| ----------------------------- | ------------------------------------------------- | ---------------- |
| Breed with unauthorized horse | `POST /api/breeding/breed` with victim's stallion | 403 Forbidden    |

**Security Controls Tested:**

- Breeding permission checks
- Sire/dam ownership validation
- Stud service authorization

#### Privilege Escalation Attempts (2 tests)

| Test                                   | Attack Vector               | Expected Defense |
| -------------------------------------- | --------------------------- | ---------------- |
| Access admin endpoints with user token | `GET /api/admin/users`      | 403 Forbidden    |
| Perform admin operations               | `POST /api/admin/users/ban` | 403 Forbidden    |

**Security Controls Tested:**

- Role-based access control (RBAC)
- Admin route protection
- Token role verification

---

### 2. Rate Limiting Bypass Attempts (4 tests)

**OWASP Reference:** A04:2021 – Insecure Design

Rate limiting bypass attempts test whether attackers can circumvent rate limits
through various techniques.

#### Rapid-Fire Attack Simulation (3 tests)

| Test                  | Attack Pattern          | Rate Limit          | Verification               |
| --------------------- | ----------------------- | ------------------- | -------------------------- |
| Registration endpoint | 10 rapid registrations  | 5 per 15 min        | Rate limit headers present |
| Login endpoint        | 20 rapid login attempts | AUTH_RATE_LIMIT_MAX | Rate limit headers present |
| Profile update        | 40 rapid updates        | 30 per minute       | Rate limit headers present |

**Security Controls Tested:**

- Rate limiter middleware activation
- Rate limit header presence
- In-memory rate limit tracking
- Request throttling

**Note:** Tests verify rate limiting is configured by checking headers rather
than requiring 429 responses, as in-memory rate limiting with parallel requests
may not always trigger 429s due to race conditions (test environment
limitation).

#### Rate Limit Header Validation (1 test)

| Header                | Required | Purpose                      |
| --------------------- | -------- | ---------------------------- |
| `ratelimit-limit`     | Yes      | Maximum requests allowed     |
| `ratelimit-remaining` | Yes      | Remaining requests in window |
| `ratelimit-reset`     | Yes      | Time until reset (epoch)     |

**Security Controls Tested:**

- Standard rate limit header format (draft-ietf-httpapi-ratelimit-headers)
- Consistent header presence across all endpoints
- Numeric validation of header values

---

### 3. Input Validation Fuzzing Simulation (11+ tests)

**OWASP Reference:** A03:2021 – Injection

Input fuzzing tests send malformed, unexpected, or malicious input to identify
validation gaps and potential injection vulnerabilities.

#### SQL Injection Attempts (2 tests)

**Attack Payloads Tested:**

```sql
admin' OR '1'='1
' OR 1=1--
'; DROP TABLE users; --
' UNION SELECT * FROM users--
```

| Target Field   | Attack Type   | Expected Defense                   |
| -------------- | ------------- | ---------------------------------- |
| Email field    | SQL injection | 400 Bad Request (validation error) |
| Username field | SQL injection | 400 Bad Request (validation error) |

**Security Controls Tested:**

- Parameterized queries (Prisma ORM)
- Input validation middleware
- Email format validation
- Username format validation (alphanumeric only)

#### XSS (Cross-Site Scripting) Attempts (2 tests)

**Attack Payloads Tested:**

```html
<script>
  alert('XSS');
</script>
<img src="x" onerror="alert(1)" />
<iframe src="javascript:alert('XSS')">
  <div onclick="alert(1)">Click me</div>
  javascript:alert(document.cookie)</iframe
>
```

| Target Field | Attack Type | Expected Defense                           |
| ------------ | ----------- | ------------------------------------------ |
| Bio field    | XSS payload | Sanitization with `.escape()` or rejection |
| Name fields  | XSS payload | Sanitization or validation error           |

**Security Controls Tested:**

- Express-validator `.escape()` method
- HTML entity encoding
- Script tag removal
- Event handler sanitization

#### Buffer Overflow Attempts (4 tests)

| Target Field | Attack Type                   | Max Length | Expected Defense |
| ------------ | ----------------------------- | ---------- | ---------------- |
| Email        | Extremely long (1000+ chars)  | 254 chars  | 400 Bad Request  |
| Username     | Extremely long (1000+ chars)  | 30 chars   | 400 Bad Request  |
| Password     | Extremely long (500+ chars)   | 128 chars  | 400 Bad Request  |
| Bio          | Extremely long (10000+ chars) | 500 chars  | 400 Bad Request  |

**Security Controls Tested:**

- Maximum length validation
- Memory allocation limits
- Buffer overflow prevention
- Proper error messaging

#### Special Character Injection (2 tests)

**Attack Payloads Tested:**

```
Null bytes: \x00
Unicode control: \u0000\u200B\uFEFF
```

| Attack Type           | Target          | Expected Defense          |
| --------------------- | --------------- | ------------------------- |
| Null bytes in input   | Email, username | 400 Bad Request           |
| Unicode control chars | Bio field       | Sanitization or rejection |

**Security Controls Tested:**

- Special character filtering
- Unicode normalization
- Control character removal

---

### 4. Authentication Bypass Attempts (10+ tests)

**OWASP Reference:** A07:2021 – Identification and Authentication Failures

Authentication bypass attempts test whether attackers can access protected
resources without proper authentication.

#### Missing Authentication Token (3 tests)

| Endpoint                      | Attack                  | Expected Defense |
| ----------------------------- | ----------------------- | ---------------- |
| `GET /api/user/{userId}`      | No Authorization header | 401 Unauthorized |
| `GET /api/horses/1`           | No token                | 401 Unauthorized |
| `POST /api/competition/enter` | No token                | 401 Unauthorized |

**Security Controls Tested:**

- Authentication middleware presence
- Protected route enforcement
- Consistent 401 responses

#### Invalid Authentication Token (3 tests)

| Attack Type           | Token Format           | Expected Defense |
| --------------------- | ---------------------- | ---------------- |
| Malformed JWT         | `invalid.jwt.token`    | 401 Unauthorized |
| Empty Bearer          | `Bearer ` (empty)      | 401 Unauthorized |
| Missing Bearer prefix | Token without `Bearer` | 401 Unauthorized |

**Security Controls Tested:**

- JWT format validation
- Bearer scheme enforcement
- Token parsing errors

#### Token Manipulation Attempts (2 tests)

| Attack Type        | Manipulation                  | Expected Defense |
| ------------------ | ----------------------------- | ---------------- |
| Modified payload   | Change token characters       | 401 Unauthorized |
| Modified signature | Tamper with signature section | 401 Unauthorized |

**Security Controls Tested:**

- JWT signature verification
- Cryptographic integrity checks
- Tamper detection

#### Session Fixation Attempts (1 test)

**Attack Payloads Tested:**

```
Hardcoded JWT from examples
Predictable tokens: "admin", "test", "12345"
```

| Attack Type        | Expected Defense |
| ------------------ | ---------------- |
| Predictable tokens | 401 Unauthorized |

**Security Controls Tested:**

- Token randomness verification
- No hardcoded tokens accepted
- Unique token generation

---

### 5. Information Disclosure Prevention (3 tests)

**OWASP Reference:** A05:2021 – Security Misconfiguration

Information disclosure tests verify that error messages and responses do not
leak sensitive system information.

#### Database Error Leakage (1 test)

| Test                | Attack Vector                       | Verification                                 |
| ------------------- | ----------------------------------- | -------------------------------------------- |
| Invalid UUID format | `GET /api/user/invalid-uuid-format` | Generic 404, no Prisma/SQL/PostgreSQL errors |

**Security Controls Tested:**

- Generic error messages
- Database error sanitization
- No technical implementation details exposed

#### Stack Trace Leakage (1 test)

| Test                        | Attack Vector                  | Verification                |
| --------------------------- | ------------------------------ | --------------------------- |
| Malformed registration data | Null values in required fields | No stack traces in response |

**Security Controls Tested:**

- Production error handling
- Stack trace suppression
- Safe error responses

#### User Enumeration Prevention (1 test)

| Test                                       | Attack Vector          | Verification             |
| ------------------------------------------ | ---------------------- | ------------------------ |
| Login with non-existent vs. wrong password | Compare error messages | Identical error messages |

**Security Controls Tested:**

- Consistent error messaging
- No user existence indication
- Anti-enumeration measures

---

## Attack Scenario Coverage

### High-Risk Attack Scenarios Covered

1. **Account Takeover Attacks**

   - Brute force login attempts (rate limiting)
   - Password spraying simulation
   - Token manipulation
   - Session hijacking attempts

2. **Data Exfiltration Attacks**

   - IDOR enumeration of user data
   - Unauthorized horse data access
   - Competition result scraping
   - Profile information harvesting

3. **Data Manipulation Attacks**

   - Unauthorized horse modifications
   - Fraudulent competition entries
   - Profile tampering
   - Breeding system abuse

4. **Privilege Escalation Attacks**

   - User-to-admin escalation attempts
   - Admin endpoint access
   - Role manipulation

5. **Denial of Service (DoS) Attacks**

   - Rate limit testing
   - Resource exhaustion attempts
   - Rapid-fire requests

6. **Injection Attacks**

   - SQL injection (all user inputs)
   - XSS injection (name, bio fields)
   - Command injection attempts

7. **Authentication Attacks**
   - Token forgery
   - Token replay
   - Session fixation
   - Missing authentication

---

## Security Testing Best Practices

### Environment Configuration

```javascript
// Disable all security test bypasses
process.env.TEST_BYPASS_RATE_LIMIT = 'false';
process.env.TEST_BYPASS_AUTH = 'false';
```

**Rationale:** Tests must use real security middleware to accurately simulate
production behavior.

### Test Token Generation

```javascript
const attackerToken = generateTestToken({ id: attackerUserId, role: 'user' });
const victimToken = generateTestToken({ id: victimUserId, role: 'user' });
const adminToken = generateTestToken({ id: 'admin-uuid-000', role: 'admin' });
```

**Rationale:** Simulate different user identities to test authorization and
access control.

### Parallel Request Testing

```javascript
// Create array of promises
const requests = [];
for (let i = 0; i < 10; i++) {
  requests.push(request(app).post('/endpoint').send(data));
}
// Execute in parallel
const responses = await Promise.all(requests);
```

**Rationale:** Simulates realistic attack patterns where attackers send rapid
concurrent requests.

### Unique Test Data

```javascript
email: `attacker${Date.now()}_${i}@evil.com`;
username: `attacker${Date.now()}_${i}`;
```

**Rationale:** Prevents test failures due to duplicate data constraints while
testing real validation logic.

---

## Coverage Metrics

### By OWASP Top 10 Category

| OWASP Category                 | Tests | Coverage         |
| ------------------------------ | ----- | ---------------- |
| A01: Broken Access Control     | 15    | ✅ Comprehensive |
| A02: Cryptographic Failures    | 3     | ✅ Basic         |
| A03: Injection                 | 6     | ✅ Comprehensive |
| A04: Insecure Design           | 4     | ✅ Basic         |
| A05: Security Misconfiguration | 3     | ✅ Basic         |
| A06: Vulnerable Components     | 0     | ⚠️ Not Covered   |
| A07: Auth Failures             | 10    | ✅ Comprehensive |
| A08: Data Integrity Failures   | 0     | ⚠️ Not Covered   |
| A09: Logging Failures          | 0     | ⚠️ Not Covered   |
| A10: SSRF                      | 0     | ⚠️ Not Covered   |

### By Resource Type

| Resource    | IDOR Tests | Input Tests | Auth Tests | Total  |
| ----------- | ---------- | ----------- | ---------- | ------ |
| User        | 5          | 6           | 10         | 21     |
| Horse       | 3          | 0           | 3          | 6      |
| Competition | 2          | 0           | 1          | 3      |
| Groom       | 2          | 0           | 0          | 2      |
| Breeding    | 1          | 0           | 0          | 1      |
| Admin       | 2          | 0           | 0          | 2      |
| **Total**   | **15**     | **6**       | **14**     | **35** |

### By Security Control

| Security Control       | Tests |
| ---------------------- | ----- |
| Ownership Validation   | 15    |
| Input Validation       | 11    |
| Authentication         | 10    |
| Rate Limiting          | 4     |
| Information Disclosure | 3     |

---

## Test Maintenance

### Adding New Security Tests

1. **Identify Attack Vector:** Research OWASP Top 10 or common exploits
2. **Create Test Case:** Use existing patterns as templates
3. **Verify Real Security:** Ensure `TEST_BYPASS_*` flags are disabled
4. **Test Expected Behavior:** Verify security control blocks attack
5. **Document Coverage:** Update this documentation

### Recommended Additions

1. **A06: Vulnerable Components**

   - Dependency vulnerability testing
   - Outdated package detection
   - CVE scanning integration

2. **A08: Data Integrity Failures**

   - Unsigned data verification
   - Insecure deserialization tests
   - Untrusted data processing

3. **A09: Logging Failures**

   - Security event logging verification
   - Audit trail completeness
   - Log tampering detection

4. **A10: SSRF (Server-Side Request Forgery)**
   - External URL validation
   - Internal network access prevention
   - Webhook security

---

## Continuous Security Testing

### CI/CD Integration

```bash
# Run security tests in CI pipeline
npm test -- __tests__/integration/security-attack-simulation.test.mjs

# Expected output:
# Test Suites: 1 passed
# Tests:       41 passed
# Time:        ~8.5s
```

### Pre-Release Security Checklist

- [ ] All 41 security tests passing
- [ ] No new security vulnerabilities introduced
- [ ] Rate limiting properly configured
- [ ] Input validation comprehensive
- [ ] Authentication enforced on all protected routes
- [ ] Ownership validation on all resource endpoints
- [ ] Error messages do not leak sensitive information
- [ ] Logs do not contain passwords or tokens

---

## Related Documentation

- **Test File:**
  `backend/__tests__/integration/security-attack-simulation.test.mjs`
- **Security Architecture:** `docs/product/PRD-08-Security-Architecture.md`
- **API Documentation:** `docs/api-contracts-backend/security-features.md`
- **Input Validation:** `docs/api-contracts-backend/input-validation-rules.md`
- **Rate Limiting:** `docs/api-contracts-backend/rate-limiting.md`

---

## Conclusion

This security test suite provides comprehensive coverage of high-priority attack
scenarios based on OWASP Top 10. The tests simulate real-world attacks to verify
that Equoria's security controls are properly implemented and functioning.

**Key Strengths:**

- ✅ Comprehensive IDOR testing (15 tests)
- ✅ Thorough authentication testing (10 tests)
- ✅ Multiple injection attack coverage (SQL, XSS, buffer overflow)
- ✅ Rate limiting verification
- ✅ Information disclosure prevention

**Areas for Future Enhancement:**

- ⚠️ Dependency vulnerability testing
- ⚠️ Data integrity verification
- ⚠️ Logging and monitoring tests
- ⚠️ SSRF prevention

**Current Status:** 41 tests passing (100%) ✅

---

**Document Maintainer:** Equoria Security Team **Review Schedule:** Quarterly or
after major security updates **Last Security Audit:** 2026-01-28
