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
