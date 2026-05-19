# Test Architecture Guide

**Skill:** `/test-architecture`
**Purpose:** Load testing strategy and patterns when writing or debugging tests

---

## When to Use This Skill

Invoke this skill when:

- Writing new test files
- Debugging test failures
- Improving test coverage
- Reviewing test patterns
- Setting up mocking strategy

---

## Testing Philosophy (Balanced Mocking)

### ✅ DO Mock

- External dependencies: Database, HTTP clients, Logger
- Third-party services: Email, payment processors
- File system operations

### ❌ DON'T Mock

- Business logic functions
- Pure algorithmic functions
- Internal utility modules
- Service layer logic (test with real implementations)

### Current Success Rates

- **Balanced mocking:** 90.1% (851/942 tests)
- **Over-mocking:** 1% (proven failure)
- **Pure functions:** 100% (no mocking needed)

---

## Test Taxonomy — Integration vs Controller-Harness (Equoria-esgj)

The word "integration" in a file name or `describe` block is a contract,
not decoration. It MUST mean: the test exercises the **real HTTP chain**
(supertest `request(app)`) through the real Express middleware pipeline
against the **real DB**. A test that drives a controller via a fake
`buildReq`/`buildRes` (or `createMockRequest`/`createMockResponse`)
object is a **controller-harness test** — it is unit-ish (no router, no
middleware, no body parsing, no auth/CSRF chain) and MUST NOT be named
or labeled "integration".

| Category | What it exercises | Naming | Cite as beta-readiness? |
|----------|-------------------|--------|--------------------------|
| HTTP integration | `request(app)` → real middleware → real controller → real DB | `*.integration.test.mjs`, `describe('… HTTP …')` | ✅ yes |
| DB / cross-module integration | real service + real Prisma, no HTTP | `*.integration.test.mjs` (DB-integration sense) | ✅ yes |
| Controller-harness | controller fn called with fake `buildReq`/`buildRes` | unit name (NO `.integration.`, NO `describe('integration')`) | ❌ never |

Rules:

- A controller-harness suite must live in a unit-named file and MUST NOT
  be cited as integration or beta-readiness evidence.
- If a suite needs integration credibility, convert it to supertest
  (`request(app)`) — do not relabel a harness as integration.
- See `conformationShowRoutesHttp.integration.test.mjs` (lines ~136–144)
  for the canonical comment documenting why the harness is rejected in
  favor of a real HTTP pipeline test.
- Audit command (should return zero offenders):
  `grep -rliE "describe\(\s*['\"\`][^'\"\`]*integration" backend --include="*.test.mjs"` then
  cross-check each hit has `supertest`/`request(app)` or is real-DB
  service integration.

The buildReq/buildRes harness sweep (Equoria-esgj, 2026-05-19) found
**zero** mislabeled offenders remaining — prior remediation landed in
commits `8d33b6b3c` (conformationShowExecution reclassify) and
`e14ed1351` (21r-5 mock-heavy integration reclassify). This section
locks the taxonomy so the class cannot silently regress.

---

## Quick Test Commands

```bash
# Run specific test suite
npm test -- auth

# Watch mode for active development
npm test -- --watch

# Coverage report
npm test -- --coverage

# Debug memory leaks
npm test -- --detectOpenHandles
```

## Accessibility Testing (Equoria-yhg0g, UX spec 13.4)

Automated a11y is enforced by `tests/e2e/accessibility.spec.ts` using
`@axe-core/playwright` (pinned `4.11.3`, root devDep). It runs as its own
Playwright project, `a11y`, so it can be a standalone CI gate without
double-running in the chromium/firefox/webkit lanes:

```bash
npx playwright test --project=a11y
```

- **Real auth, real backend.** Authenticated surfaces log in with the
  real-credential helper (`tests/e2e/helpers/credentials.ts` /
  `global-setup.ts`). NO bypass headers, NO `x-test-user`, NO route
  interception — conforms to CLAUDE.md Testing Philosophy + 21R doctrine.
  It is a real runnable suite (no `test.skip` on beta surfaces).
- **Surfaces covered:** `/login`, `/register` (public), and authenticated
  `/` (Home hub), `/world` (World Hub), `/stable` (horse list),
  `/horses/:id` (horse detail), `/training` (core action page).
- **Threshold (deliberate, documented).** The suite FAILS on axe
  `critical` and `serious` violations. `moderate`/`minor` are reported
  (attached + logged) but do NOT fail the build *yet*. Rationale: a brand-new
  gate over an existing codebase must be adoptable — critical+serious catches
  the WCAG-impactful regressions (missing labels, contrast, broken ARIA,
  focus traps) without forcing a "make it green" weakening over pre-existing
  moderate noise. Raise the threshold once the moderate backlog is filed and
  burned down. This is a posture decision per
  `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` §6 — not a skipped/silenced
  assertion: a regression that introduces a critical/serious violation on any
  covered page genuinely fails this suite (sentinel-verified).

---

**Load full testing docs:**

```bash
cat backend/.claude/docs/testing-architecture.md
```
