---
paths:
  - "backend/middleware/rateLimiting.mjs"
---

# Security Compatibility Projection

**Status:** Active compatibility projection
**Owner:** Backend rate-limiting subsystem
**Last verified:** 2026-08-19
**Load only when:** `backend/middleware/rateLimiting.mjs` is read or its drift sentinel is intentionally reviewed
**Do not load for:** General security, authentication, authorization, compliance, product, or implementation work
**Live sources:** `backend/middleware/rateLimiting.mjs`, `docs/api-contracts-backend/rate-limiting.md`, and `backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs`
**Retire when:** The drift sentinel no longer reads `.claude/rules/SECURITY.md`

This path remains only because an executable compatibility test reads it. It is
not a security handbook and makes no claim that Equoria is secure, compliant,
production-ready, or complete.

The authentication limiter currently permits **200 failed login attempts per
15 minutes** and does not count successful authentication requests
(`skipSuccessfulRequests: true`). Verify this statement against the live
middleware and the narrow rate-limiting contract before changing either.

For security work, follow `CLAUDE.md`'s conditional loading matrix and read the
smallest applicable active contract plus live middleware, routes, services,
schema, configuration, and tests. Never infer security posture from this stub.
