# Pre-existing flakes

## 21R-SEC-3-REVIEW-2-ADJ-1: Pre-existing DB test-isolation flake exposed by Jest suite reordering
type: bug
priority: 1
labels: test-quality, db-isolation, flake
description: |
  Adding any new test file to the security suite causes non-deterministic failures in OTHER DB-touching test files. This is a pre-existing flake unmasked by REVIEW-2's new boundary suite.

  REPRODUCTION:
  - Run npm run test:security at HEAD with __tests__/integration/security/request-body-depth-cap-boundary.test.mjs added.
  - Observed: 1 to 28 tests fail in different suites on consecutive runs (sessionManagement.test.mjs, owasp-comprehensive.test.mjs, etc).
  - Run npm run test:security at HEAD WITHOUT the boundary file: 109/109 suites, 2452/2452 tests pass cleanly.
  - Run the failing suites in isolation: pass.

  EVIDENCE OF FLAKINESS:
  - Run 1 with boundary file: 1 failure in sessionManagement.test.mjs:299 (FK violation on prisma.refreshToken.create).
  - Run 2 with boundary file: 28 failures in owasp-comprehensive.test.mjs.
  - Different suites fail on each run — classic test isolation flake.

  ROOT CAUSE HYPOTHESIS (unverified):
  - Adding a new test file changes Jest's suite ordering. Some pre-existing DB test pair has a latent isolation defect (one suite leaks state into another's setUp). Until reordering, the leaky pair never collided.
  - Likely candidates: the global setup.mjs cleanupDatabase() function only fires when TEST_DB_RESET_PER_TEST=true, which is not set by default. Tests rely on unique-id collision avoidance for isolation — works most of the time but breaks when timing shifts.

  WHY NOT FIXED IN REVIEW-2:
  - REVIEW-2's scope is depth-cap boundary tests + symmetric depth counting — no DB touched.
  - The flake is pre-existing; REVIEW-2 only exposed it via suite reordering. Per EDGE_CASE_FIX_DISCIPLINE §7 (no bundling) and OPTIMAL_FIX_DISCIPLINE §3 (file separate issues for adjacent occurrences), this defect deserves its own investigation.

  WHAT REVIEW-2 SHIPPED:
  - 19 boundary tests in __tests__/integration/security/request-body-depth-cap-boundary.test.mjs.
  - All 19 pass in isolation.
  - Document the depth-counting contract in middleware/requestBodySecurity.mjs.

acceptance: |
  - Identify the pre-existing test pair causing DB state leak (likely involves users / refresh_tokens / OWASP fixtures).
  - Either: (a) add per-test cleanup with TEST_DB_RESET_PER_TEST=true semantics scoped to the leaky suite, OR (b) fix the underlying isolation defect (e.g., scope unique-id generation tighter, ensure user.create completes before refreshToken.create), OR (c) configure Jest test sequencer to deterministically isolate DB-touching suites.
  - Verify: npm run test:security passes deterministically across at least 5 consecutive runs with both boundary and non-boundary files present.
  - No test.skip, no continue-on-error, no graceful-skip patterns used to mask the flake.
  - Verification log appended showing: 5 consecutive green runs + the specific isolation fix applied.
