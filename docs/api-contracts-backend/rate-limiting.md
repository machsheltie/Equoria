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
| Training       | 120 failed requests | 1 minute   |
| Competition    | 1000 entries        | 5 minutes  |
| Breeding       | 300 operations      | 5 minutes  |
| Foal           | 300 actions         | 1 minute   |
| Mutation       | 600 requests (prod) | 1 minute   |
| Financial      | 1000 mutations      | 15 minutes |
| Query          | 5000 requests       | 15 minutes |
| Global (/api/) | 10000 requests      | 15 minutes |

Owner ruling 2026-10-27: players enter hundreds of shows and move around the game all
day; the earlier caps (global 100, query 100 per 15 minutes) locked the owner out
during ordinary play.

These rows intentionally preserve the exact source-to-document assertions in
the drift sentinel. They are selected limiter defaults, not a complete list:
global, profile, query, admin, test, beta, beta-readiness, and explicit E2E
ceilings must be read from current source. Authentication, breeding,
competition, and financial limiters fail closed when Redis is unexpectedly
unavailable; confirm the current per-limiter posture before changing any
fallback behavior.
