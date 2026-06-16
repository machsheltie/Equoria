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

**Execution profiles:**

- `test:backend:full` — authoritative local/pre-push gate; 8 sequential fresh-process shards.
- `test:backend:ci` — CI base command with fixed two-worker capacity and Jest JSON output.
- `test:backend:targeted` — developer feedback only; never closure evidence.
- `test:backend:diagnostic` — fixed-worker run with PostgreSQL/process metrics.

**Worker / DB-connection budgeting (`Equoria-fefh2.15`):** the measured defect was lifecycle ordering, not slow CSRF. Per-file cleanup in `tests/setup.mjs` could run before suite-owned `afterAll` cleanup, which then reconnected Prisma and left one idle session per file. A clean two-worker baseline reached 101 connections; after moving cleanup to `PrismaCleanupEnvironment.teardown()`, the same run peaked at 8. Default Jest workers are capped at 6 with a three-connection Prisma pool (18 budgeted connections); doctrine enforces the profile, hook, CI, and capacity contract.

**Setup/Teardown:**

```javascript
// Scoped, fail-loud — never broad clears against the canonical DB
const created = [];
afterAll(async () => {
  await cleanupTestHorses(prisma, created); // id-scoped, FK-ordered, throws on failure
});
```

The custom Jest environment disconnects Prisma after this suite-owned hook
finishes. Suites must not perform their own final shared-client disconnect.

### 3.4 Fresh-Database Migration Replay (added 2026-06-10)

Every DB-dependent CI workflow (Quality Gate db-preflight, cookie-auth backend job, ZAP schema setup) shares one prerequisite: `prisma migrate deploy` must apply the **complete migration chain from an empty database**. The 2026-06 incident class — a drift-reconciliation migration doing a bare `ADD CONSTRAINT` that succeeded on the drifted live DB but collided on fresh replay — blocked all three workflows at their shared bootstrap.

This is now guarded by `backend/__tests__/scripts/freshDbMigrationReplay.sentinel.test.mjs` (`Equoria-fefh2.14`): it replays the whole chain into a brand-new `equoria_replay_sentinel_*` database, verifies the horse and email-token FKs exist exactly once with the intended delete actions from `pg_constraint`, and includes a planted-violation test proving the sentinel fires on the defect class. Migrations that replace existing constraints must use `DROP CONSTRAINT IF EXISTS` + `ADD` (replace semantics), never a bare `ADD`.

---
