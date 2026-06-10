# 1. Testing Philosophy

### 1.1 Real-Database Doctrine (rewritten 2026-06-10)

**CRITICAL:** The purpose of a test is to fail fast when the code is wrong. Anything that softens the failure signal — mocked dependencies, bypass headers, skipped beta paths, fixtures so artificial they're fiction — defeats that purpose. This section supersedes the former "balanced mocking" philosophy; the full doctrine lives in CLAUDE.md Constitution §3 ("Tests exist to detect real failures").

**The rules:**

- **Real DB only.** `backend/.env.test` points at the canonical Equoria database. This is the user's explicit choice — the risk of test/prod drift is real, but the alternative is testing fiction. Do not propose reverting to an isolated test database.
- **No mocks of Equoria-owned code.** Mocking our own database, services, or controllers is never acceptable. The narrow legitimate isolation boundary is third-party services Equoria doesn't own (none today). Enforced by `scripts/doctrine-checks/check-no-db-mocks.mjs` and `check-no-frontend-mocks.mjs`.
- **Scoped, fail-loud cleanup.** Fixtures use name patterns (`TestFixture-…`) or collected IDs; cleanup deletes only those rows, in FK order, and fails loudly instead of swallowing errors with `.catch(() => {})`. A bare `deleteMany()` against the canonical DB is forbidden. (The `legacyUserDelete` hardening under `Equoria-fefh2.16` is the worked example.)
- **Legacy frontend unit tests with mocked API responses** predate this doctrine and may remain; don't add new ones — write Playwright E2E coverage instead.

### 1.2 TDD Workflow (Red-Green-Refactor)

**Mandatory Approach:**

1. **RED** - Write failing test first
2. **GREEN** - Implement minimum code to pass
3. **REFACTOR** - Improve code quality
4. **REPEAT** - For each feature

```javascript
// Step 1: RED - Write failing test
describe('HorseBreeding', () => {
  it('should create offspring with correct genetics', () => {
    const offspring = breedHorses(sireId, damId);
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});

// Step 2: GREEN - Implement validation
function breedHorses(sireId, damId) {
  // Minimal implementation to pass test
}

// Step 3: REFACTOR - Improve (if needed)
// Step 4: REPEAT - Next test
```

### 1.3 Infrastructure Failure vs Product Failure (added 2026-06-10)

A red test run is a signal — but two different kinds of signal, and conflating them produces both false alarms and false confidence:

- **Product failure:** the code under test is wrong (e.g. the `Equoria-lax36` Bearer-header CSRF issue/validate asymmetry — a deterministic production defect that a red suite correctly exposed).
- **Infrastructure failure:** the execution environment is wrong (e.g. the 2026-06 fresh-database migration-replay collision that blocked CI workflows before any test ran, or the still-undiagnosed parallel-Jest `fetchCsrf` timeout wave, `Equoria-fefh2.15`).

Every red signal must be classified as one or the other before remediation. Do not treat every red workflow as an application defect, and do not treat a green targeted run as proof the infrastructure is healthy. Hiding infrastructure failures with longer timeouts, retries, or skips is forbidden — diagnose the contention, then fix the architecture.

---
