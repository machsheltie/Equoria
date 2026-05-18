# 🔒 **EQUORIA SECURITY DOCUMENTATION**

## **Overview**

This document outlines the comprehensive security measures implemented in Equoria to prevent common exploits and vulnerabilities that have plagued horse simulation games like Horseland, Ludus Equinus, and Equus Ipsum.

---

## 🚨 **Critical Security Measures**

### **1. Authentication & Authorization**

#### **JWT Token Security**

- **Token Verification**: All tokens verified with cryptographic signatures
- **Token Fingerprinting**: Anti-tampering measures with user fingerprints
- **Expiration Enforcement**: Multiple layers of expiration checking
- **Role-Based Access**: Strict role validation for all operations
- **Resource Ownership**: Users can only access/modify their own resources

#### **Password Security**

- **Bcrypt Hashing**: Minimum 12 rounds for production
- **Password Requirements**: Minimum 8 characters with complexity rules
- **Secure Verification**: Constant-time comparison to prevent timing attacks

### **2. Game Integrity Protection**

#### **Stat Manipulation Prevention**

```javascript
// Protected stats that cannot be directly modified
const protectedStats = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'personality',
  'total_earnings',
  'level',
];
```

#### **Resource Duplication Prevention**

- **Operation Tracking**: Prevents duplicate operations within 5 seconds
- **Request Fingerprinting**: Unique operation signatures
- **Memory-based Deduplication**: In-memory tracking of recent operations

#### **Training System Security**

- **Ownership Validation**: Only horse owners can train their horses
- **Age Requirements**: Horses must be 3+ years old
- **Health Checks**: Injured horses cannot train
- **Cooldown Enforcement**: Global 7-day cooldown prevents stat stacking
- **Discipline Validation**: Only valid disciplines accepted

#### **Breeding System Security**

- **Biological Validation**: Proper sex and age requirements
- **Ownership Verification**: Access control for sires and dams
- **Cooldown Management**: 30-day breeding cooldowns
- **Health Requirements**: Injured horses cannot breed
- **Self-Breeding Prevention**: Horses cannot breed with themselves

#### **Financial Transaction Security**

- **Balance Verification**: Real-time balance checking
- **Transaction Limits**: Maximum transaction amounts enforced
- **Transfer Validation**: Prevents self-transfers and invalid targets
- **Audit Logging**: All financial operations logged

### **3. Input Validation & Sanitization**

#### **Comprehensive Data Validation**

- **Horse Data**: Name, age, sex, stats, financial data validation
- **user Data**: Name, email, money, level, XP validation
- **Breeding Data**: Sire/dam validation, fee limits
- **Training Data**: Horse ID, discipline, ownership validation
- **Transaction Data**: Amount, type, description validation

#### **XSS Prevention**

```javascript
// Input sanitization removes dangerous content
sanitized = input
  .replace(/[<>]/g, '') // Remove HTML tags
  .replace(/javascript:/gi, '') // Remove javascript: protocols
  .replace(/on\w+\s*=/gi, '') // Remove event handlers
  .replace(/data:/gi, ''); // Remove data: protocols
```

#### **SQL Injection Prevention**

- **Prisma ORM**: Parameterized queries prevent SQL injection
- **Input Validation**: All inputs validated before database operations
- **Type Checking**: Strict type validation for all parameters

#### **Prototype Pollution Prevention (CWE-1321)**

JavaScript objects expose `__proto__`, `constructor`, and `prototype` slots that — when set as own properties on parsed user input — can mutate `Object.prototype` indirectly via downstream `Object.assign`, spread, or merge operations. The classic exploit grants `isAdmin: true` to every object in the runtime by polluting the shared prototype.

Equoria's defense lives at the request-parsing boundary in `backend/middleware/requestBodySecurity.mjs` and is mounted in `backend/app.mjs` BEFORE any route handler runs:

- **`verifyJsonBody`** — runs as the `verify` hook on `express.json()`. Walks the raw JSON bytes BEFORE `express.json()` produces a JS object, rejecting payloads with duplicate keys (21R-SEC-1) or excessive nesting (21R-SEC-3, depth cap 32). Fails closed: any unexpected scanner error becomes a 400, never a 200 (21R-SEC-3-FOLLOW-1).
- **`rejectPollutedRequestBody`** — runs after `express.json()`. Walks the parsed body iteratively (DFS with explicit depth cap, not recursion — guards against stack-overflow DoS), rejecting any own property named `__proto__`, `constructor`, or the path `constructor.prototype` at any nesting depth. Inspects own properties via `Object.entries` so JSON-attached `__proto__` keys are caught (JSON.parse stores them as own data properties, not prototype changes).
- **`rejectPollutedRequestQuery`** (21R-SEC-4, Equoria-iq84) — runs after Express's qs parser populates `req.query`. Two-stage scan: Stage 1 walks the raw URL querystring (catches `__proto__[isAdmin]=1` even when qs has stripped it from the parsed object — defence-in-depth on qs's silent hygiene); Stage 2 walks `req.query` via the same `assertNoPollutingKeys` walker as the body guard (catches `constructor[prototype][isAdmin]=1` chains qs leaves intact). Path params (`req.params`), headers, and cookies are out of scope: each is a flat string-to-string surface populated by the framework, with no nested object structure where prototype-slot keys could appear.
- **`verifyUrlEncodedBody`** (21R-SEC-5, Equoria-lf3z) — sibling of `verifyJsonBody` for `application/x-www-form-urlencoded` bodies. Walks raw bytes, rejects duplicate keys after percent-decoding (`name=Valid&name=Hacked` cannot bypass via Content-Type swap).
- **`requestBodySecurityErrorHandler`** — error-class dispatch handler (21R-SEC-6, Equoria-tpbu). Handles `RequestBodySecurityError` instances (sentinel class extending `AppError`, tagged with a `Symbol.for(...)` registry marker for cross-module-cache safety) by returning the canonical `{ success: false, message }` envelope at HTTP 400. Anything else forwards via `next(err)` — dispatch is type-based, not string-prefix-based, so a renamed prefix or a foreign middleware producing a similar message cannot accidentally trigger this handler.

Tests:

- Unit: `backend/__tests__/middleware/requestBodySecurity.test.mjs`
- Integration: `backend/__tests__/integration/security/parameter-pollution.test.mjs` (HTTP-chain coverage of all the above), `request-body-silent-catch.test.mjs` (fail-closed + sentinel-class dispatch contract), `request-body-depth-cap.test.mjs` (32-deep cap enforcement), `request-body-urlencoded-duplicate-key.test.mjs`.

### **4. Rate Limiting & Anti-Automation**

#### **Multi-Layer Rate Limiting**

- **Global Rate Limits**: 100 requests per 15 minutes per IP
- **Auth Rate Limits**: 200 failed login attempts per 15 minutes (successful auths not counted; `skipSuccessfulRequests: true`)
- **Operation-Specific Limits**: Custom limits for sensitive operations
- **Anti-Automation**: Detects and blocks rapid-fire requests

#### **Suspicious Activity Detection**

```javascript
// Patterns detected:
- Excessive failures (10+ failed requests)
- Rapid-fire requests (20+ in 30 seconds)
- Multiple IP addresses (3+ IPs per user)
- Excessive sensitive operations (15+ in 5 minutes)
- Error-then-success patterns (exploit attempts)
```

### **5. Audit Logging & Monitoring**

#### **Comprehensive Audit Trail**

- **High-Sensitivity Operations**: Breeding, transactions, stat modifications
- **User Activity Tracking**: All operations logged with context
- **Suspicious Pattern Detection**: Real-time monitoring for exploits
- **Data Sanitization**: Sensitive data redacted in logs

#### **Security Alerts**

- **Automatic Detection**: Suspicious patterns trigger alerts
- **Detailed Logging**: Full context for security investigations
- **Pattern Analysis**: Multiple detection algorithms

### **Sentry Integration (Phase 4.3)**

- **Error Tracking**: Automatic error capture with stack traces
- **Performance Monitoring**: Request tracing and profiling
- **Security Event Alerting**: Threshold-based security alerts
- **Event Types**: 14 security event types tracked
  - Authentication failures, IDOR attempts, ownership violations
  - Privilege escalation, rate limit exceeded, suspicious activity
  - XSS/SQL injection attempts, sensitive data exposure
- **Alert Thresholds**: Configurable severity escalation
  - Auth failures: 5 events in 15 minutes
  - IDOR attempts: 3 events in 10 minutes
  - Privilege escalation: Immediate (1 event)
- **Production Ready**: Optional DSN configuration, graceful degradation
- **Documentation**: See `docs/SENTRY_SETUP.md` for configuration

### **6. Data Integrity**

#### **Hash Verification**

```javascript
// Data integrity verification
const dataHash = crypto
  .createHash('sha256')
  .update(JSON.stringify(data, Object.keys(data).sort()))
  .digest('hex');
```

#### **Timestamp Validation**

- **Server-Side Timestamps**: All operations use server time
- **Clock Drift Tolerance**: 5-minute tolerance for client clocks
- **Time Manipulation Detection**: Prevents time-based exploits

### **7. File Upload Security**

#### **File Validation**

- **Size Limits**: 5MB maximum file size
- **Type Validation**: Only JPEG, PNG, GIF, WebP allowed
- **Name Sanitization**: Prevents malicious file names
- **Content Verification**: MIME type validation

---

## 🛡️ **Common Exploit Prevention**

### **Stat Hacking**

- ✅ **Protected Fields**: Direct stat modification blocked
- ✅ **Range Validation**: All stats must be 0-100
- ✅ **Training Only**: Stats can only increase through legitimate training
- ✅ **Audit Logging**: All stat changes logged and monitored

### **Money Duplication**

- ✅ **Balance Verification**: Real-time balance checking
- ✅ **Transaction Limits**: Maximum amounts enforced
- ✅ **Duplicate Prevention**: Prevents rapid duplicate transactions
- ✅ **Audit Trail**: All financial operations logged

### **Resource Duplication**

- ✅ **Operation Tracking**: Prevents duplicate operations
- ✅ **Request Fingerprinting**: Unique operation signatures
- ✅ **Time-Based Blocking**: 5-second cooldown on identical operations

### **Training Exploits**

- ✅ **Global Cooldowns**: One discipline per week limit
- ✅ **Ownership Validation**: Only owners can train horses
- ✅ **Age Requirements**: Minimum age enforcement
- ✅ **Health Checks**: Injured horses cannot train

### **Breeding Exploits**

- ✅ **Biological Validation**: Proper sex and age requirements
- ✅ **Cooldown Enforcement**: 30-day breeding cooldowns
- ✅ **Ownership Verification**: Access control for breeding
- ✅ **Health Requirements**: Injured horses cannot breed

### **Time Manipulation**

- ✅ **Server Timestamps**: All operations use server time
- ✅ **Clock Validation**: Client timestamp verification
- ✅ **Cooldown Enforcement**: Server-side cooldown management

### **Account Sharing/Compromise**

- ✅ **IP Monitoring**: Multiple IP detection
- ✅ **Session Management**: Secure JWT tokens
- ✅ **Activity Patterns**: Suspicious behavior detection
- ✅ **Access Logging**: All access attempts logged

---

## 🔧 **Security Configuration**

### **Environment Variables**

```bash
# Required Security Settings
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Production Security Checklist**

- [ ] Change default JWT_SECRET
- [ ] Change default SESSION_SECRET
- [ ] Set BCRYPT_ROUNDS to 12+
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS only
- [ ] Set up monitoring and alerting
- [ ] Configure database connection limits
- [ ] Enable audit logging
- [ ] Set up backup and recovery

---

## 📊 **Security Monitoring**

### **Key Metrics to Monitor**

- Failed authentication attempts
- Rate limit violations
- Suspicious activity patterns
- Large financial transactions
- Multiple IP access per user
- Error-then-success patterns
- Rapid operation sequences

### **Alert Thresholds**

- **High Priority**: Multiple IP addresses, large transactions, stat manipulation attempts
- **Medium Priority**: Rate limit violations, excessive failures
- **Low Priority**: Invalid input attempts, 404 errors

---

## 🚀 **Security Best Practices**

### **For Developers**

1. **Never trust client input** - Validate everything server-side
2. **Use parameterized queries** - Prevent SQL injection
3. **Implement proper error handling** - Don't leak sensitive information
4. **Log security events** - Maintain audit trails
5. **Follow principle of least privilege** - Minimal required permissions
6. **Regular security reviews** - Code and configuration audits

### **For Operations**

1. **Keep dependencies updated** - Regular security patches
2. **Monitor security logs** - Real-time threat detection
3. **Backup regularly** - Secure backup procedures
4. **Network security** - Firewalls and access controls
5. **Incident response plan** - Prepared response procedures

---

## 🔍 **Security Testing**

### **Automated Testing (Phase 4.4)**

- **GitHub Dependabot**: Automated dependency vulnerability scanning
  - Daily npm audits for backend, frontend, and root packages
  - Weekly GitHub Actions workflow updates
  - Automatic PR creation with grouped updates
  - Security-first priority patching
- **CI/CD Security Gates**:
  - npm audit integration in GitHub Actions workflow
  - Blocks PR merge on critical/high vulnerabilities
  - Automated PR comments with vulnerability tables
  - 90-day audit report retention
- **OWASP ZAP Scanning**:
  - Baseline scans on every push
  - API scans using OpenAPI specification
  - Full scans weekly (scheduled)
  - SARIF format for GitHub Security integration
- **Unit Testing**:
  - Unit tests for all validation functions
  - Integration tests for security middleware
  - Load testing for rate limiting effectiveness
- **OWASP Top 10 Coverage**:
  - Comprehensive test suite for A01-A10 categories
  - 400+ security-specific test cases
  - See `__tests__/integration/security/` for test files

### **Manual Testing**

- Authentication bypass attempts
- Authorization escalation tests
- Input validation boundary testing
- Session management verification
- Penetration testing for critical endpoints

---

## 🎯 **OWASP Top 10:2021 Compliance**

### **A01:2021 - Broken Access Control** ✅

- JWT-based authentication with role validation
- Resource ownership verification middleware
- Protected route guards for sensitive endpoints
- Audit logging for all access attempts
- Test Coverage: `__tests__/integration/security/auth-bypass-attempts.test.mjs`, `ownership-violations.test.mjs`

### **A02:2021 - Cryptographic Failures** ✅

- Bcrypt password hashing (12+ rounds)
- JWT tokens with HMAC-SHA256 signatures
- Secure session management
- Environment variable protection for secrets
- HTTPS enforcement in production
- Test Coverage: Unit tests for authentication controllers

### **A03:2021 - Injection** ✅

- Prisma ORM with parameterized queries
- Input validation on all endpoints (express-validator)
- XSS prevention through input sanitization
- SQL injection prevention via ORM
- Command injection prevention
- Test Coverage: `__tests__/integration/security/sql-injection-attempts.test.mjs`, `parameter-pollution.test.mjs`

### **A04:2021 - Insecure Design** ✅

- Threat modeling for game mechanics
- Rate limiting to prevent abuse
- Resource duplication prevention
- Cooldown systems for game balance
- Secure-by-default configurations
- Test Coverage: Integration tests for game mechanics

### **A05:2021 - Security Misconfiguration** ✅

- Helmet security headers
- CORS configuration
- Environment-based configuration
- No default credentials
- Error handling without information leakage
- Test Coverage: `__tests__/integration/security/owasp-comprehensive.test.mjs` (A06 section)

### **A06:2021 - Vulnerable and Outdated Components** ✅

- Automated dependency scanning (Dependabot)
- npm audit in CI/CD pipeline
- Package-lock.json for dependency pinning
- Regular security updates
- Critical vulnerability blocking
- Test Coverage: GitHub Actions workflows, dependency audit reports

### **A07:2021 - Identification and Authentication Failures** ✅

- Strong password requirements
- JWT token expiration enforcement
- Refresh token rotation
- Failed login attempt limiting
- Session management with secure cookies
- Test Coverage: `__tests__/integration/security/auth-bypass-attempts.test.mjs`, `rate-limit-enforcement.test.mjs`

### **A08:2021 - Software and Data Integrity Failures** ✅

- Package integrity verification
- JWT signature validation
- Data integrity checks for critical operations
- Protected stat fields
- Unsigned code rejection
- Test Coverage: `__tests__/integration/security/owasp-comprehensive.test.mjs` (A08 section)

### **A09:2021 - Security Logging and Monitoring Failures** ✅

- Comprehensive audit logging (Winston)
- Sentry error tracking and security event monitoring
- Failed authentication logging
- Ownership violation logging
- Rate limit violation logging
- Suspicious activity pattern detection
- Test Coverage: `__tests__/integration/security/owasp-comprehensive.test.mjs` (A09 section), audit log middleware tests

### **A10:2021 - Server-Side Request Forgery (SSRF)** ⚪ N/A — NO EXTERNAL-URL SURFACE

**Corrected 2026-05-18 (Equoria-zuva):** The prior "✅" with bulleted controls
(URL validation, internal-IP blocking, file:// rejection, DNS-rebinding) was a
false-green. **No production code implements any of those.** A codebase audit
found zero URL-validation / internal-IP / SSRF logic outside an
assertion-free placeholder block in
`backend/modules/services/__tests__/owasp-comprehensive.test.mjs`. The app has
no user-supplied-URL feature (no webhook, avatar-by-URL, OAuth redirect, or
server-side fetch of user input); the only outbound `fetch()` is dev-only
scripts hitting hardcoded localhost. SSRF is therefore **not applicable** —
nothing to protect — not "compliant via controls."

- Hard prerequisite gate: before ANY feature that fetches a user-supplied URL
  ships, a reusable SSRF-guard (scheme allow-list; block loopback /
  link-local incl. `169.254.169.254` / RFC1918 / `::1`; validate resolved IP
  post-DNS) MUST be implemented and wired in, with sentinel-positive tests
  against real production code. Tracked separately as a blocking gate.

### **Compliance Summary** (corrected 2026-05-18)

- ⚠️ **8/10 OWASP categories implemented; A09 partial (file-only audit, no DB
  trail); A10 N/A (no SSRF surface)** — the prior "10/10 fully addressed" was
  inaccurate.
- ✅ **243+ verified security test cases** (the prior "400+" was unverified)
- ✅ **Automated continuous dependency scanning (backend + frontend + root)**
- ⚠️ **Monitoring: file logging mounted; DB-backed audit trail NOT implemented**

---

## 📞 **Security Incident Response**

### **Immediate Actions**

1. **Identify the threat** - Determine scope and impact
2. **Contain the incident** - Prevent further damage
3. **Preserve evidence** - Maintain audit logs
4. **Notify stakeholders** - Internal and external communication
5. **Remediate vulnerabilities** - Fix security gaps
6. **Monitor for recurrence** - Enhanced monitoring

### **Contact Information**

- **Security Team**: security@equoria.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
- **Incident Reporting**: incidents@equoria.com

---

## 📚 **Additional Resources**

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

_Last Updated: 2026-01-28_
_Version: 2.0 (Phase 4 Security Hardening Complete)_

### **Changelog**

**Version 2.0 (2026-01-28):**

- Added Sentry integration for error tracking and security monitoring
- Implemented automated security testing (Dependabot + npm audit + OWASP ZAP)
- Added comprehensive OWASP Top 10:2021 compliance section
- Created comprehensive security test suite (400+ tests)
- Updated security testing methodology
- Production security checklist expanded

**Version 1.0 (2025-01-XX):**

- Initial security documentation
- Core security measures documented
- Exploit prevention strategies outlined
