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
if (genotype !== null && genotype !== undefined && typeof genotype === 'object' && !Array.isArray(genotype)) {
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
     data: { ...fixtureColor(), name: `TestFixture-foo-${randHex()}`, sex: 'Mare', dateOfBirth: new Date(), userId: user.id },
   });
   ```

2. **Use `createTestHorse()`** — preferred for NEW tests; it spreads
   `fixtureColor()` for you AND records the id for scoped cleanup:

   ```javascript
   import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';

   const created = [];
   const horse = await createTestHorse(prisma, { name: `TestFixture-foo-${randHex()}`, sex: 'Mare', dateOfBirth: new Date(), userId: user.id }, created);
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
  main().catch(err => {
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

5. **An ESLint `no-restricted-imports` rule will eventually enforce
   these boundaries; for now it's convention-only.** The lint rule
   cannot ship until every cross-module deep import has been migrated
   through its barrel — otherwise the rule fires on legitimate, not-
   yet-converted call sites. That migration is the work of steps 4-13.

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
