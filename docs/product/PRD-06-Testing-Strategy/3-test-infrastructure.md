# 3. Test Infrastructure

> **Updated 2026-06-10:** removed the "Prisma Mock" stack row and the isolated `equoria_test` connection-string example — both contradicted the real-DB doctrine (§1.1). Added execution profiles and the worker/connection-budget status.

### 3.1 Backend Test Stack

| Tool                    | Purpose                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Jest                    | Test framework (ESM via `--experimental-vm-modules`)                                           |
| Supertest               | API endpoint testing against the real Express app                                              |
| Canonical PostgreSQL DB | All tests — unit-style and integration — run against the real database via `backend/.env.test` |
| Fixture helpers         | `createTestHorse.mjs` / `fixtureColor.mjs` — scoped fixtures + ID-scoped cleanup               |

### 3.2 Frontend Test Stack

| Tool                  | Purpose                |
| --------------------- | ---------------------- |
| Vitest                | Test framework         |
| React Testing Library | Component testing      |
| Playwright            | E2E browser automation |
| Storybook             | Component development  |
| axe-core              | Accessibility testing  |
| Lighthouse CI         | Performance testing    |

### 3.3 Test Environment Setup

**Backend database:** `backend/.env.test` points `DATABASE_URL` at the **canonical Equoria database** (user decision — see §1.1). There is no isolated `equoria_test` database locally; CI provisions its own ephemeral Postgres service and replays the full migration chain into it. Consequences:

- Cleanup MUST be scoped (`where: { id: { in: collectedIds } }` or `name: { startsWith: 'TestFixture-' }`) and fail-loud. A bare `deleteMany()` wipes real game data and is forbidden.
- Fixtures coexist with real game state — never assert on relative position, counts, or leaderboard dominance.

**Execution profiles (current vs planned):**

- **Authoritative (current):** the pre-push hook's sequential sharded run — from `backend/`, 8 sequential shards of `node --max-old-space-size=4096 --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --shard=i/8 --retryTimes=1` (see `.husky/pre-push` for the rationale; sharding is a memory-bounding device, not parallelism).
- **Planned (`Equoria-fefh2.15` — not yet landed):** named npm profiles `test:backend:full` (authoritative local gate), `test:backend:ci` (coverage-equivalent CI config), `test:backend:targeted` (developer feedback only — never closure evidence), `test:backend:diagnostic` (metrics/log-heavy troubleshooting). Do not cite these as existing until fefh2.15 lands.

**Worker / DB-connection budgeting (under measurement, `Equoria-fefh2.15`):** the full suite run in parallel (`maxWorkers: '50%'`, Jest default config) currently produces widespread `fetchCsrf` setup timeouts; ~175 suites call `fetchCsrf` and ~205 import the full Express app, all sharing one real PostgreSQL database. The contention mechanism (pool multiplication, app-construction cost, DB locking, rate-limiter state, or fixture corruption) is **not yet measured** — it must be diagnosed with a worker-count matrix and process/DB metrics, not papered over with longer timeouts or retries.

**Setup/Teardown:**

```javascript
// Scoped, fail-loud — never broad clears against the canonical DB
const created = [];
afterAll(async () => {
  await cleanupTestHorses(prisma, created); // id-scoped, FK-ordered, throws on failure
});
```

### 3.4 Fresh-Database Migration Replay (added 2026-06-10)

Every DB-dependent CI workflow (Quality Gate db-preflight, cookie-auth backend job, ZAP schema setup) shares one prerequisite: `prisma migrate deploy` must apply the **complete migration chain from an empty database**. The 2026-06 incident class — a drift-reconciliation migration doing a bare `ADD CONSTRAINT` that succeeded on the drifted live DB but collided on fresh replay — blocked all three workflows at their shared bootstrap.

This is now guarded by `backend/__tests__/scripts/freshDbMigrationReplay.sentinel.test.mjs` (`Equoria-fefh2.14`): it replays the whole chain into a brand-new `equoria_replay_sentinel_*` database, verifies the horse and email-token FKs exist exactly once with the intended delete actions from `pg_constraint`, and includes a planted-violation test proving the sentinel fires on the defect class. Migrations that replace existing constraints must use `DROP CONSTRAINT IF EXISTS` + `ADD` (replace semantics), never a bare `ADD`.

---
