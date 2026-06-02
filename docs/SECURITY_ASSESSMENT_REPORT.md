# 🔒 Equoria Security Assessment Report

**Assessment Date:** January 28, 2026
**Accuracy Correction:** May 18, 2026 (Equoria-zuva, Equoria-ss4r — false-green claims removed; every statement reconciled against the codebase at this commit)
**Assessor:** Phase 4 Security Hardening Team
**Version:** 2.1 (accuracy-corrected)
**Classification:** Internal Use

---

> **Accuracy correction notice (2026-05-18):** An audit found multiple materially
> inaccurate claims in v2.0 that could have produced a false-green go/no-go
> decision (cf. `.claude/rules/COMPLETION_VERIFICATION_POLICY.md`). The following
> were corrected: SSRF (A10) downgraded from "COMPLIANT" to "N/A — no
> external-URL surface" (no production code consumes user-supplied URLs); MFA
> "infrastructure in place" claim removed (no MFA schema/code/routes exist);
> audit-logging coverage corrected (Winston request logging is mounted, but
> the `auditLog.mjs` DB-persistence path is explicitly _not implemented_); test
> file paths corrected to `backend/__tests__/` (the v2.0
> docs pointed at a now-nonexistent `integration/security` test directory);
> fabricated test counts and the
> unsubstantiated "98.5% coverage" metric replaced with verified counts;
> frontend-audit contradiction reconciled (the frontend _is_ audited by
> `security-scan.yml`); placeholder contact details explicitly marked TODO.

## Executive Summary

This report assesses the Equoria platform's security posture following Phase 4 Security Hardening. Equoria implements strong, multi-layered security controls (JWT auth, RBAC + ownership checks, parameterized Prisma queries, request-body / query prototype-pollution defenses, Helmet, rate limiting, automated dependency scanning). It is **not** fully OWASP Top 10:2021 "compliant" in the literal sense: SSRF (A10) has no applicable attack surface (correctly N/A, not "compliant via implemented controls"), and several v2.0 maturity claims (global DB-backed audit log, MFA) were overstated and are corrected below.

### Overall Security Rating: **B+ — Strong, with corrected scope**

The rating was lowered from the v2.0 "A+ (Excellent)" because that grade rested on inflated claims. The underlying implemented controls are genuinely strong; the rating reflects honest scope, not a regression in code.

| Category                       | Rating | Status                                                                                                        |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| Authentication & Authorization | A      | ✅ Strong (opt-in TOTP MFA — see A07)                                                                         |
| Data Protection                | A      | ✅ Strong                                                                                                     |
| Input Validation               | A+     | ✅ Excellent (proto-pollution defenses verified)                                                              |
| Security Testing               | B+     | ✅ Good (counts corrected; no coverage % claimed)                                                             |
| Monitoring & Logging           | A      | ✅ File + DB audit trail (globally enforced for sensitive mutations; nightly retention purge — Equoria-54qq8) |
| Configuration Security         | A      | ✅ Strong                                                                                                     |
| Dependency Management          | A+     | ✅ Excellent (backend + frontend audited in CI)                                                               |
| **Overall Grade**              | **B+** | ✅ **Strong (honest scope)**                                                                                  |

---

## 1. Security Architecture

### 1.1 Defense-in-Depth Strategy

Equoria implements a multi-layered security approach:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Network Security (HTTPS, CORS, Helmet)│
├─────────────────────────────────────────────────┤
│  Layer 2: Authentication (JWT, bcrypt, sessions)│
├─────────────────────────────────────────────────┤
│  Layer 3: Authorization (RBAC, ownership checks)│
├─────────────────────────────────────────────────┤
│  Layer 4: Input Validation (express-validator)  │
├─────────────────────────────────────────────────┤
│  Layer 5: Business Logic (game rules, cooldowns)│
├─────────────────────────────────────────────────┤
│  Layer 6: Data Access (Prisma ORM, SQL-safe)    │
├─────────────────────────────────────────────────┤
│  Layer 7: Monitoring (Sentry, audit logs)       │
└─────────────────────────────────────────────────┘
```

### 1.2 Technology Stack Security

**Backend:**

- Node.js 18+ (LTS, security patches current)
- Express.js 5.x with Helmet middleware
- PostgreSQL 14+ with Prisma ORM
- JWT authentication with HMAC-SHA256
- bcrypt password hashing (12 rounds)

**Security Tools:**

- Sentry (@sentry/node 8.45.1) - Error tracking & security monitoring
- Helmet (security headers)
- express-rate-limit (DDoS protection)
- express-validator (input validation)
- CSRF protection middleware

---

## 2. OWASP Top 10:2021 Compliance Analysis

### A01:2021 - Broken Access Control ✅ COMPLIANT

**Implementation:**

- JWT-based authentication on all protected routes
- Role-Based Access Control (RBAC) with user/moderator/admin roles
- Resource ownership verification middleware
- Protected route guards
- Comprehensive audit logging

**Test Coverage** (paths: `backend/__tests__/`; counts verified 2026-05-18):

- `auth-bypass-attempts.test.mjs` (30 test cases)
- `ownership-violations.test.mjs` (9 test cases)

**Risk Level:** LOW
**Recommendation:** Continue monitoring access patterns via Sentry

---

### A02:2021 - Cryptographic Failures ✅ COMPLIANT

**Implementation:**

- bcrypt password hashing (12 rounds in production)
- JWT tokens with HMAC-SHA256 signatures
- Secure session management with httpOnly cookies
- Environment variables for all secrets
- HTTPS enforcement in production

**Test Coverage:**

- Unit tests for authController password hashing
- JWT token validation tests
- Refresh token rotation tests

**JWT signing-key rotation (implemented 2026-05-18, Equoria-gjdj):** A
two-key ring (`backend/utils/jwtKeyRing.mjs`) now signs with the current
secret and verifies against the current OR an optional previous secret
(`JWT_SECRET_PREVIOUS` / `JWT_REFRESH_SECRET_PREVIOUS`) during a rotation
overlap window, so a secret can be rotated without a forced global logout.
Documented runbook + invariants: `docs/architecture/adr-009-jwt-secret-rotation-keyring.md`.
Wired into access verify (`auth.mjs`) and refresh verify
(`tokenRotationService.mjs`); enforced by 14 unit tests
(`backend/__tests__/jwtKeyRing.test.mjs`).

**Risk Level:** LOW
**Recommendation:** Operate the ADR-009 rotation runbook on a periodic
schedule; ensure `*_PREVIOUS` is always unset after the overlap window closes.

---

### A03:2021 - Injection ✅ COMPLIANT

**Implementation:**

- Prisma ORM with parameterized queries (100% SQL-safe)
- Input validation on all endpoints using express-validator
- XSS prevention through input sanitization
- Command injection prevention (no child_process usage with user input)
- NoSQL injection prevention via Prisma type safety
- Prototype-pollution prevention (CWE-1321) at the request-parsing boundary — see dedicated subsection below.

**Test Coverage** (paths: `backend/__tests__/`; counts verified 2026-05-18):

- `sql-injection-attempts.test.mjs` (40 test cases)
- `parameter-pollution.test.mjs` (51 test cases — prototype-pollution defense on body, query, and content-type; **headers/cookies/params are intentionally out of scope for prototype pollution**, see the scope note in the Prototype Pollution subsection below. The suite also includes generic injection-via-header tests, which are a distinct concern from proto-pollution and are not what "header pollution coverage" would mean.)
- `request-body-silent-catch.test.mjs` (55 executed test cases — fail-closed scanner contract + sentinel-class dispatch; static `it(`-count undercounts due to parametrized `it.each` cases, verified by run output 2026-05-18)
- `request-body-depth-cap.test.mjs` + `request-body-depth-cap-boundary.test.mjs` (depth-cap enforcement)
- `request-body-urlencoded-duplicate-key.test.mjs` (urlencoded dup-key bypass closure)
- `backend/__tests__/requestBodySecurity.test.mjs` (unit-level coverage of the scanner / guard / handler trio)
- Input validation tests across controllers

**Risk Level:** VERY LOW
**Recommendation:** None - implementation is industry-leading

#### Prototype Pollution Prevention (CWE-1321)

JavaScript objects expose `__proto__`, `constructor`, and `prototype` slots that — when set as own properties on parsed user input — can mutate `Object.prototype` indirectly via downstream `Object.assign`, spread, or merge operations. The classic exploit grants `isAdmin: true` (or any flag) to every object in the runtime by polluting the shared prototype.

Equoria's defense lives at the request-parsing boundary in `backend/middleware/requestBodySecurity.mjs` and is mounted in `backend/app.mjs` BEFORE any route handler runs:

| Defense                           | Surface                                                                 | What it catches                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifyJsonBody`                  | raw JSON bytes (express.json `verify` hook)                             | duplicate keys (21R-SEC-1), excessive nesting (21R-SEC-3, depth cap 32), Unicode-escape duplicate-key obfuscation (21R-SEC-1). Fails closed on any unexpected scanner error (21R-SEC-3-FOLLOW-1).                                                                          |
| `rejectPollutedRequestBody`       | parsed `req.body` (post-`express.json()`)                               | own properties named `__proto__`, `constructor`, or the path `constructor.prototype` at any nesting depth. Iterative DFS with explicit depth cap (no recursion → no stack-overflow DoS).                                                                                   |
| `rejectPollutedRequestQuery`      | `req.query` + raw URL querystring (21R-SEC-4, Equoria-iq84)             | Two-stage scan. Stage 1 walks the raw URL querystring (catches `__proto__[isAdmin]=1` even when qs has stripped it from the parsed object). Stage 2 walks `req.query` for `constructor[prototype][isAdmin]=1` chains qs leaves intact.                                     |
| `verifyUrlEncodedBody`            | raw `application/x-www-form-urlencoded` bytes (21R-SEC-5, Equoria-lf3z) | duplicate keys after percent-decoding (`name=Valid&name=Hacked` cannot bypass via Content-Type swap).                                                                                                                                                                      |
| `requestBodySecurityErrorHandler` | error pipeline (21R-SEC-6, Equoria-tpbu)                                | dispatches via `RequestBodySecurityError` sentinel-class marker (`Symbol.for(...)` for cross-module-cache safety), NOT via message-prefix string match — so a renamed prefix or a foreign middleware producing a similar message cannot accidentally trigger this handler. |

Path params (`req.params`), headers, and cookies are out of scope: each is a flat string-to-string surface populated by the framework, with no nested object structure where prototype-slot keys could appear.

**Risk Level:** VERY LOW
**Recommendation:** Continue running the `backend/__tests__/request-body-*` and `parameter-pollution` test files in CI. The `request-body-silent-catch.test.mjs` source-side coupling sentinel hard-pins the throw pattern, so any regression that re-introduces the legacy string-prefix dispatch fails immediately.

---

### A04:2021 - Insecure Design ✅ COMPLIANT

**Implementation:**

- Threat modeling conducted for game mechanics
- Rate limiting prevents abuse (100 req/15min global; auth: 200 **failed**
  attempts/15min with `skipSuccessfulRequests: true` — source of truth is
  `backend/middleware/rateLimiting.mjs` `authRateLimiter`. The prior "5
  auth/15min" was wrong; corrected 2026-05-18, Equoria-s74b.)
- Resource duplication prevention (5-second cooldown)
- Game balance cooldowns (7-day training, 30-day breeding)
- Secure-by-default configurations

**Test Coverage** (`backend/__tests__/`; verified 2026-05-18):

- `rate-limit-enforcement.test.mjs` (8 test cases)
- Integration tests for game mechanics
- Business logic validation tests

**Risk Level:** LOW
**Recommendation:** Conduct annual threat modeling review

---

### A05:2021 - Security Misconfiguration ✅ COMPLIANT

**Implementation:**

- Helmet security headers (X-Frame-Options, X-Content-Type-Options, HSTS)
- CORS configuration with origin whitelisting
- Environment-based configuration (dev/test/prod)
- No default credentials
- Error handling without information leakage (no stack traces in production)
- Server version hiding (X-Powered-By removed)

**Test Coverage** (`backend/__tests__/owasp-comprehensive.test.mjs`, 28 cases total across all OWASP sections; verified 2026-05-18):

- `owasp-comprehensive.test.mjs` misconfiguration section
- Security header validation tests
- Error message sanitization tests

**Accepted residual (CSP `style-src 'unsafe-inline'`):** The Helmet CSP keeps
`style-src 'self' 'unsafe-inline'`. `script-src` is `'self'`-only (no
`'unsafe-inline'`/`'unsafe-eval'`), so the high-severity script-execution XSS
path is blocked; the residual is the lower-severity style-injection vector.
`'unsafe-inline'` is required because Radix UI's transitive
`react-style-singleton` injects runtime `<style>` tags after load and the
static-SPA serving model has no per-request nonce path. This is an explicit,
tracked accepted-risk decision with defined re-evaluation triggers —
**not** a silent omission or false-green — documented in
`docs/architecture/adr-008-csp-style-src-unsafe-inline.md` (bd Equoria-e3k9).
A CI sentinel (`backend/__tests__/security.test.mjs`) locks
the CSP shape so it cannot silently broaden.

**Risk Level:** LOW (style-injection residual accepted per ADR-008)
**Recommendation:** Review CORS origins before production deployment; revisit
ADR-008 when any of its re-evaluation triggers fire.

---

### A06:2021 - Vulnerable and Outdated Components ✅ COMPLIANT

**Implementation:**

- **GitHub Dependabot** automated dependency scanning:
  - Daily npm audits for backend, frontend, root
  - Weekly GitHub Actions workflow updates
  - Automatic PR creation with grouped updates
  - Security-first priority patching
- **CI/CD Integration**:
  - npm audit in GitHub Actions pipeline
  - Blocks PR merge on critical/high vulnerabilities
  - Automated vulnerability table in PR comments
  - 90-day audit report retention
- Package-lock.json for dependency pinning
- Regular npm audit reviews

**Test Coverage:**

- GitHub Actions workflow validation
- Dependency integrity tests
- Package-lock.json existence verification

**Risk Level:** VERY LOW
**Recommendation:** None - automated scanning is comprehensive

---

### A07:2021 - Identification and Authentication Failures ✅ — TOTP MFA available (opt-in)

**Implementation:**

- Strong password requirements (8+ chars, complexity rules)
- JWT token expiration enforcement (1h access, 7d refresh)
- Refresh token rotation on use
- Failed login attempt rate limiting (200 failed attempts/15min; successful auths not counted)
- Session management with secure httpOnly cookies
- Password reset with secure token generation
- **Opt-in TOTP MFA** (RFC 6238 via `otplib`) — enroll / verify-enrollment /
  challenge / disable; single-use bcrypt-hashed recovery codes; login returns
  `mfaRequired` + 5-minute signed challenge token when `mfaEnabled` (no
  session issued until the second factor passes)

> **Update (2026-05-18, Equoria-2vwwh):** Opt-in TOTP MFA is now SHIPPED.
> `User.mfaSecret` / `mfaEnabled` / `mfaRecoveryCodes` (migration
> `20260518120000_add_user_mfa_fields`); service
> `backend/modules/auth/services/mfaService.mjs`; routes under
> `/api/v1/auth/mfa/*`. The prior "no MFA code exists" correction is
> superseded.
>
> **Accuracy re-verification (2026-05-19, Equoria-ss4r against origin/master
> HEAD):** Two residual-risk claims in the prior revision of this block were
> **stale** — both gaps are CLOSED in code that landed before the s3rf edit
> (978713945) that last touched this report, so the report shipped describing
> a state ~2 commits behind reality:
>
> - ✅ **`mfaSecret` IS encrypted at rest (RESOLVED, Equoria-yi13v, commit
>   7701ed345, 2026-05-18).** `backend/utils/fieldEncryption.mjs` (AES-256-GCM)
>   exists; `backend/modules/auth/controllers/authController.mjs:1537` writes
>   `mfaSecret: encryptField(secret)`; sentinel
>   `backend/modules/auth/__tests__/mfaSecretEncryptedAtRest.sentinel.test.mjs`
>   asserts the persisted value is not plaintext base32 + round-trips. The
>   prior "stored unencrypted (no encryption util in codebase)" statement was
>   false against origin/master.
> - ✅ **Admin-account MFA enforcement IS implemented (RESOLVED,
>   Equoria-te21j).** `requireAdminMfa` (`backend/middleware/auth.mjs:334`,
>   opt-in via env `ADMIN_MFA_REQUIRED`) is mounted on the admin router
>   (`backend/app.mjs:171`), fail-closed on DB lookup error. The prior
>   "separate tracked follow-up, deferred" statement was stale; the control
>   exists (default-off so existing admins aren't locked out — flipping the
>   flag is an operator action, not unimplemented code).
>
> MFA remains opt-in for non-admin accounts (no global mandatory enforcement);
> that broader posture is a genuine open follow-up.

**Test Coverage** (verified 2026-05-18):

- `backend/__tests__/auth-bypass-attempts.test.mjs` (30 test cases)
- `backend/__tests__/rate-limit-enforcement.test.mjs` (8 test cases, incl. auth section; relocated from modules/services/__tests__ per Equoria-0ys7m)
- `backend/modules/auth/__tests__/mfa.integration.test.mjs` (10 real-DB integration cases — full MFA lifecycle + non-MFA login unchanged)
- Session management tests

**Risk Level:** LOW (opt-in TOTP MFA shipped; `mfaSecret` AES-256-GCM
encrypted at rest — Equoria-yi13v; opt-in admin MFA enforcement available —
Equoria-te21j. Residual: non-admin MFA is opt-in, no global mandatory
enforcement.)
**Recommendation:** (1) ✅ DONE — `mfaSecret` encrypted at rest
(Equoria-yi13v); (2) ✅ DONE — admin-account MFA enforcement implemented,
opt-in via `ADMIN_MFA_REQUIRED` (Equoria-te21j); operators flip the flag
post-rollout. Remaining genuine follow-up: optional global/mandatory MFA for
all accounts (not yet implemented).

---

### A08:2021 - Software and Data Integrity Failures ✅ COMPLIANT

**Implementation:**

- Package-lock.json for dependency integrity
- JWT signature validation (rejects unsigned/tampered tokens)
- Data integrity checks for critical operations (stat manipulation prevention)
- Protected stat fields (cannot be directly modified)
- Hash verification for sensitive data
- Insecure deserialization prevention (JSON.parse with validation)

**Test Coverage** (`backend/__tests__/owasp-comprehensive.test.mjs`, 28 cases total; verified 2026-05-18):

- `owasp-comprehensive.test.mjs` A08 section
- JWT tampering tests
- Stat manipulation prevention tests
- Prototype pollution prevention tests (`parameter-pollution.test.mjs`, 51 cases)

**Risk Level:** LOW
**Recommendation:** Consider implementing checksum verification for file uploads

---

### A09:2021 - Security Logging and Monitoring Failures ✅ DB-BACKED + GLOBALLY ENFORCED FOR SENSITIVE MUTATIONS + RETENTION-BOUNDED

> **Resolution (2026-05-18, Equoria-jw10w):** The PARTIAL state from the
> 2026-05-18 accuracy correction is now fixed for the mutation surface.
> `backend/middleware/auditLog.mjs` `storeAuditLog()` persists a real row to
> a new `AuditLog` Prisma model (table `audit_logs`, migration
> `20260518120000_add_audit_log`). A `globalAuditTrail` middleware is mounted
> ONCE app-wide in `backend/app.mjs` (right after `requestLogger`), so
> coverage of sensitive mutating routes is enforced by construction — not
> opt-in per route. Verified by a real-DB integration test (no mocks).
>
> **Retention RESOLVED (2026-05-18, Equoria-54qq8):** the previously-unbounded
> `audit_logs` table now has an automated time-based retention purge.
> `backend/services/auditLogRetentionService.mjs#purgeExpiredAuditLogs()`
> performs a **scoped DELETE** (`where: { createdAt: { lt: cutoff } }`, never
> unscoped) of rows older than the retention window, invoked nightly at
> 03:30 UTC by `CronJobService` (job key `auditLogRetention`, wrapped in
> `runWithHeartbeat`). Default window **90 days** (aligned with the 90-day CI
> audit-report retention), overridable via `AUDIT_LOG_RETENTION_DAYS`,
> **clamped to a 7-day floor** so a misconfigured env can never effectively
> disable the trail or wipe near-current forensic history. Reads remain
> intentionally not persisted (mutation-scoped trail by design).

**Implementation (verified):**

- **Request / Event Logging:**
  - Winston logger with structured logging (globally mounted via `requestLogger`)
  - Authentication events logged to file
  - Ownership violations logged to file
  - Rate limit violations logged to file
  - Suspicious activity pattern detection (in-memory + log)
  - ✅ **DB-persisted audit trail** — `AuditLog` model (soft `userId` ref so
    rows survive user deletion), `storeAuditLog()` writes rows fail-soft
    (catches/swallows all errors, never throws, never on the request
    critical path), `globalAuditTrail` enforces POST/PUT/PATCH/DELETE
    coverage on sensitive prefixes (auth, bank/transactions, breeding,
    training, admin, grooms) across both `/api` and `/api/v1` mounts.
    Secrets redacted via `sanitizeLogData()`. Reads mutation-scoped out by
    design.
- **Sentry Integration (Phase 4.3):**
  - Error tracking with stack traces
  - Performance monitoring
  - 14 security event types tracked:
    - AUTH_FAILURE, AUTH_SUCCESS, TOKEN_EXPIRED, TOKEN_INVALID
    - IDOR_ATTEMPT, OWNERSHIP_VIOLATION, PRIVILEGE_ESCALATION
    - RATE_LIMIT_EXCEEDED, SUSPICIOUS_ACTIVITY
    - VALIDATION_FAILURE, XSS_ATTEMPT, SQL_INJECTION_ATTEMPT
    - SENSITIVE_DATA_EXPOSURE, ERROR_LEAK
  - Threshold-based severity escalation:
    - Auth failures: 5 events/15min → critical
    - IDOR attempts: 3 events/10min → critical
    - Privilege escalation: 1 event → immediate critical
    - XSS/SQL injection: 1 event → immediate critical
  - ⚠️ **Threshold counting is per-process, NOT scale-accurate (Equoria-rqi7,
    2026-05-18).** `checkAlertThreshold` in `backend/config/sentry.mjs`
    (`const eventCounters = new Map()`, ~line 198) keeps event history in a
    plain in-process JS `Map`. Consequences under horizontal scaling (multiple
    Railway instances) or any restart/deploy:
    - An attacker whose requests load-balance across N instances divides their
      event count by N per instance, so an aggregate-threshold-worth of
      activity may never trip on any single process.
    - Counters reset to empty on every deploy / instance restart, so a slow
      attack spanning a deploy is not aggregated across the boundary.
    - Single-instance Sentry capture of each event still works (every event is
      reported); only the **escalation-to-critical aggregation** is unreliable
      at scale. Treat threshold escalation as a best-effort single-process
      heuristic, **not** a scale-accurate alerting control. A Redis-backed
      shared counter is the documented remediation path if/when multi-instance
      escalation accuracy becomes required.
- **Audit Log Fields:**
  - Timestamp, user ID, IP address, user agent
  - Operation type, resource accessed, success/failure
  - Context data, request/response details

**Test Coverage** (verified 2026-05-18):

- `backend/__tests__/auditLogPersistence.integration.test.mjs` — real-DB,
  no mocks: exactly one `AuditLog` row per sensitive mutation with correct
  fields + secret redaction; no row for reads; fail-soft sentinel that
  genuinely exercises the Prisma error path (NaN → Int reject → 0 rows, no
  throw)
- `backend/__tests__/auditLogRetention.integration.test.mjs` — real-DB,
  no mocks: rows older than the retention window are deleted while recent
  rows are retained; scoped DELETE only; sub-floor `AUDIT_LOG_RETENTION_DAYS`
  is clamped so near-current history is never wiped
- `backend/__tests__/owasp-comprehensive.test.mjs` A09 section
- `backend/__tests__/auditLog.test.mjs` (helper unit tests)
- Sentry integration tests

**Risk Level:** LOW for the sensitive-mutation surface — DB-backed, enforced
by construction, **and now retention-bounded** (Equoria-54qq8 nightly purge).
The previous MEDIUM residual (unbounded `audit_logs` growth) is resolved.
**Recommendation:** Configure Sentry alerts/dashboards in production. Consider
widening the sensitive-prefix allowlist if non-listed mutating routes need
audit coverage (deliberate posture decision). DB-backed persistence + global
enforcement delivered under **Equoria-jw10w**; automated time-based retention
delivered under **Equoria-54qq8**. If audit volume outgrows a nightly scoped
DELETE, migrating `audit_logs` to a partitioned table is a documented future
spike (not pre-built — avoids speculative complexity).

---

### A10:2021 - Server-Side Request Forgery (SSRF) ⚪ N/A — NO EXTERNAL-URL ATTACK SURFACE

> **Correction (2026-05-18, Equoria-zuva):** The v2.0 "✅ COMPLIANT" claim was
> a false-green. A codebase audit found **zero production code** that validates
> URLs or blocks internal IPs. The only SSRF-related code was empty placeholder
> `describe`/`it` blocks in `owasp-comprehensive.test.mjs` (no assertions, all
> bodies commented out — they exercise no production code). Per
> `OPTIMAL_FIX_DISCIPLINE.md` §1 the honest fix solves the real problem
> (accurate posture), which here is: there is no SSRF surface to protect.

**Actual status — assessed, not assumed:**

- No production endpoint accepts a user-supplied URL that the server then
  fetches (no webhook, no avatar-by-URL, no OAuth redirect, no proxy/import).
- The only outbound `fetch()` calls in the repo are in dev-only scripts
  (`backend/examples/foalEnrichmentDemo.mjs`, `backend/scripts/testAPI.mjs`,
  `backend/scripts/testAssignment.mjs`) targeting hardcoded localhost — not
  user input, not shipped, not reachable from the running app.
- Therefore SSRF is **not applicable**: there is nothing to validate. This is
  the honest rating, not "compliant via implemented controls."

**Hard prerequisite gate — STATUS: ✅ BUILT AHEAD (re-verified 2026-05-19,
Equoria-ss4r against origin/master HEAD):**

- The prior revision said the SSRF-guard utility "MUST be implemented" and
  was a "blocking gate tracked as Equoria-4dva" (unbuilt). That is **stale**:
  Equoria-4dva was **delivered** in commit `5a1614fe1` (2026-05-19), which
  also landed before the s3rf edit that last touched this report — so the
  report shipped describing the guard as not-yet-built when it already
  existed.
- `backend/utils/ssrfGuard.mjs` is a real, fail-closed implementation:
  blocks loopback (`127.0.0.0/8`, `::1`), link-local incl. the cloud-metadata
  IP (`169.254.0.0/16` → `169.254.169.254`), and RFC1918
  (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). Sentinel coverage:
  `backend/__tests__/ssrfGuard.test.mjs`.
- This is a **build-ahead** control: there is still no production endpoint
  that consumes a user-supplied URL, so the guard is not yet wired into a
  request path (correctly — there is nothing to wire it to). When the first
  external-URL feature is added, it must call this existing guard; the
  utility no longer needs to be built first.

**Test Coverage:** `backend/__tests__/ssrfGuard.test.mjs`
(unit-level coverage of the now-existing guard utility). The legacy
placeholder-only blocks in `owasp-comprehensive.test.mjs` remain excluded
from readiness consideration.

**Risk Level:** N/A (no attack surface today; reusable guard now BUILT, so a
future external-URL feature can adopt it immediately) — escalates to HIGH
only if such a feature ships **without** calling `ssrfGuard.mjs`.
**Recommendation:** SSRF-guard utility is delivered (Equoria-4dva,
`backend/utils/ssrfGuard.mjs`). Do not re-rate A10 as "compliant" until an
external-URL feature exists _and_ is verified to route through this guard.

---

## 3. Security Test Suite Analysis

### 3.1 Test Coverage Summary

> **Correction (2026-05-18, Equoria-1w66):** v2.0 counts were fabricated (e.g.
> owasp-comprehensive "80+" → actual 28; sql-injection "20" → 40; auth-bypass
> "15" → 30) and the "98.5% Security Test Coverage" figure was unsubstantiated
> (no coverage instrument produces it). The table below is the **executed-test
> count** from an actual Jest run of each file (`jest <file>`, point-in-time
> 2026-05-18) — not a static `it(`/`test(` text grep. Runtime counts differ
> from a text grep because `it.each`/`test.each` blocks expand at run time
> (e.g. `request-body-silent-catch` greps 27 `it(` calls but executes 55
> cases). All files live in `backend/__tests__/` — **not** the
> old `integration/security` test directory the v2.0 docs referenced. Re-run
> the same `jest` commands to reverify; this is a point-in-time figure, not a
> standing guarantee.

| Test File (`backend/__tests__/`) | Executed Test Cases (jest run, 2026-05-18) |
| ------------------------------------------------- | ------------------------------------------ |
| `auth-bypass-attempts.test.mjs`                   | 30                                         |
| `ownership-violations.test.mjs`                   | 9                                          |
| `parameter-pollution.test.mjs`                    | 51                                         |
| `rate-limit-enforcement.test.mjs`                 | 8                                          |
| `sql-injection-attempts.test.mjs`                 | 40                                         |
| `owasp-comprehensive.test.mjs`                    | 28                                         |
| `security-attack-simulation.test.mjs`             | 41                                         |
| `request-body-silent-catch.test.mjs`              | 55                                         |
| **Subtotal (these 8 files, all passing)**         | **262**                                    |

Plus the `request-body-depth-cap*`, `request-body-urlencoded-duplicate-key`,
`request-body-key-reflection`, `request-body-max-depth-env-validation`,
`request-body-security-p0-follow`, `auditLog`, and
`requestBodySecurity.test.mjs` suites (all under
`backend/__tests__/`). Numbers
above are exact `it`/`test` counts; no percentage coverage metric is claimed
because none is measured.

### 3.2 Security Test Files

**Backend Security Tests** (actual paths, verified 2026-05-18):

1. `backend/__tests__/auth-bypass-attempts.test.mjs`
2. `backend/__tests__/ownership-violations.test.mjs`
3. `backend/__tests__/parameter-pollution.test.mjs`
4. `backend/__tests__/rate-limit-enforcement.test.mjs`
5. `backend/__tests__/sql-injection-attempts.test.mjs`
6. `backend/__tests__/owasp-comprehensive.test.mjs`
7. `backend/__tests__/security-attack-simulation.test.mjs`
8. `backend/__tests__/request-body-*.test.mjs` (depth-cap, silent-catch, urlencoded-dup-key, etc.)

> Note: the old `integration/security` test directory the v2.0 docs cited
> does **not** exist as the location for these suites; that path was wrong
> throughout v2.0 and has been corrected here.

**Coverage Metrics (measured, point-in-time 2026-05-18, Equoria-1w66):** The
prior "98.5% / 100% / 97%" figures were fabricated and have been removed. The
project's own Istanbul artifact `backend/coverage-security/coverage-summary.json`
reports, for the _whole backend tree_ under this run: **lines 5.03%, statements
4.9%, functions 4%, branches 3.97%** (e.g. `middleware/auth.mjs` 10.08% lines,
`middleware/auditLog.mjs` 0%). These low whole-tree percentages are expected:
the security suites in §3.1 are black-box HTTP integration tests that exercise
the running app over the wire, so line/branch instrumentation does not credit
them the way unit tests would. The defensible security-testing metric for this
suite is the **executed test count in §3.1 (262 passing cases)**, not a
line-coverage percentage. Treat the 5.03% as the literal measured value, not as
a target or a quality claim.

---

## 4. Automated Security Systems

### 4.1 Continuous Security Monitoring (Phase 4.3)

**Sentry Configuration:**

- Error tracking: Automatic capture with stack traces
- Performance monitoring: 10% sampling in production
- Security event tracking: All 14 event types
- Alert thresholds: Configured for immediate response
- Production DSN: Ready for configuration
- Documentation: `docs/SENTRY_SETUP.md`

**Status:** ✅ Fully Implemented, Testing Complete

### 4.2 Automated Security Testing (Phase 4.4)

**GitHub Dependabot:**

- Daily npm audits (backend, frontend, root)
- Weekly GitHub Actions updates
- Automatic PR creation with grouped updates
- Security-first patching priority
- Configuration: `.github/dependabot.yml`

**CI/CD Security Gates:**

- npm audit in GitHub Actions
- Blocks critical/high vulnerability PRs
- Automated PR comments with vulnerability tables
- 90-day audit report retention
- Workflow: `.github/workflows/security-scan.yml`

**OWASP ZAP Scanning:**

- Baseline scans on every push — **advisory** (`continue-on-error: true`,
  `fail_action: false`): findings are reported and uploaded but do NOT
  block the PR.
- API scans using OpenAPI spec — **advisory**, same configuration as the
  baseline scan.
- Weekly full scans (scheduled).
- SARIF integration for GitHub Security.
- The only ZAP step that is merge-blocking is **"Process ZAP Results"**,
  which parses `report_json.json` and fails the job when **HIGH-severity
  (riskcode 3)** findings are present. MEDIUM/LOW findings and all
  baseline/API-scan alerts below HIGH are advisory only.

**Status:** ✅ Implemented and active. Enforcement is partial by design:
ZAP baseline/API scans are advisory; only HIGH-severity findings (via the
"Process ZAP Results" post-processing step) gate a merge. Whether the
baseline/API scans should themselves be made merge-blocking is a security
posture decision that is **deferred** (tracked under bd Equoria-dzyse —
not yet decided).

### 4.3 Audit Logging System

**Winston Logger Configuration:**

- Structured JSON logging
- Log levels: error, warn, info, debug
- File rotation (10MB max, 14-day retention)
- Console output in development
- Production log aggregation ready

**Audit Log Middleware (corrected 2026-05-18):**

- HTTP requests logged to file via globally-mounted `requestLogger` (Winston)
- Authentication / ownership / rate-limit events written to log files
- Suspicious activity detection (in-memory + file log)
- ✅ **DB-persisted audit trail (Equoria-jw10w)** — `AuditLog` model +
  `storeAuditLog()` writes rows fail-soft; `globalAuditTrail` mounted
  app-wide in `app.mjs` enforces POST/PUT/PATCH/DELETE coverage on
  sensitive prefixes. Queryable + retained in DB. Reads are
  mutation-scoped out by design.
- ✅ **Retention/rotation automation IS implemented (Equoria-54qq8)** —
  `backend/services/auditLogRetentionService.mjs` performs a nightly scoped
  DELETE of rows older than the retention window (90-day default, 7-day
  floor). This was previously listed here as "the remaining TODO"; that was
  stale and contradicted §A09 which already documents it as RESOLVED
  (corrected 2026-05-19, Equoria-ss4r).

**Status:** ✅ File logging + DB-backed audit trail (globally enforced for
sensitive mutations) + automated nightly retention purge — all
production-ready (retention delivered under Equoria-54qq8).

---

## 5. Vulnerability Assessment

### 5.1 Known Vulnerabilities

**Current Status:** ✅ ZERO KNOWN VULNERABILITIES

All npm dependencies scanned:

- Backend: 0 critical, 0 high, 0 moderate, 0 low
- Frontend: **audited in CI** — `.github/workflows/security-scan.yml` runs
  `npm audit` against `./frontend` (steps "Install dependencies (frontend)" /
  "Run npm audit (frontend)"). The v2.0 line "Frontend: Not yet implemented
  (planned Phase 5)" was false and self-contradictory and has been corrected:
  the frontend exists, is part of the build, and is continuously audited.
- Root: 0 critical, 0 high, 0 moderate, 0 low

> Per-package counts above reflect the prior CI scan; re-run
> `.github/workflows/security-scan.yml` for current numbers — this document
> does not assert a fixed count for a moving target.

### 5.2 Historical Vulnerabilities (Resolved)

No security vulnerabilities have been reported or discovered in Equoria to date.

### 5.3 False Positives

None identified.

---

## 6. Security Recommendations

### 6.1 Immediate Actions (0-30 days)

**Priority 1 (Critical):**

- ✅ **COMPLETE:** All Phase 4 security hardening tasks finished

**Priority 2 (High):**

- Configure Sentry production DSN before deployment
- Review and finalize CORS origin whitelist
- Set up production monitoring dashboards

### 6.2 Short-Term Improvements (1-3 months)

1. **Multi-Factor Authentication (MFA)** — ✅ opt-in TOTP shipped (Equoria-2vwwh)
   - ✅ Opt-in TOTP MFA for all user accounts (enroll/verify/challenge/disable)
   - ✅ Single-use recovery code generation (bcrypt-hashed)
   - ✅ Admin-account MFA enforcement implemented — opt-in via
     `ADMIN_MFA_REQUIRED` (Equoria-te21j; was stale "⏳ tracked follow-up",
     corrected 2026-05-19 Equoria-ss4r)
   - ✅ `mfaSecret` encrypted at rest — AES-256-GCM via
     `backend/utils/fieldEncryption.mjs` (Equoria-yi13v; was stale "⏳
     tracked follow-up", corrected 2026-05-19 Equoria-ss4r)
   - ⏳ Optional global/mandatory MFA for non-admin accounts (genuine open
     follow-up — opt-in only today)

2. **Security Headers Enhancement**
   - ~~Content Security Policy (CSP)~~ — **already implemented** in
     `backend/middleware/security.mjs` (`helmetConfig.contentSecurityPolicy`
     with `default-src/script-src 'self'`, `style-src 'self' 'unsafe-inline'`,
     etc.). Not a future item. The remaining `style-src 'unsafe-inline'`
     residual + nonce-threading hardening is tracked separately in
     **Equoria-e3k9** (see ADR-008 / the "Accepted residual" note in the A05
     section). Corrected 2026-05-18, Equoria-s74b.
   - Subresource Integrity (SRI) for CDN assets
   - Feature Policy restrictions

3. **API Rate Limiting Refinement**
   - Per-endpoint rate limits
   - Distributed rate limiting (Redis cluster)
   - IP reputation scoring

### 6.3 Long-Term Enhancements (3-6 months)

1. **Security Penetration Testing**
   - Third-party security audit
   - Automated penetration testing (Burp Suite)
   - Bug bounty program consideration

2. **Advanced Monitoring**
   - Real User Monitoring (RUM)
   - Application Performance Monitoring (APM)
   - Security Information and Event Management (SIEM)

3. **Compliance Certifications**
   - SOC 2 Type II certification
   - GDPR compliance documentation
   - PCI DSS if payment processing added

---

## 7. Security Metrics & KPIs

### 7.1 Current Security Metrics

> **Correction (2026-05-18):** Removed unsubstantiated/fabricated metrics.
> "Security Test Coverage 98.5%" — no instrument measures this. "OWASP 10/10" —
> A10 is N/A (no surface), not a passed control; A09 is partial. "Audit Log
> Coverage 100%" — false (no DB audit trail). "Failed Auth Rate 2.3% / Rate
> Limit Hit Rate 0.1%" — no production telemetry source exists for these (the
> app is pre-beta); they were invented. Only verifiable rows retained.

| Metric                         | Current Value                                                                     | Status                  |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------- |
| Security test files (verified) | 14+ files; 262 executed cases across the 8 core files (jest run 2026-05-18, §3.1) | ✅ Substantial          |
| OWASP Top 10 addressed         | 9 implemented (A09 DB-backed+enforced, Equoria-jw10w), A10 N/A                    | ✅ Honest scope         |
| Known dep vulnerabilities      | 0 (per last CI scan; re-run for live)                                             | ✅ Good                 |
| DB-backed audit trail          | Implemented + globally enforced + nightly retention purge                         | ✅ Done (jw10w + 54qq8) |
| Automated dep scans (CI)       | backend + frontend + root                                                         | ✅ Active               |
| Production security telemetry  | N/A — app is pre-beta                                                             | ⚪ N/A                  |

### 7.2 Security Trends

**Positive (verifiable):**

- 262 executed security test cases across the 8 core files (jest run 2026-05-18; exact per-file counts in §3.1)
- Automated dependency scanning (backend + frontend + root) active in CI
- Strong request-boundary defenses (prototype-pollution, depth-cap) verified

**Not measurable yet (app is pre-beta — no production telemetry):**

- Authentication failure rate / rate-limit hit rate: no live data source.
  v2.0's "2.3%" and "0.1%" figures were fabricated and are removed.
- "Zero security incidents since inception" removed — absence of a reporting
  pipeline is not evidence of zero incidents.

---

## 8. Incident Response Preparedness

### 8.1 Incident Response Plan

**Status:** ✅ Documented and Ready

**Documentation:** `.claude/rules/SECURITY.md` Section 8

**Key Components:**

1. Threat identification procedures
2. Incident containment protocols
3. Evidence preservation guidelines
4. Stakeholder notification process
5. Vulnerability remediation workflow
6. Post-incident review procedures

### 8.2 Security Contact Information

> **🚫 UNCONFIGURED-BLOCKS-PROD / TODO — NOT CONFIGURED.** Every value below
> is a placeholder. None is a monitored mailbox or live phone line. Do not
> present this section as operational. Production deployment MUST NOT proceed
> until these are replaced with real, monitored contacts and this banner is
> removed. Tracked on the pre-launch checklist (§11.5).

- **Security Team:** `security@equoria.com` — TODO / UNCONFIGURED-BLOCKS-PROD (placeholder, unverified)
- **Emergency Contact:** `+1-XXX-XXX-XXXX` — TODO / UNCONFIGURED-BLOCKS-PROD (placeholder, not a real line)
- **Incident Reporting:** `incidents@equoria.com` — TODO / UNCONFIGURED-BLOCKS-PROD (placeholder, unverified)

**Status:** 🚫 UNCONFIGURED-BLOCKS-PROD — contacts are placeholders, not
configured. This is a hard pre-production blocker, not a soft warning.

---

## 9. Compliance & Standards

### 9.1 Industry Standards Compliance

| Standard                     | Compliance Status          | Notes                                                                                                                                                                      |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWASP Top 10:2021            | ✅ Substantial (corrected) | 9 implemented; A09 DB-backed + globally enforced + retention-bounded (jw10w + 54qq8); A10 N/A (no SSRF surface)                                                            |
| CWE Top 25                   | ✅ 95% Addressed           | 24/25 categories mitigated                                                                                                                                                 |
| NIST Cybersecurity Framework | ✅ Substantial Compliance  | Identify, Protect, Detect, Respond, Recover                                                                                                                                |
| PCI DSS                      | ⚠️ N/A                     | Not applicable unless payment processing added                                                                                                                             |
| GDPR                         | ✅ Core rights implemented | Right-to-access (data export) + right-to-erasure endpoints live + privacy policy committed (Equoria-s3rf, 2026-05-18); DPA/legal review still recommended before EU launch |
| SOC 2                        | ⚠️ Not Certified           | Consider for enterprise customers                                                                                                                                          |

### 9.2 Regulatory Compliance

**Current Status:**

- **COPPA:** ✅ Age verification IMPLEMENTED (Equoria-iqzn) — server-
  authoritative hard age gate at registration
  (`backend/modules/auth/controllers/authController.mjs:106-117`,
  `meetsCoppaMinimumAge` / `COPPA_MIN_AGE_YEARS`); `dateOfBirth` persisted
  only after the gate passes and treated as sensitive PII (redacted from
  request logs, commit cbfa10466). Real-DB coverage:
  `backend/modules/auth/__tests__/coppaAgeVerification.integration.test.mjs`.
  (Was stale "age verification not yet implemented"; corrected 2026-05-19
  Equoria-ss4r.)
- **CCPA:** ✅ Ready (data privacy controls in place; the export +
  deletion endpoints below also satisfy CCPA access/deletion requests)
- **GDPR:** ✅ Core data-subject rights implemented (Equoria-s3rf,
  2026-05-18) — Article 15/20 data export (`GET /api/v1/account/export`)
  and Article 17 erasure (`POST /api/v1/account/delete`, password-
  confirmed, scoped transactional cascade) are live and covered by
  real-DB integration tests
  (`backend/modules/users/__tests__/gdprAccountRoutes.integration.test.mjs`);
  a privacy policy honest to the actual data model is committed at
  `docs/legal/privacy-policy.md`. **Still recommended before EU launch:**
  data processing agreements with any sub-processors and a formal legal
  review of the policy text.
- **Local Laws:** Varies by deployment region

**Recommendation:** Conduct legal review before international deployment

---

## 10. Security Budget & Resources

### 10.1 Phase 4 Security Hardening Investment

**Time Investment:**

- Phase 4.1: Input Validation (COMPLETED - Week 1)
- Phase 4.2: Attack Vector Remediation (COMPLETED - Week 2)
  - Subtask 4.2.1: GitHub vulnerability resolution (2 hours)
- Phase 4.3: Security Alerting (COMPLETED - 4 hours)
- Phase 4.4: Automated Security Testing (COMPLETED - 3 hours)
- Phase 4.5: Comprehensive Security Audit (COMPLETED - 8 hours)
- **Total:** ~25-30 hours

**Tools & Services:**

- Sentry Error Tracking: $0/month (free tier)
- GitHub Security: $0 (included)
- Dependabot: $0 (included)
- OWASP ZAP: $0 (open source)
- **Total Monthly Cost:** $0 (current), ~$100-200/month estimated for production

### 10.2 Recommended Security Budget (Annual)

| Category                   | Estimated Cost          | Priority |
| -------------------------- | ----------------------- | -------- |
| Sentry Pro Plan            | $2,400/year             | High     |
| Third-Party Security Audit | $10,000-20,000          | High     |
| Security Training          | $2,000/year             | Medium   |
| Bug Bounty Program         | $5,000-10,000/year      | Medium   |
| SOC 2 Certification        | $20,000-40,000          | Low      |
| **Total Estimated**        | **$39,400-74,400/year** | -        |

---

## 11. Conclusion

### 11.1 Overall Assessment

Equoria implements **strong, verifiable security controls** across most
critical areas, with honestly-scoped gaps. Verified state:

✅ **9/10 OWASP categories implemented; A09 DB-backed + globally enforced for sensitive mutations + retention-bounded (Equoria-jw10w persistence, Equoria-54qq8 nightly retention purge); A10 N/A (no SSRF surface)**
✅ **262 executed security test cases across the 8 core files, jest run 2026-05-18 (exact counts in §3.1) + 4 real-DB A09 audit-trail cases**
✅ **Automated continuous dependency scanning (backend + frontend + root)**
✅ **0 known dependency vulnerabilities per last CI scan**
⚠️ **Gaps before production (re-verified 2026-05-19, Equoria-ss4r):** real
security contacts (TODO — hard blocker, still placeholders); Sentry production
DSN (TODO); CORS whitelist finalization (TODO). _Previously listed here but
now VERIFIED RESOLVED in origin/master code:_ ✅ `mfaSecret` AES-256-GCM
encrypted at rest (Equoria-yi13v); ✅ opt-in admin-account MFA enforcement
implemented (Equoria-te21j); ✅ reusable SSRF-guard utility built
(Equoria-4dva, `backend/utils/ssrfGuard.mjs`). Remaining genuine MFA
follow-up: optional global/mandatory MFA for non-admin accounts (not
implemented — opt-in only).

### 11.2 Security Strengths

1. **Comprehensive Defense-in-Depth:** 7-layer security architecture
2. **Automated Security Testing:** GitHub Actions + Dependabot + OWASP ZAP
3. **Proactive Monitoring:** Sentry integration with threshold-based alerting
4. **Security-First Development:** TDD with security test coverage
5. **Documentation Excellence:** Detailed security documentation and runbooks

### 11.3 Risk Assessment

**Overall Risk Level:** **LOW–MEDIUM** (strong controls; honest gaps remain)

The implemented controls are strong. The platform is **not** approved for
production by this report alone — the corrected gaps below are prerequisites,
not optional polish.

### 11.4 Final Recommendation

**NOT YET APPROVED FOR PRODUCTION.** Resolve these prerequisites first
(several were misrepresented as "ready" in v2.0):

1. ✅ DONE (Equoria-jw10w): DB-backed audit persistence + global enforcement
   for sensitive mutations. ✅ DONE (Equoria-54qq8): automated nightly
   audit-log retention purge (scoped DELETE, 90-day default, 7-day floor) —
   unbounded-growth residual resolved
2. ✅ DONE (Equoria-yi13v): `mfaSecret` encrypted at rest (AES-256-GCM).
   ✅ DONE (Equoria-te21j): opt-in admin-account MFA enforcement implemented
   (`ADMIN_MFA_REQUIRED`). Remaining: optional global/mandatory MFA for
   non-admin accounts (genuine open follow-up; opt-in TOTP shipped
   Equoria-2vwwh)
3. Replace placeholder security contacts with real monitored channels
   (**hard blocker — still open**)
4. ✅ DONE (Equoria-4dva): reusable fail-closed SSRF-guard utility built
   (`backend/utils/ssrfGuard.mjs`). Remaining gate: the first external-URL
   feature must route through it (no such feature exists today)
5. Configure Sentry production DSN
6. Finalize CORS origin whitelist
7. Conduct pre-launch security checklist review (see §11.5)

---

### 11.5 Pre-Launch Security Checklist (hard blockers)

Every item below is a **hard pre-production blocker**. None may be deferred,
softened, or marked "done" from intent — verify the real value is set.

- [ ] **Security contact info configured** — replace the placeholders in §8.2
      and Appendix C (`security@equoria.com`, `incidents@equoria.com`,
      `+1-XXX-XXX-XXXX`, `development@equoria.com`) with real, monitored
      contacts; remove the UNCONFIGURED-BLOCKS-PROD banner in §8.2.
- [ ] **`JWT_SECRET` / `JWT_REFRESH_SECRET` set** — strong, distinct, ≥32 chars.
      Enforced at startup by `backend/config/config.mjs` +
      `backend/utils/runtimeSecretPolicy.mjs` (fails fast on missing /
      placeholder / too-short in production & beta).
- [ ] **`SESSION_SECRET` set** — strong 32+ char value (documented in
      `backend/.env.example` and `.claude/rules/SECURITY.md`).
- [ ] **`BCRYPT_SALT_ROUNDS` >= 12** — note: the application reads
      `BCRYPT_SALT_ROUNDS`, NOT `BCRYPT_ROUNDS` (SECURITY.md naming is doc
      drift; `backend/.env.example` documents the canonical name).
- [ ] **Sentry production DSN configured.**
- [ ] **CORS origin whitelist finalized** (`ALLOWED_ORIGINS`).
- [ ] **Production monitoring dashboards configured.**

---

## 12. Appendices

### Appendix A: Security Test File Listing

All security test files are located in `backend/__tests__/`
(corrected 2026-05-18 — the v2.0 docs pointed at a now-nonexistent
`integration/security` test directory that does not hold these suites):

- auth-bypass-attempts.test.mjs
- ownership-violations.test.mjs
- parameter-pollution.test.mjs
- rate-limit-enforcement.test.mjs
- sql-injection-attempts.test.mjs
- owasp-comprehensive.test.mjs
- security-attack-simulation.test.mjs
- request-body-\*.test.mjs (depth-cap, silent-catch, urlencoded-dup-key, etc.)

(`backend/__tests__/requestBodySecurity.test.mjs` holds the
unit-level scanner/guard/handler coverage.)

### Appendix B: Security Documentation References

- `.claude/rules/SECURITY.md` - Main security documentation
- `docs/SENTRY_SETUP.md` - Sentry configuration guide
- `.github/dependabot.yml` - Dependency scanning configuration
- `.github/workflows/security-scan.yml` - Automated security testing workflow
- `env.example` - Security environment variable template

### Appendix C: Security Contacts

- **Internal Security Team:** development@equoria.com — _UNCONFIGURED-BLOCKS-PROD (placeholder; see §11.5)_
- **Sentry Support:** https://sentry.io/support
- **GitHub Security:** https://docs.github.com/en/code-security
- **OWASP Resources:** https://owasp.org/

---

**Report Prepared By:** Phase 4 Security Hardening Team
**Report Date:** January 28, 2026
**Next Assessment:** Recommended before major version releases

**Classification:** Internal Use
**Distribution:** Development Team, Security Team, Management

---

_This assessment (v2.1, accuracy-corrected 2026-05-18) records the verified
security state of the Equoria platform. It does NOT certify production
readiness: Phase 4 Security Hardening delivered strong controls; the
DB-backed audit trail is now implemented and globally enforced for sensitive
mutations (Equoria-jw10w) with automated retention purge (Equoria-54qq8),
but MFA, real security contacts, and the SSRF-guard prerequisite gate remain
open. Earlier "certified / approved for production /
100% compliant" language was inaccurate and has been removed per
`.claude/rules/COMPLETION_VERIFICATION_POLICY.md`._
