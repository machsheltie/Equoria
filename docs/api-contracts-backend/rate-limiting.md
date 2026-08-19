# Rate Limiting

**Updated:** 2026-08-19
**Implementation authority:** `backend/middleware/rateLimiting.mjs` and the
mounting route/application source
**Drift gate:** `backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs`

Load this file only for rate-limit values, counting semantics, environment
overrides, Redis failure posture, limiter mounting, or the drift sentinel. It
does not describe endpoint authorization, gameplay cooldowns, or API response
contracts. Verify effective values in source because environment-specific and
E2E-only overrides exist.

| Endpoint Type  | Limit               | Window     |
| -------------- | ------------------- | ---------- |
| Authentication | 200 failed requests | 15 minutes |
| Training       | 20 failed requests  | 1 minute   |
| Competition    | 20 entries          | 5 minutes  |
| Breeding       | 10 operations       | 5 minutes  |
| Foal           | 15 actions          | 1 minute   |
| Mutation       | 30 requests (prod)  | 1 minute   |
| Financial      | 20 mutations        | 15 minutes |

These rows intentionally preserve the exact source-to-document assertions in
the drift sentinel. They are selected limiter defaults, not a complete list:
global, profile, query, admin, test, beta, beta-readiness, and explicit E2E
ceilings must be read from current source. Authentication, breeding,
competition, and financial limiters fail closed when Redis is unexpectedly
unavailable; confirm the current per-limiter posture before changing any
fallback behavior.
