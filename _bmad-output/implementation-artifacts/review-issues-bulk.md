# 21R-SEC-3 / FOLLOW-1 Code Review Findings — Blocker Bundle

Filed as blockers on Equoria-expn (21R-SEC-3 depth cap) and Equoria-ixqg (21R-SEC-3-FOLLOW-1 fail-closed catch). Source: ultra-think bmad-code-review pass on the fix work for those two issues. Each finding is correctness-critical — passing tests do not equal correct code.

## 21R-SEC-3-REVIEW-1: env-var validation in REQUEST_BODY_MAX_DEPTH parse silently disables depth cap on garbage input
type: bug
priority: 0
labels: security, p0, 21r-sec-3, review-blocker
description: |
  At backend/middleware/requestBodySecurity.mjs:32 the depth cap is parsed as `const MAX_DEPTH = Number.parseInt(process.env.REQUEST_BODY_MAX_DEPTH ?? '32', 10)`. If the env var is set to a non-numeric value (`"high"`, empty string after trim, `"-5"`, `"NaN"`), the parse returns NaN. Every `if (depth > MAX_DEPTH)` comparison against NaN is false, so the cap silently does nothing and the entire defense regresses to the pre-fix state.

  This is the opposite of fail-closed and directly contradicts the doctrine for this story. An ops error or hostile env injection turns a P0 security control off without any signal.

  Fix: parse, validate (positive integer ≥ 1), and on failure log error + fall back to the hardcoded default 32. Throw at process boot if you want loud failure, or fall back silently with a logger.error so the cap stays on. Failing test FIRST: with REQUEST_BODY_MAX_DEPTH=invalid, the 64-deep payload still returns 400 nesting too deep.
acceptance: |
  - Failing test added FIRST in backend/__tests__/integration/security/ proving that with REQUEST_BODY_MAX_DEPTH set to a non-numeric or non-positive value, deeply nested payloads still return 400.
  - requestBodySecurity.mjs validates the parsed value: must be a positive integer. On invalid input, falls back to the hardcoded default (32) and emits logger.error with the offending value.
  - Existing 64-deep tests still pass.
  - Verification log appended to this issue with raw test output before and after the fix.
  - No try/catch swallowing, no test.skip, no continue-on-error, no AC weakening.

## 21R-SEC-3-REVIEW-2: depth-cap boundary tests missing + asymmetric depth-counting semantics between scanner and assertNoPollutingKeys
type: bug
priority: 1
labels: security, p1, 21r-sec-3, review-blocker
description: |
  Two related defects from the same root cause: the depth-cap test fixtures only exercise depth=64 (well above cap) and depth=16 (well below cap). There is zero test coverage at the boundary depth=32, depth=33, depth=31. Off-by-one regressions in either function would not be caught.

  Worse, JsonScanner.scanValue and assertNoPollutingKeys count depth differently. JsonScanner increments depth before recursing into objects and arrays from scanValue (so depth N means N nested containers above the current value). assertNoPollutingKeys increments depth on every recursion including descending into a primitive's parent key, so the same JSON input produces different `depth` values in the two functions. They both cap at MAX_DEPTH=32 but they do not reject the same payloads. A payload at the threshold could be rejected by one and accepted by the other.

  Fix: (1) add boundary tests at depth = MAX_DEPTH-1 (passes), MAX_DEPTH (passes), MAX_DEPTH+1 (rejects) for both an array body and an object body. (2) Unify the depth semantics so the two functions count the same thing — pick "number of container nestings above the leaf" and apply it to both.
acceptance: |
  - Failing tests added FIRST for both scanValue and assertNoPollutingKeys at depth=MAX_DEPTH-1, MAX_DEPTH, MAX_DEPTH+1, for both array and object structures. Confirm RED before fix.
  - Depth-counting semantics unified between the two functions. A given JSON input yields the same effective depth in both. Document the chosen semantics in a comment at MAX_DEPTH definition.
  - All boundary tests pass after fix.
  - 64-deep regression tests still pass.
  - Verification log appended.

## 21R-SEC-3-REVIEW-3: __TESTING_ONLY_JsonScanner export is a production back door
type: bug
priority: 1
labels: security, p1, 21r-sec-3-follow-1, review-blocker
description: |
  backend/middleware/requestBodySecurity.mjs exports `__TESTING_ONLY_JsonScanner` so the integration test can monkey-patch JsonScanner.prototype.scan to throw a non-AppError. The underscore prefix is a comment, not a guard. Any code in the running process — production, beta, anywhere the module is loaded — can `import { __TESTING_ONLY_JsonScanner } from .../requestBodySecurity.mjs` and then `JsonScanner.prototype.scan = () => {}` to silently disable the scanner for every subsequent request. The defense in depth this story adds can be turned off by a single line in any file in the codebase, including a malicious dependency or compromised npm package.

  Fix: gate the export behind `if (process.env.NODE_ENV === 'test')`, AND add an ESLint no-restricted-syntax rule so any non-test file importing the underscored binding fails lint, AND prefer changing the test approach to jest.spyOn (covered by REVIEW-4) so the export can be removed entirely.
acceptance: |
  - In requestBodySecurity.mjs, the __TESTING_ONLY_JsonScanner export is conditional on NODE_ENV=test (export is undefined in production, dev, beta).
  - Failing test added FIRST in backend/__tests__/integration/security/ that imports the binding under NODE_ENV=production and asserts it is undefined.
  - ESLint rule added under backend/.eslintrc to forbid importing __TESTING_ONLY_* from outside __tests__/.
  - Optional follow-on (handled by REVIEW-4): convert verify-json-body-fail-closed.test.mjs to jest.spyOn so the export can be removed entirely and the surface area shrinks.
  - All existing tests still pass.
  - Verification log appended.

## 21R-SEC-3-REVIEW-4: verify-json-body-fail-closed.test.mjs uses prototype monkey-patching, then we slapped --runInBand to hide the cross-test leak
type: bug
priority: 1
labels: security, p1, 21r-sec-3-follow-1, review-blocker, ci
description: |
  Two coupled defects. (1) backend/__tests__/integration/security/verify-json-body-fail-closed.test.mjs mutates `JsonScanner.prototype.scan` directly. afterEach restores it BUT only if the test reached the patch line; if the test or a beforeEach throws first, the patched prototype leaks into every subsequent test in the same Jest worker, silently corrupting the body parser for the rest of the run.

  (2) Instead of fixing the brittle test pattern, we added `--runInBand` to backend/package.json test:security and test:security:coverage scripts to serialize workers and avoid contention. This makes the security suite take ~3.5 minutes instead of ~78 seconds in CI, hides any genuine parallel race conditions in the production code, and is a textbook case of "fix the test, not the test environment."

  Fix: convert the monkey-patch to jest.spyOn(__TESTING_ONLY_JsonScanner.prototype, 'scan').mockImplementation(...) — Jest's spy infrastructure auto-restores in afterEach even on test failure. Then remove --runInBand from the security scripts and confirm the suite passes in parallel mode. Then proceed to REVIEW-3 to gate or remove the test-only export.
acceptance: |
  - verify-json-body-fail-closed.test.mjs converted to jest.spyOn; no direct prototype mutation remains.
  - --runInBand removed from backend/package.json test:security and test:security:coverage scripts.
  - npm run test:security passes in parallel mode (no isolated test passes that fail in full suite).
  - Wall-clock CI time for security suite recorded before and after — should drop back to ~80s.
  - Verification log appended.

## 21R-SEC-3-REVIEW-5: 16-deep depth-cap test has conditional assertion that silently passes when response body is missing
type: bug
priority: 1
labels: security, p1, 21r-sec-3, review-blocker, test-quality
description: |
  In backend/__tests__/integration/security/request-body-depth-cap.test.mjs around line 79, the 16-deep pass-through test reads:

      if (response.body && typeof response.body.message === 'string') {
        expect(response.body.message).not.toMatch(/nesting too deep/i);
      }

  If the response body is empty, undefined, or has no `message` field, the conditional is false and the assertion never runs — the test passes vacuously. This is a graceful-skip pattern of the kind explicitly forbidden by the 21R doctrine and EDGE_CASE_FIX_DISCIPLINE.md. A regression that returns an empty body for the 16-deep case would be silently green.

  Fix: drop the conditional. Assert affirmatively about what the response should be: status code is one of [400, 401, 422] (controller-level error, NOT depth-cap), AND if a body is returned then message must NOT match /nesting too deep/i. Remove the truthiness guard so missing-body becomes a test failure.
acceptance: |
  - Failing test added FIRST that proves the current conditional pattern allows a vacuous pass when the body is absent.
  - The 16-deep test rewritten to assert affirmatively (status in expected set, body shape constrained, no conditional skip on missing fields).
  - Test still passes for the legitimate pass-through case.
  - Verification log appended.

## 21R-SEC-3-REVIEW-6: cargo-cult ESM mock-path pattern across 14 test files needs canonical mapping
type: bug
priority: 1
labels: review-blocker, test-quality, esm
description: |
  During SEC-3 work we discovered that 14 test suites had mock paths broken by ESM module-resolution semantics — Jest resolves jest.unstable_mockModule paths relative to setupFilesAfterEach (`__tests__/setup.mjs`), not relative to the test file. We fixed each file by hand-writing the path relative to setup.mjs. This is fragile: any future test added in those directories will silently work in parallel mode but break on relocation, and any future restructure will re-break all 14.

  Fix: configure jest moduleNameMapper or a project-wide alias so mock paths use a canonical project-root form (e.g., `@/db/index.mjs` or `<rootDir>/backend/db/index.mjs`) and Jest resolves them deterministically regardless of which file is doing the mocking. Then refactor the 14 files to use the canonical form and remove the relative-to-setup hack.
acceptance: |
  - Jest config (backend/jest.config.mjs and any sub-configs) updated with moduleNameMapper or equivalent so mock paths resolve from a single canonical root.
  - All 14 currently-fixed files migrated to the canonical form.
  - Spot-check at least one new failing test added under a fresh path to prove the canonical form works there too.
  - All tests pass after migration.
  - Verification log appended.

## 21R-SEC-3-REVIEW-7: stale .js extensions in dynamic imports / require-equivalents need a sweep
type: bug
priority: 1
labels: review-blocker, esm
description: |
  During SEC-3 we hit one stale `.js` extension in backend/modules/traits/controllers/traitController.mjs:307. This was caught only because a specific test path exercised it. The codebase is supposed to be ESM-only with explicit `.mjs` extensions everywhere — any leftover `.js` import is either a latent ESM resolution failure waiting for someone to hit that code path, or a dead reference that survived a rename.

  Fix: grep across backend/ for `.js'` and `.js"` in import/await import contexts (excluding node_modules and prisma generated code), enumerate hits, and fix each one. Add a custom ESLint rule to forbid `.js` extensions in import paths under backend/ (allow only `.mjs` and bare specifiers).
acceptance: |
  - Audit grep output appended to this issue showing every match across backend/ excluding node_modules.
  - Each remaining match either fixed (.js → .mjs) or annotated with a one-line comment explaining why .js is correct (e.g., a JSON file).
  - ESLint rule added to backend/.eslintrc forbidding .js extensions in import statements.
  - All tests still pass after sweep.
  - Verification log appended.

## 21R-SEC-3-REVIEW-8: depth audit measured source brackets, not runtime JSON depth — re-audit needed
type: bug
priority: 1
labels: security, p1, 21r-sec-3, review-blocker, test-quality
description: |
  backend/__tests__/helpers/check-depth.mjs measures the maximum bracket-nesting depth in source files (`{` and `[` characters in the file text). The 21R-SEC-3 audit cited this script's output ("max depth in tree is 14") as evidence that the 32 cap is safe.

  This is the wrong measurement. Source-code bracket depth in a JS file (object literals, function bodies, JSX) has nothing to do with the depth of a JSON value posted to the backend at runtime. A test fixture at `__tests__/.../foo.test.mjs` might POST a JSON object built up programmatically that exceeds 32 levels even though the source is flat. The audit gives false reassurance.

  Fix: write a runtime audit that scans actual JSON fixtures (test JSON files, request payload literals in tests, supertest `.send()` arguments) and measures the parsed JSON tree depth. Re-run the audit and append the real output to Equoria-expn. If any legitimate fixture exceeds 32, raise the cap (with security review) or refactor the fixture.
acceptance: |
  - New script backend/__tests__/helpers/audit-runtime-json-depth.mjs that walks backend/ test fixtures and measures parsed JSON depth (not source bracket depth).
  - Old check-depth.mjs deleted or repurposed with a clear comment that it measures source-only.
  - Re-run audit; full output appended to this issue and to Equoria-expn.
  - If max runtime depth is < 32, cite the new audit. If ≥ 32, escalate.
  - Verification log appended.
