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
