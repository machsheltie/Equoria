# Feed System Redesign — Session 2 Handoff

**Last updated:** 2026-04-30
**Last commit on branch:** `1a52c9eb` (A6 bulk purchase endpoint)
**Branch:** `fix/21r-security-hardening-corrected` (ephemeral, no upstream — Equoria's standard pattern)
**Plan:** `docs/superpowers/plans/2026-04-29-feed-system-redesign.md`
**Spec:** `docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md`

---

## How to start the next session

Paste this to the agent at the start:

> Continue the feed system redesign implementation from `docs/superpowers/plans/2026-04-29-feed-system-redesign.md` using the **subagent-driven-development** workflow. Read the handoff doc at `docs/superpowers/plans/2026-04-29-feed-system-handoff-session2.md` first — it has the session-1 lessons learned, completed tasks, and the integration-test patterns that work. Last commit was `1a52c9eb`. Next task is **A7** (equip-feed / unequip-feed endpoints).

The agent will invoke `superpowers:subagent-driven-development` itself when needed. There is no `/superpowers` slash command — `superpowers:` is a skill namespace, not a CLI prefix. Skills are invoked via the agent's Skill tool, not by you typing slash commands.

---

## Session 1 — what's done

**Phase A backend foundation (6/18 + 2 prep) — feed loop core:**

| Task                                  | bd ID          | Commit                 | Notes                                                                                 |
| ------------------------------------- | -------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| Drift resolution                      | `Equoria-qzyy` | `fd6b55eb`             | ✅ closed by user. Resolved migration drift in dev DB before feed_phase_a could land. |
| A1: schema migration                  | `Equoria-gt81` | `7b9eac51`, `461f9628` | drop coordination/currentFeed/energyLevel; add equippedFeedType.                      |
| A2: coordination cleanup              | `Equoria-no8o` | `de749058`             | All 12 sites cleaned. Dressage formula now uses `obedience`.                          |
| A3: getFeedHealth helper              | `Equoria-k9oj` | `38815aac`             | Pure functions; 11 tests.                                                             |
| A4: getVetHealth + getDisplayedHealth | `Equoria-frpw` | `26032b56`             | Combined health model α; 24 tests.                                                    |
| Test DB migration                     | `Equoria-hnzt` | DB-only                | Reset test DB to apply feed_phase_a; 34 previously-failing tests pass.                |
| A5: replace FEED_CATALOG              | `Equoria-p7yn` | `6a199abe`             | 5-tier catalog.                                                                       |
| A6: bulk purchase endpoint            | `Equoria-g4a3` | `1a52c9eb`             | First real DB integration endpoint; 7 tests.                                          |

**Awaiting user closure:** all 7 bd issues above (`gt81`, `no8o`, `k9oj`, `frpw`, `hnzt`, `p7yn`, `g4a3`). Per `COMPLETION_VERIFICATION_POLICY.md`, the user closes — agent does not.

**Other bd issues filed (not yet started):**

- **Reconcile 5-way stat-list drift** — pre-existing tech debt across `HORSE_STATS`, `validStats`, `VALID_HORSE_STATS`, `statNames` arrays in 5 files. `awardHorseXp({ statName: 'strength' })` currently throws. Surfaced during A2 review. Not a blocker for the feed-system plan.

---

## Critical lessons learned (read before A7)

These weren't in the original plan and burned time when the implementer hit them. Bake them into A7+ subagent prompts.

### 1. User fixture for tests requires `firstName` + `lastName`

The plan's example test code does:

```js
prisma.user.create({ data: { email, username, password, money, settings } });
```

This fails with `PrismaClientValidationError: Argument firstName is missing`. Fix:

```js
prisma.user.create({
  data: {
    email: `unique-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
    username: `unique${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    password: 'irrelevant-test-hash',
    firstName: 'Test',
    lastName: 'User',
    money: 1000,
    settings: {},
  },
});
```

### 2. JWT auth helper is `generateTestToken`, not `generateAuthToken`

The plan said `generateAuthToken(user)` — that helper doesn't exist. The real helper:

```js
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
```

Note path: helper lives in `backend/tests/helpers/authHelper.mjs` (legacy `tests/` directory, not `__tests__/helpers/`).

### 3. CSRF protection on all POST endpoints

`authRouter` (where all `/api/*` and `/api/v1/*` endpoints live) applies `csrfProtection`. POST requests need a real CSRF cookie + header pair. Use:

```js
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
const csrf = await fetchCsrf(app);

const res = await request(app)
  .post('/api/feed-shop/purchase')
  .set('Origin', 'http://localhost:3000')
  .set('Authorization', `Bearer ${token}`)
  .set('Cookie', csrf.cookieHeader)
  .set('X-CSRF-Token', csrf.csrfToken)
  .send({ feedTier: 'basic', packs: 1 });
```

`fetchCsrf` is at `backend/tests/helpers/csrfHelper.mjs`. Returns `{ csrfToken, csrfCookie, cookieHeader }`. The `cookieHeader` is an array suitable for `.set('Cookie', ...)`.

### 4. authRouter is mounted at BOTH `/api` and `/api/v1`

`app.use('/api/v1', authRouter); app.use('/api', authRouter);` — so both paths work.

### 5. Migration drift is a real risk on this branch

The branch had pre-existing drift in BOTH dev DB and test DB. We resolved both this session (commits `fd6b55eb` for dev; test DB was reset). If migration commands behave oddly in the next session, the answer is to compare:

- `npx prisma migrate status` (says clean / dirty)
- `npx prisma migrate diff --from-url <db> --to-schema-datamodel schema.prisma --script` (raw DDL needed)
- `_prisma_migrations` table contents (via direct query)

If they diverge, follow the same approach commit `fd6b55eb` did: catch-up migration files + `prisma migrate resolve --applied`, possibly direct DELETE on orphan rows in `_prisma_migrations`.

### 6. The dev DB had refresh tokens purged during drift resolution

The hash_refresh migration ran for real on dev DB during drift cleanup, which **purged all rows** in `refresh_tokens` and `email_verification_tokens`. If you (the user) try to log into the dev environment, you'll need to log in fresh.

### 7. Pre-existing working-tree state

The branch's working tree at session start had unrelated modifications from prior sessions (test files, package.json, etc.). Lint-staged may sweep them into commits if you `git add -A`. Always stage explicitly:

```bash
git add backend/path/to/specific/file.mjs
git status   # verify nothing extra is staged
git commit -m "..."
```

Two of session 1's commits (`fd6b55eb`, `de749058`) accidentally swept in 1-2 unrelated test fixture files. Acceptable on an ephemeral branch.

### 8. Don't run the full backend test suite

`npm test` (no flags) runs all 281 suites for ~8 minutes and surfaces ~14 baseline-flake suites unrelated to feed-system work. For verification, run targeted patterns:

```bash
npm test -- --testPathPattern="feedShopBulkPurchase" --no-coverage
npm test -- --testPathPattern="utils/horseHealth" --no-coverage
```

### 9. Subagent dispatch verbosity

Each implementer + spec reviewer + code quality reviewer dispatch consumes ~30-60K tokens. For pure mechanical tasks where the plan has the exact code (A3, A4, A5), the controller can do it directly to save context. Subagent dispatches matter when:

- Real DB integration is involved (A6+)
- Edge cases need exploration
- The plan's code didn't anticipate real-world quirks

### 10. The plan's prescribed code is approximate

In several places the plan code didn't compile exactly as written (missing imports, wrong helper names, missing user fields). The implementer should treat the plan as a strong starting draft, not a copy-paste source of truth. Always verify against the actual codebase.

---

## Phase A remaining (12 tasks)

**A7: equip-feed / unequip-feed endpoints** (NEXT)

- Pattern: very similar to A6 — POST endpoint, real DB, CSRF, JWT.
- The plan task body is at `docs/superpowers/plans/2026-04-29-feed-system-redesign.md` "### Task A7".
- Files to create: `backend/modules/horses/controllers/horseFeedController.mjs`, `backend/__tests__/integration/equipFeedEndpoint.test.mjs`.
- Routes: `POST /api/horses/:id/equip-feed`, `POST /api/horses/:id/unequip-feed`.
- Estimated: similar size to A6 (~1 implementer dispatch + 2 reviews).

**A8: POST /api/horses/:id/feed (full feed action)** — biggest task in phase A. Needs the service + controller + RNG + transaction.

**A9: stat-boost determinism tests** — service-level testing with injected RNG.

**A10: equippable view endpoint** — GET /api/horses/:id/equippable.

**A11: inject feedHealth/vetHealth/displayedHealth into horse JSON** — modify horse-read serializer(s).

**A12: critical-health gate on competition entry** — modify `enterConformationShow`.

**A13-A18: Frontend tasks** — sidebar, FeedShopPage rewrite, HorseEquipPage, HorseDetailPage Feed button, InventoryPage Feed category, Phase A E2E.

---

## Phase B remaining (6 tasks) — pregnancy mechanic

Depends on Phase A. The biggest task is B3: refactoring `createFoal` from instant foal creation to delayed (7-day) foaling. **Riskiest task in the plan** — read the existing `createFoal` at `backend/modules/horses/controllers/horseController.mjs:234-420` carefully before refactoring.

---

## Cleanup remaining

- **C1: Documentation updates** (PROJECT_MILESTONES.md, DEV_NOTES.md, TODO.md)
- **C2: Final smoke + readiness gate** (full backend + frontend + Playwright + `bash scripts/check-beta-readiness.sh`)

---

## Verification at end of session 2 (when you finish Phase A)

Per the plan's Task C2:

```bash
cd backend && npm test -- --silent 2>&1 | tail -10
# Pass count should be up by ~30 from session-1 baseline. Fail count
# unchanged (same ~14 baseline-flake suites unrelated to feed-system).

cd frontend && npm run lint && npx tsc --noEmit
# No errors.

cd frontend && npx playwright test 2>&1 | tail -20
# All E2E green.

bash scripts/check-beta-readiness.sh
# Per spec §9.4 (option B): readiness gate runs against new feed surface.
```

---

## Project rules to enforce throughout (from CLAUDE.md and `.claude/rules/`)

- **ES Modules only** (`.mjs`, `import`/`export`).
- **camelCase** for vars/functions/properties.
- **`bd`** for tracking, NEVER `TodoWrite`.
- **No skips** (`it.skip`, `test.skip`, `describe.skip`).
- **No bypass headers** (`x-test-skip-csrf`, `x-test-bypass-auth`, etc.).
- **No `continue-on-error`** in CI.
- **TDD** for all backend tasks: failing test FIRST, observe RED, then implement, observe GREEN.
- **Real DB** for backend integration tests. **Real backend** for E2E. No `vi.mock` of API client.
- **Don't auto-close bd issues** — user closes per `COMPLETION_VERIFICATION_POLICY.md`.

---

## Recon findings (resolved during brainstorm; preserved for context)

- **Finding 1 → B**: drop `coordination` column entirely. Stat boost pool = 12 stats.
- **Finding 2 → α**: symmetric two-derived health. `worseOf(getFeedHealth, getVetHealth) = displayedHealth`. `healthStatus` column kept as vet-finding override.
- **Finding 3 → P1+**: in-foal state lives as `Horse.inFoalSinceDate`, `Horse.pregnancySireId`, `Horse.pregnancyFeedingsByTier`. No new Pregnancy table.
- **Finding 4 (during plan write)**: `createFoal` currently creates foals instantly; Phase B (B3) refactors it to delayed foaling.
