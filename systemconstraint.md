# Infrastructure, Tooling & Testing Constraints

## 1. Allowed & Forbidden Infrastructure

- ALLOWED HOSTING / BACKEND SERVICES:
  - Netlify (frontend hosting, build, serverless functions if applicable)
  - Railway (backend services/deployments)
  - Supabase (current database provider; actively in use for the next month)
- STRICTLY FORBIDDEN:
  - Docker / Docker Compose / local containerization (run all tasks natively on the OS via standard package manager scripts like npm/node).
  - Sentry / Datadog / New Relic / external telemetry SaaS (never recommend, add, or require accounts/DSNs for error monitoring or gating).
  - Any new paid SaaS or cloud subscriptions not explicitly listed under Allowed.

## 2. Real Functionality Over Mocking

- Avoid mocking application logic, database queries, or core functionality wherever a real test can be executed.
- Tests must validate actual behavior, edge cases, and data integrity. Do NOT write tautological tests that simply assert a mock returns what the mock was told to return.
- Only mock genuine external third-party network boundaries (e.g., calling an external payment API or third-party webhooks) when live sandbox credentials are not available.
- If testing against the database, use real database connections/fixtures (or a dedicated local test instance) rather than mocking out database drivers.

## 3. Local Gate & Concurrency Rules

- Gating, testing, and multi-window runs must NEVER rely on external SaaS signals or remote DSNs.
- If concurrent terminal windows or processes cause machine load or test contention:
  - Address the root timing/concurrency issue in the test itself (e.g., proper async resolution, isolated test records/tables).
  - Use simple local filesystem locking (e.g., `.gate.lock`) or sequential checks to coordinate runs.

  ## 4. Test Integrity & Anti-Tampering (ZERO TOLERANCE)

- **NEVER modify an existing test to make it pass.** If a test is failing, fix the underlying application code, data flow, or schema.
- **NEVER soften or delete assertions.** You may not comment out assertions, weaken strict checks (e.g., replacing exact value checks with `toBeDefined()`), or artificially skip tests (`test.skip`, `xit`) to achieve a clean run.
- **NEVER replace real execution with mocks to bypass failures.** Mocks are strictly limited to external network boundaries where live access is impossible. You may NOT mock internal state, internal functions, or database queries simply because they are failing or timing out.
- The goal is finding and resolving real application errors. A green test suite achieved by altering the test suite's expectations is considered a catastrophic failure.

## 5. Self-Modification Forbidden

- Claude Code is strictly prohibited from editing, modifying, removing, or appending to `CLAUDE.md`, `systemconstraints.md`, or any repo-level instruction/rule files without explicit, typed user permission in that specific prompt.
