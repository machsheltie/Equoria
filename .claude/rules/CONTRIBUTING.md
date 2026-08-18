# Equoria Naming Standards

- Use camelCase for all variable, property, and function names
- Use PascalCase for class and React component names
- File names should use kebab-case (e.g., task-logger.js)
- Match naming conventions between DB schema and code:
  - `horseId`, not `horse_id`
  - `taskLog`, not `task_log`
- Use consistent naming in imports:
  - `import { calculateStreakBonus } from '../utils/streakHelpers.js';`

---

## Test-Run Resource Budget — 2 workers, ~2GB, reaped afterward (user directive 2026-08-18)

The backend Jest suite runs on a 16GB laptop that is also the user's daily
machine. The old sizing (6 workers × 8GB heap allowance, built for a 64GB
desktop) OOM-killed runs silently and made the machine unusable. The budget
below is a **user directive, not a tuning suggestion**:

- **`maxWorkers: 2` — hard maximum.** Set in `backend/jest.config.mjs` AND
  passed explicitly as `--maxWorkers=2` in the `npm test` script so a config
  drift can't silently re-parallelize. Do not raise either, or "temporarily"
  parallelize a big run, without an explicit user decision recorded in the
  commit.
- **`workerIdleMemoryLimit: '512MB'`** recycles any worker whose heap
  exceeds 512MB after a test file — this is the RSS governor, not an
  optimization.
- **`--max-old-space-size=1536`** is the per-process heap ceiling in every
  backend test script; no single node process may exceed ~1.5GB.
- **Agent-driven subset runs are serial; full-suite runs use the 2-worker
  budget mode.** Targeted/subset runs go through
  `npm run test:backend:targeted` (the `--runInBand` script, one node
  process) — NOT `npm test -- --runInBand`, which jest rejects against the
  pinned `--maxWorkers=2`. A FULL-suite run must NOT be serial: under
  `--experimental-vm-modules`, one process retains every test file's module
  registry, and a full in-band run OOM-aborts against the 1536MB ceiling
  (measured 2026-08-18: exit 134 before the first suite completed). The
  2-worker + 512MB-recycle mode (`npm test`) is the memory-correct full-run
  shape — worker recycling is the leak flush.
- **Every run ends with a reap.** The `posttest` npm script runs
  `backend/scripts/reap-orphan-jest.mjs`, which kills jest worker processes
  whose parent died (externally-killed runs leave workers holding the app +
  a Prisma pool each). If you kill a run by hand, run `npm run test:reap`
  (or the script directly) before starting anything else. Never leave a
  killed run's workers to be discovered by the user as a bricked laptop.
- **Never run two suite invocations concurrently** (including from parallel
  Claude sessions) — they contend on the real DB and double the memory
  envelope. Check for running jest processes before launching a full run.
- **Mandatory jest hygiene flags.** When creating or modifying ANY jest
  config or package.json test script in this repo, ALWAYS include:
  `clearMocks: true`, `resetMocks: true`, `restoreMocks: true`,
  `resetModules: true`, `workerIdleMemoryLimit: '512MB'`, and
  `forceExit: true`. Mock state and the module registry are torn down
  between tests — accumulated mock modules are a memory leak, not a
  convenience. (`workerIdleMemoryLimit`/`forceExit`/`maxWorkers` are
  global-only options — in a multi-project config they go at the top level,
  the mock/module flags in each project block.)
- **After ANY background test or build run, confirm no orphaned node
  worker processes remain.** Check (PowerShell:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'jest' }`)
  and reap (`npm run test:reap`) before reporting the run complete. A
  background run is not finished while its workers are still resident.
- **The budget binds EVERY jest config and every jest-invoking script**, not
  just the main profile (extended 2026-08-18 after jest.config.optimized.mjs
  was found still spawning 50%/100% CPU workers and several scripts launched
  node with no heap ceiling). All five live configs (`jest.config.js`,
  `backend/jest.config.mjs`, `backend/jest.config.{optimized,performance,security}.mjs`)
  carry the cap + recycle + hygiene + `forceExit` set, and every package.json
  script that runs `node_modules/jest/bin/jest.js` directly carries
  `--max-old-space-size=1536` (CI: 4096) plus a concurrency pin
  (`--maxWorkers=1/2` or `--runInBand`).
- **`detectOpenHandles` is opt-in, never a standing setting.** It implies
  `--runInBand` (serializes the whole run, defeating the worker budget and
  OOM-aborting full runs — measured 2026-08-18) and its handle tracking skews
  the latency benchmarks. The sanctioned form in every config is the env
  gate: `detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true'` —
  debug with `DETECT_OPEN_HANDLES=true npm run test:backend:targeted -- <file>`.
- **Enforcement:** `scripts/doctrine-checks/check-jest-memory-budget.mjs`
  (runs in the doctrine suite + `doctrine-gate` CI) auto-discovers every
  `jest.config*` at the root and under `backend/`, imports each, and fails on
  percentage/over-cap `maxWorkers`, missing `workerIdleMemoryLimit`, missing
  `forceExit`, any hygiene flag not `true`, hardcoded `detectOpenHandles: true`,
  or a direct-jest script without a heap ceiling + concurrency pin. Sentinel:
  `backend/__tests__/jestMemoryBudgetDoctrine.sentinel.test.mjs` (proves it
  FIRES on a planted 50%-workers/hygiene-off/hardcoded-detect config).
- **Spawner scripts are scanned too; diagnose-full-suite.mjs is the sole
  sanctioned heap exception (Equoria-5mtzl).** The doctrine check also walks
  every `.mjs` under `scripts/` and `backend/scripts/` that launches the jest
  binary via child_process, failing any literal `--max-old-space-size` above
  1536 or a jest spawn with no heap cap, unless the file carries an explicit
  `// doctrine-allow: jest-heap-exception Equoria-<id> <reason>` marker.
  `backend/scripts/diagnose-full-suite.mjs` (manual-run-only diagnostic, never
  invoked by CI/pre-push) keeps its deliberate 8192MB headroom under that
  marker — it exists to MEASURE the whole-suite footprint, which a sub-footprint
  cap would OOM-abort mid-measurement. Never copy the 8GB into a test script or
  config; close other apps before running it on the 16GB laptop.
- Structural footprint work (per-suite heap profiling, ESM module-registry
  leak measurement, shared app bootstrap) is tracked in bd — the budget
  knobs above are the bound, not the fix.

---

## Frontend Vitest Test-Run Budget — same laptop, same cap (Equoria-7br8i, 2026-08-18)

The jest budget above binds every JEST path. The frontend suite (~6075
tests) runs under **Vitest 4** (`frontend/vitest.config.ts`), which has its
own worker-pool defaults and needed the equivalent bound. Audit findings on
the 24-CPU / 16GB dev machine (verified against the installed Vitest 4.1.9
runtime): node pools default `maxWorkers` to `cpus - 1` (= 23), the
storybook browser pool defaults to `min(12, cpus - 1)` (= 12) parallel
chromium page-workers, and each fork inherits V8's default old-space
(~4GB on 16GB RAM) when no heap flag is passed. The pre-budget config ran
4 unbounded-heap forks + a fully-uncapped browser pool — the same shape
that OOM-bricked the laptop under jest.

The bound (mirrors the jest posture, adapted to Vitest 4's option surface):

- **`maxWorkers: 2` on EVERY project block** in `frontend/vitest.config.ts`
  (the jsdom forks project AND the storybook browser project). Vitest 4
  removed `test.poolOptions`; pool sizing is the top-level `maxWorkers`.
- **Per-fork heap ceiling via `execArgv`:**
  `` execArgv: [`--max-old-space-size=${process.env.CI ? 4096 : 1536}`, '--expose-gc'] ``
  on the node-pool (forks) project — 1536MB locally, 4096MB in CI, same
  split as jest; a leaky test file OOMs its own fork instead of paging the
  whole machine. Vitest 4 merges project-level `execArgv` into each fork's
  node arguments. The browser project takes no `execArgv` (its workers are
  chromium pages, not node processes) — the worker cap is its bound.
- **`teardownTimeout: 10000`** (top-level) — the jest `forceExit` analog:
  force-kills workers whose teardown hangs. It is Vitest 4's default, made
  explicit so it cannot silently drift.
- **`hanging-process` reporter is env-gated, never standing** — the
  `detectOpenHandles` analog; Vitest's docs flag it as a heavy diagnostic.
  Sanctioned form:
  `reporters: process.env.VITEST_HANGING_PROCESS === 'true' ? ['default', 'hanging-process'] : ['default']`
  — debug with `VITEST_HANGING_PROCESS=true npx vitest run <file>`. The
  doctrine check fails a hardcoded `'hanging-process'`.
- **Mock-hygiene flags are NOT yet enabled — deliberately.** Vitest's
  analogs of the jest hygiene set (`clearMocks`, `mockReset`,
  `restoreMocks`, `unstubEnvs`, `unstubGlobals`) carry a documented trap:
  `mockReset: true` wipes mock implementations before every test, breaking
  mocks installed once in a setup file or `beforeAll`. Verifying that
  across ~6075 tests needs a full-suite run, so the flags are tracked in
  **Equoria-370t0** (with the trap and the fix pattern documented) rather
  than shipped unverified. Do not flip them ad hoc.
- **Script pin:** every package.json script that invokes `vitest` directly
  (`frontend/package.json` `test` / `test:run` / `test:coverage`) also
  carries `--maxWorkers=2`, mirroring the jest dual pin so script drift
  cannot re-parallelize past the config. The heap ceiling lives ONLY in the
  config `execArgv` — vitest has no CLI flag for worker node args, and
  `NODE_OPTIONS` would be a blunter instrument.
- **No `workerIdleMemoryLimit` equivalent exists for the forks pool**
  (Vitest 4's `memoryLimit` recycle applies only to vmThreads/vmForks) —
  don't go hunting for the missing knob. `isolate: true` + the per-fork
  heap cap is strictly stronger than idle-recycle: each test file gets a
  fresh, torn-down fork, so nothing accumulates across files at all.
- **Enforcement:** `scripts/doctrine-checks/check-vitest-memory-budget.mjs`
  (auto-run by the doctrine suite + `doctrine-gate` CI) discovers every
  `vitest.config.*` / `vitest.workspace.*` (root + `frontend/`, plus
  `vite.config.*` files embedding a `test:` block) and fails on any project
  block missing `maxWorkers`, any non-literal or >2 value, any node-pool
  block without the `--max-old-space-size=` execArgv, any hardcoded
  `'hanging-process'` reporter (must use the `VITEST_HANGING_PROCESS` env
  gate), or any direct-vitest script without a `--maxWorkers=1/2` pin. It
  parses the TS config
  textually (comment-stripped, string-aware) because importing it would
  require a TS loader plus executing vite/storybook plugin factories —
  which is why the config values must stay LITERALS (the sanctioned
  CI-headroom heap template is the one exception). Sentinel:
  `backend/__tests__/vitestMemoryBudgetDoctrine.sentinel.test.mjs` (proves
  it FIRES on the planted pre-budget 4-fork/uncapped-browser shape).
- Full-suite frontend runs remain heavy (~6075 tests through 2 forks +
  2 browser workers) — never run one concurrently with a backend jest run;
  the two budgets assume they own the machine's test headroom alone.

### Playwright E2E workers — same cap (Equoria-ya5wn, 2026-08-18)

- **Local Playwright workers are pinned to 2** in `playwright.config.ts`
  (CI stays 1; `playwright.beta-readiness.config.ts` stays 1). The prior
  `workers: process.env.CI ? 1 : undefined` fell through to Playwright's
  default of 50% of logical cores locally — each worker is a full browser
  context driving the real backend, the same OOM class as the unbounded
  jest/vitest pools.
- **Enforcement:** `scripts/doctrine-checks/check-playwright-workers-budget.mjs`
  (auto-run by the doctrine suite + `doctrine-gate` CI) source-scans every
  `playwright*.config.*` at the root and under `frontend/`, failing on a
  missing `workers:` property, any `undefined` branch, percentage
  allocations, or literals above 2. Exception channel:
  `// doctrine-allow: playwright-workers-exception Equoria-<id> <reason>`
  (no current holders). Sentinel:
  `backend/__tests__/playwrightWorkersBudgetDoctrine.sentinel.test.mjs`
  (proves it FIRES on the exact shipped `CI ? 1 : undefined` shape).
- No Playwright knob caps per-worker *browser* memory — the worker-count
  cap is the available lever; don't hunt for a heap flag here.

---

## Backend Conventions (Epic 31D / 31E re-learned patterns)

These four patterns were re-discovered across 31D and 31E stories. Apply them on every new backend story so they are not relearned.

### 1. JSONB type guard before reading JSONB columns

Prisma returns JSONB columns as `JsonValue` which can be `null`, a primitive, an array, or an object. Reading a property off the wrong shape throws at runtime. Always guard before reading.

```javascript
// ❌ WRONG — throws if column is null, a string, or an array
const genotype = horse.colorGenotype;
const eAllele = genotype.E;

// ✅ CORRECT — full guard, including the not-Array check
const genotype = horse.colorGenotype;
if (
  genotype !== null &&
  genotype !== undefined &&
  typeof genotype === 'object' &&
  !Array.isArray(genotype)
) {
  const eAllele = genotype.E;
}
```

The four-part check (`not null AND not undefined AND typeof object AND not Array`) is required because `typeof null === 'object'` and `typeof [] === 'object'` in JavaScript.

### 2. Route ordering — specific routes BEFORE `/:id` catch-alls

Express matches routes in registration order. A `/:id` catch-all registered first will swallow any later specific route with the same prefix.

```javascript
// ❌ WRONG — /breeding/color-prediction is unreachable (caught by /:id)
router.get('/:id', getHorse);
router.post('/breeding/color-prediction', getColorPrediction);

// ✅ CORRECT — specific routes first
router.post('/breeding/color-prediction', getColorPrediction);
router.get('/:id', getHorse);
```

When adding a new specific route to an existing router, scan for any `/:id`, `/:slug`, or other catch-all and register the new route BEFORE it. Add an integration test that asserts the specific route returns 200 (not the catch-all's 404) to lock the ordering in.

### 3. `rejectPollutedRequest` required on all new routes

Per `.claude/rules/SECURITY.md` Prototype Pollution Prevention (CWE-1321), the request-body and request-query polluted-key guards are mounted globally in `backend/app.mjs`. Verify your new route is mounted under that pipeline — do not register routes that bypass `app.use(express.json())` or that mount before the security middleware. If you write a new top-level router (not under `/api/v1`), explicitly add `rejectPollutedRequestBody` and `rejectPollutedRequestQuery` to its middleware chain.

### 4. Self-cross guard — `sireId !== damId` BEFORE any DB work

Any breeding, pairing, or two-parent endpoint must reject `sireId === damId` with HTTP 400 before any database call. This prevents both the obvious self-cross bug and a class of denial-of-service through wasted DB work.

```javascript
// ✅ CORRECT — guard before any prisma.* call
if (sireId === damId) {
  return res.status(400).json({ success: false, message: 'Sire and dam cannot be the same horse' });
}
const sire = await prisma.horse.findUnique({ where: { id: sireId } });
```

Cross-reference: `PATTERN_LIBRARY.md` § "Per-Locus Probability — Multi-Locus Genetics Calculation (31E-5)" notes the self-cross guard as a controller-level prerequisite for the breeding color prediction endpoint.

---

## Backend Module Conventions

### Module-test co-location (Epic 21 Story 21-1 AC5)

Backend module tests live in `backend/modules/<domain>/__tests__/`, NOT in a top-level `backend/__tests__/` directory. Each domain owns its own test directory.

This pattern keeps tests physically adjacent to the code they test and makes domain ownership obvious from the file tree. When a module's controllers / services / routes change, the tests that exercise them are in the same folder — no cross-tree navigation, no guessing where the suite lives.

**Established examples** (use these as templates when adding tests to a new module):

- `backend/modules/community/__tests__/` — `clubController.test.mjs`, `clubController.integration.test.mjs`, `communityRoutes.integration.test.mjs`
- `backend/modules/trainers/__tests__/` — `trainerController.test.mjs`, `trainerController.integration.test.mjs`, `trainerDiscoveryService.test.mjs`
- `backend/modules/riders/__tests__/` — same shape: unit-style controller test + `.integration.test.mjs` HTTP path

**Naming convention inside the module's `__tests__` directory:**

- `<unit>.test.mjs` — function- / class-level tests (still real-DB; "no mocks ever" per CLAUDE.md Testing Philosophy)
- `<routes-or-controller>.integration.test.mjs` — HTTP-chain integration tests via supertest against the real Express app + real DB

**When NOT to use module co-location:**

- Cross-module integration tests (e.g. a flow that spans `breeding` + `traits` + `competition`) belong under `backend/__tests__/integration/` because no single module owns them.
- Security middleware sentinel tests live under `backend/__tests__/middleware/` and `backend/__tests__/integration/security/` because middleware is cross-cutting.

**Pitfalls to avoid:**

- ❌ Adding `backend/__tests__/<module>.test.mjs` for a module that already has a co-located `__tests__` directory — pick one location, keep the suite together.
- ❌ Splitting a module's tests across both `backend/modules/<x>/__tests__/` AND `backend/__tests__/<x>/` — both will run, but a developer reading the file tree won't know which is canonical.
- ✅ When in doubt, mirror the most recent module to land (currently `community`).

Cross-reference: this convention is referenced from `CLAUDE.md` (project structure section). Any restructuring of `backend/modules/<x>/__tests__/` must update both files together.

---

## Test Fixtures — horse creation MUST inject a colorGenotype + phenotype (Equoria-dm1i)

**Rule:** NEW backend tests MUST NOT create a fixture horse with a bare
`prisma.horse.create({ data: { ... } })` that omits the color fields. Use
one of the two canonical forms instead.

### Why this exists (the structural defect class)

`createHorse()` (the model fn, Equoria-ennm) auto-generates
`colorGenotype` + `phenotype`. A raw `prisma.horse.create()` does **not** —
the row is born with `phenotype = NULL`. The canonical-DB invariant
`backend/__tests__/horseColorNullSentinel.test.mjs` (Equoria-a429) asserts
zero NULL-phenotype rows. While each suite's scoped/cascade cleanup
currently works (so the sentinel stays green), **any** suite whose
`afterAll` cleanup ever fails (silent `.catch(() => {})`, missing cascade,
timeout) leaks a NULL-phenotype row and trips the sentinel — this is
exactly the Equoria-lfj5 16-NULL regression and its g9sa fix. The "raw form"
migration is structurally complete: as of 2026-05-29 (Equoria-7guhz audit),
every `prisma.horse.create()` call in backend tests (229 grep matches across
~120 test files at that point) uses `...fixtureColor()` spread or
`createTestHorse()`. The `equoria/no-raw-test-horse-create` ESLint sentinel
emits zero warnings against the current tree. The previous "~206 legacy
suites still use the raw form" baseline was point-in-time documentation
from the dm1i landing window; it has since been driven to zero by the bulk
migration tracked under Equoria-dm1i-followup.

### Canonical forms (pick one)

1. **Spread `...fixtureColor()`** into a raw create — preferred when a
   suite already has its own `prisma.horse.create()` and its own scoped
   cleanup:

   ```javascript
   import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

   await prisma.horse.create({
     data: {
       ...fixtureColor(),
       name: `TestFixture-foo-${randHex()}`,
       sex: 'Mare',
       dateOfBirth: new Date(),
       userId: user.id,
     },
   });
   ```

2. **Use `createTestHorse()`** — preferred for NEW tests; it spreads
   `fixtureColor()` for you AND records the id for scoped cleanup:

   ```javascript
   import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';

   const created = [];
   const horse = await createTestHorse(
     prisma,
     {
       name: `TestFixture-foo-${randHex()}`,
       sex: 'Mare',
       dateOfBirth: new Date(),
       userId: user.id,
     },
     created
   );
   afterAll(() => cleanupTestHorses(prisma, created)); // deletes ONLY the ids this suite made
   ```

   - Helper: `backend/__tests__/helpers/createTestHorse.mjs`
   - Sentinel test: `backend/__tests__/helpers/createTestHorse.test.mjs`
   - Underlying generator: `backend/tests/helpers/fixtureColor.mjs`
     (CI-proven by `backend/tests/fixtureColorGuard.test.mjs`)

### Cleanup discipline (CLAUDE.md §2)

Cleanup MUST be scoped — `where: { id: { in: collectedIds } }` or
`where: { name: { startsWith: 'TestFixture-...' } }`. A bare
`prisma.horse.deleteMany()` against the canonical DB is forbidden.
`cleanupTestHorses()` enforces the id-scoped form.

### Enforcement

An `error`-level ESLint sentinel `equoria/no-raw-test-horse-create` (inline
plugin in `backend/eslint.config.mjs`, test-files override block) flags any
`*.horse.create({ data: { ... } })` in a test whose `data` object has no
spread element. It was originally `warn` (not `error`) to avoid breaking
`npm run lint` (`eslint .`, no `--max-warnings`) on the ~206 legacy suites
that were waiting to be migrated. That migration is now complete: as of
2026-05-29 (Equoria-7guhz audit) the legacy backlog is at zero — every
test-file `prisma.horse.create()` has the canonical spread or goes through
`createTestHorse()` — and the rule was promoted to `error` under
Equoria-c8ulb (re-verified 2026-06-02 / Equoria-psocv: zero AST
violations against the current tree). The one legitimate exception — a
sentinel-negative test that MUST use the raw form to prove the defect
class — uses a scoped
`// eslint-disable-next-line equoria/no-raw-test-horse-create -- <reason>`.

---

## CLI Scripts — main-module guard for destructive side-effects (Equoria-c3kb6 / Equoria-5z0if)

**Rule:** Any `backend/scripts/*.mjs` (or top-level `scripts/*.mjs`) that
performs destructive side-effects on import — Prisma writes (`create`,
`update`, `delete`, `upsert`), `prisma.$executeRaw*` DDL/DML, `execSync`
of `prisma migrate`, raw `DROP/CREATE/TRUNCATE` — MUST wrap the
top-level invocation in an ESM main-module guard so the file is
side-effect-free when merely imported.

### Why this exists (the structural defect class)

The Equoria-c3kb6 incident wiped the canonical localhost `equoria`
database because `backend/scripts/db-reset-test.mjs` ran
`DROP DATABASE` + `CREATE DATABASE` + `prisma migrate deploy` at module
top level. A worker ran
`node -e "import('./scripts/db-reset-test.mjs')"` as a parse-check (no
intention to execute) and the destructive operations fired against the
restored production data. The fix is structural: separate "loading the
module" from "running the script."

### Canonical pattern (use exactly this)

```javascript
// At the bottom of the file, after function declarations:
import { fileURLToPath } from 'node:url';

// Equoria-5z0if / Equoria-ur0y8: main-module guard. <fn>() mutates <what> —
// must NOT run on bare import (e.g. parse-check `node -e "import('./x.mjs')"`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
```

**Use `fileURLToPath`, NOT string concatenation.** The older
``import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ``
form (Equoria-ur0y8) is **broken on Windows and must not be copied**:
`process.argv[1]` is `C:\path` (no leading slash), so the template yields
`file://C:/path` (TWO slashes after the scheme), but Node emits
`import.meta.url` as `file:///C:/path` (THREE slashes — the standard file
URL for an absolute path). They never match, so the guard never fires and
the script silently no-ops when run as the direct entrypoint. (The bare
`file://${process.argv[1]}` form happens to work on POSIX — `/abs/path`
supplies the third slash — but also fails on Windows.) `fileURLToPath`
normalises both sides correctly on every platform, so it is the only form
that is safe to recommend. Equivalent safe form:
`pathToFileURL(process.argv[1]).href === import.meta.url`.

For scripts whose top-level body is bare statements (not in a function),
hoist the body into `function main() { ... }` first, then apply the
guard. See `backend/scripts/migrate-production.mjs` for the worked
example.

### Sentinel enforcement

`backend/__tests__/scripts/destructiveScriptsMainModuleGuard.sentinel.test.mjs`
walks every `backend/scripts/*.mjs`, detects destructive operations via
regex (Prisma write methods, `execSync` of prisma migrate, raw
DROP/TRUNCATE/etc.), and asserts the file contains a main-module guard.
It includes a sentinel-positive PLANTED-VIOLATION test that proves the
detector fires on an unguarded synthetic script — not just that it
passes when nothing is wrong. New destructive scripts that ship without
the guard will fail this sentinel.

### Pitfalls to avoid

- ❌ Top-level `main()` or `run()` invocation outside any `if` block — the
  whole point is the `if`.
- ❌ Top-level `await prisma.X.update(...)` outside a function body — the
  guard wraps the call site, but the call site has to BE a guarded
  function call.
- ❌ Replacing the guard with `if (require.main === module)` — that's the
  CommonJS pattern. This codebase is ESM (`"type": "module"`); the ESM
  pattern is `fileURLToPath(import.meta.url) === process.argv[1]`.
- ❌ The string-concat form
  ``import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ``
  — broken on Windows (`file://C:/...` ≠ `file:///C:/...`), the guard never
  fires (Equoria-ur0y8). Use `fileURLToPath` instead.
- ✅ Always compare via `fileURLToPath(import.meta.url) === process.argv[1]`
  (or `pathToFileURL(process.argv[1]).href === import.meta.url`) — these
  normalise the URL/path on every platform; manual `file://`
  concatenation does not.
- ✅ Always pair the guard with a comment that names the bd issue and the
  specific side-effect being guarded (so future contributors don't
  silently undo the wrap).

---

## Module public API boundaries (Equoria-r9we2/efonm/pfe6x/rdtcb slice)

This convention establishes the public-API boundary between modules
under `backend/modules/`. It came out of the 2026-05-28 architecture
review which surfaced four related findings:

- **Equoria-r9we2** — `backend/modules/services/` is acting as a junk
  drawer that cross-cuts horse / competition / marketplace domains.
- **Equoria-efonm** — top-level `backend/services/` parallels
  `modules/<x>/services/`; the largest domains (grooms, riders,
  trainers) don't own their services.
- **Equoria-pfe6x** — cross-module imports go through `controllers/`
  with no public-API boundary; renaming an internal function silently
  breaks consumers in other modules.
- **Equoria-rdtcb** — `backend/models/horseModel.mjs` (1025 lines)
  lives outside the horses module and is reached up three levels by
  `modules/horses/routes/horseRoutes.mjs`.

The user authorized a 3-commit slice (this section + the barrel
scaffolds + the horses-module proof-of-pattern) as the foundation.
Steps 4-13 of the broader migration (moving groom / rider / trainer
services into their modules, deleting top-level `backend/models/`,
splitting `modules/services/`, and the ESLint enforcement rule) are
explicitly deferred for re-evaluation after this foundation is in
place.

### The convention

1. **Every domain module under `backend/modules/<domain>/` ships an
   `index.mjs` that re-exports its public API surface.** The barrel is
   the contract; everything else inside the module is an
   implementation detail.

2. **Cross-module imports MUST use this barrel:**

   ```js
   // ✅ correct — cross-module, goes through the barrel
   import { getTemperamentGroomSynergy } from '../../horses/index.mjs';

   // ❌ deprecated — deep-imports another module's internals
   import { getTemperamentGroomSynergy } from '../../horses/services/temperamentService.mjs';
   ```

   Same-module imports (anything inside the same `modules/<x>/`
   subtree) continue to use relative deep paths — the barrier is only
   between modules, not within them.

3. **`backend/services/` (top-level) is for cross-cutting
   infrastructure** — cron scheduler, audit-log retention, financial
   ledger, event bus, feature flags, Sentry, memory, DB optimization.
   Domain-owned services live in their module's `services/`
   subdirectory. The current population of `backend/services/`
   includes a large number of domain-shaped files (`groom*`,
   `rider*`, `trainer*`); migrating those into the right module is a
   later slice, not this one.

4. **`backend/models/` (top-level) is being deprecated.** Every
   Prisma-touching model file will eventually be co-located with its
   domain (`backend/modules/<domain>/models/`). For now, deep imports
   from `backend/models/horseModel.mjs` into `modules/horses/services/`
   continue to work and remain in place — the actual move is a later
   slice. New model files should land directly in the owning module.

5. **An ESLint `no-restricted-imports` rule now ENFORCES these
   boundaries (Equoria-v8l96.4) — it is no longer convention-only.**
   `backend/eslint.config.mjs` emits per-module override blocks that
   forbid importing another module's internals
   (`../../<other>/(controllers|services|routes|models|data)/...`),
   forcing cross-module imports through `<other>/index.mjs`. Same-module
   deep imports remain allowed. The prod (Equoria-v8l96.2) and test
   (Equoria-v8l96.3) deep-import migrations had to land first so the rule
   fires only on genuine violations; a sentinel
   (`backend/__tests__/scripts/moduleBarrelBoundaryEslint.sentinel.test.mjs`)
   proves it FIRES on a planted cross-module deep import and PASSES on a
   same-module one.

### When in doubt

- Adding a new cross-module import? Route it through the target
  module's `index.mjs`. If the symbol isn't re-exported yet, add it
  to the barrel and migrate any other consumers at the same time.
- The proof-of-pattern is `backend/modules/horses/index.mjs`. Mirror
  its shape (named re-exports per service file) when populating new
  module barrels.
- Test files inside `__tests__/` may keep their existing deep imports
  for now; the next slice will sweep them after the production
  consumers are clean.

---

## File-size thresholds — shrink-only doctrine ratchet (Equoria-urqic.7)

The Equoria-urqic epic split a set of god files (oversized controllers,
services, and test harnesses) into owned modules. This is the prevention
capstone that stops those files — and any new ones — from regrowing past a
maintainable size.

### The policy (user-approved, 2026-06-22)

- **SOURCE files** must be **<= 600 lines.** Scope: `backend/**/*.mjs` and
  `frontend/src/**/*.{ts,tsx}`, EXCLUDING test files.
- **TEST files** must be **<= 800 lines.** A file is a test file when its
  basename matches `*.test.*` / `*.spec.*` OR it lives anywhere under a
  `__tests__/` directory.
- "Line count" is the raw total line count (newline-terminated lines plus a
  trailing partial line), not effective/non-blank lines — the threshold is
  about file heft a maintainer has to scroll.

### The mechanism — why a doctrine ratchet, not an ESLint `max-lines` warn

The project's lint runs with `--max-warnings 0`, so a warn-level `max-lines`
rule would break `npm run lint` on every currently-oversized file; an
error-level whole-tree rule would be a flag-day mass failure. Instead this is a
**shrink-only DOCTRINE ratchet**, mirroring the sibling rethrow-after-log gate
(`scripts/doctrine-checks/check-no-new-rethrow-after-log.mjs` +
`rethrow-after-log-baseline.json`):

- **Check:** `scripts/doctrine-checks/check-file-size-thresholds.mjs` — scans
  the tree and compares each over-threshold file against the baseline. It
  auto-runs in the doctrine suite (`run-all.sh` globs `check-*.mjs`) and in the
  `doctrine-gate` CI workflow.
- **Baseline:** `scripts/doctrine-checks/file-size-baseline.json` — a per-file
  allow-list of the files CURRENTLY over their threshold, recording each file's
  exact line count. These are the genuinely-cohesive / not-yet-split
  exceptions.
- **The check FAILS if:** a NEW file exceeds its threshold but is not on the
  allow-list, OR a baselined file GREW above its recorded count, OR a baseline
  entry is STALE (file deleted, or no longer over threshold).
- **Sentinel:** `backend/__tests__/fileSizeThresholdDoctrine.sentinel.test.mjs`
  proves the check passes on the current tree, FIRES on a planted >600-line
  source file and a planted >800-line test file, and (via the `argv[2]`
  alternate-baseline hook) FIRES on a stale entry.

### How to add a documented exception

If a file is a genuinely-cohesive exception that cannot reasonably be split,
add it to `file-size-baseline.json` at its **current line count**, in the same
commit that introduces it. The allow-list is the exception channel.

### The one rule: the baseline may only SHRINK

- When you shrink a file below its threshold (or below its recorded count),
  **prune/decrement its baseline entry in the SAME commit.** A baseline entry
  whose file no longer exists, or is no longer over threshold, is STALE and
  fails the check — stale entries are unusable headroom a future regression
  could hide under.
- Adding a NEW entry (or raising an existing count) is allowed only when a file
  legitimately must exceed the threshold; the long-term trajectory of the
  allow-list is toward empty as the urqic splits continue.

Cross-reference: Equoria-urqic.7 (this gate) sits alongside the controller /
routes ESLint `max-lines` rule (Equoria-xod8b / y8u2j, see
`backend/eslint.config.mjs`) which caps NEW files in those two layers at 800
effective lines. This doctrine ratchet is the whole-tree complement that
governs the existing tree shrink-only.
