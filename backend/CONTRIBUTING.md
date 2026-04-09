# Backend Contributing Guide — Equoria

**Version:** 2.0 **Last Updated:** 2026-04-09 (Epic 31F + 31E retros)
**Purpose:** Mandatory conventions for all backend development. Enforced at code
review.

---

## Module & File Conventions

### Test Co-location (established Epic 21-1)

Tests live **alongside the module they test**, not in the root `__tests__/`
folder.

```
backend/modules/competition/__tests__/conformationShowScoring.test.mjs   ✅
backend/__tests__/conformationShowScoring.test.mjs                        ❌ wrong location
```

**Rule:** Use `backend/__tests__/` only for cross-cutting integration tests that
span multiple modules (e.g., redis circuit breaker, auth integration). All
single-module tests go in the module's own `__tests__/` folder.

### File Naming

- All backend files: `.mjs` extension, ES Modules only
- Controllers: `{domain}Controller.mjs`
- Services: `{domain}Service.mjs` or `{feature}Service.mjs`
- Routes: `{domain}Routes.mjs`
- Tests: `{featureOrService}.test.mjs`

---

## Route Ordering (established Epic 31D/31E)

**Specific routes MUST be declared BEFORE catch-all `/:id` routes.**

```javascript
// ✅ CORRECT — specific before catch-all
router.get('/temperament-definitions', getTemperamentDefinitions);
router.get('/:id/genetics', getHorseGenetics);
router.get('/:id', getHorse);

// ❌ WRONG — /:id captures "temperament-definitions" as an id
router.get('/:id', getHorse);
router.get('/temperament-definitions', getTemperamentDefinitions); // never reached
```

**Always verify route order when adding any route that has a fixed-path segment
in the same router as `/:id`.**

---

## JSONB Type Guard (established Epic 31D/31E)

Always validate Prisma `Json?` columns before treating them as objects:

```javascript
// ✅ CORRECT — full guard for Json? columns
function isValidGenotype(value) {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

// ❌ WRONG — truthy check doesn't catch empty string or array
if (horse.colorGenotype) { ... }
```

Apply this guard for all `Json?` fields: `colorGenotype`, `phenotype`,
`conformationScores`, `gaitScores`, etc.

---

## Catch Block Syntax (established Epic 31E)

Always use `catch (error)` — **not** `catch (_error)` — and reference
`error.message` in the logger call:

```javascript
// ✅ CORRECT
} catch (error) {
  logger.error(`[module.function] Error: ${error.message}`);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

// ❌ WRONG — triggers no-unused-vars lint error
} catch (_error) {
  logger.error('[module.function] Unknown error');
}
```

---

## HTTP Parameter Pollution Prevention (established Epic 31E)

Add `rejectPollutedRequest` middleware to **every new route**:

```javascript
import { rejectPollutedRequest } from '../middleware/parameterPollution.mjs';

router.post(
  '/breeding/color-prediction',
  mutationRateLimiter,
  rejectPollutedRequest, // ← always include
  authenticateToken,
  validateBody,
  controllerFunction,
);
```

---

## Self-Cross Guard (established Epic 31E-5)

Any endpoint accepting two horse IDs (breeding, prediction, comparison) must
validate they are different before any DB work:

```javascript
// ✅ CORRECT — guard before DB calls
const { sireId, damId } = req.body;
if (sireId === damId) {
  return res.status(400).json({
    success: false,
    message: 'Sire and dam must be different horses',
  });
}
// ... DB fetches below
```

---

## Production Path Validation (established Epic 31D)

Any story that modifies an **existing game system** (training, competition,
groom bonding) must include a task:

> "Verify the feature fires in the production call path, not just the
> unit-tested path."

**Pattern to check:** Trace from the HTTP handler → controller import → service
import. If the controller imports a different file than the service you
modified, the feature is not wired in production — even if all unit tests pass.

```javascript
// EXAMPLE — wrong import means temperament modifier never runs
// competitionController.mjs
import { calculateCompetitionScore } from '../logic/competitionLogic.mjs'; // ❌ old file

// Should be:
import { calculateCompetitionScore } from '../utils/competitionScore.mjs'; // ✅ correct file
```

---

## Idempotency for Execution Endpoints (established Epic 31F-3)

Any endpoint that executes a batch operation (show execution, foal evaluation,
reward distribution) **must have a status guard** checked before execution, and
the status must be updated **atomically** within the same `$transaction` as the
writes:

```javascript
// ✅ CORRECT — idempotency guard + atomic update in $transaction
export async function executeConformationShow(req, res) {
  const show = await prisma.show.findUnique({ where: { id: showId } });

  if (show.status === 'completed') {
    return res
      .status(409)
      .json({ success: false, message: 'Show already executed' });
  }

  await prisma.$transaction(async tx => {
    // Re-fetch inside transaction to prevent race condition
    const freshShow = await tx.show.findUnique({ where: { id: showId } });
    if (freshShow.status === 'completed') {
      throw new Error('ALREADY_COMPLETED');
    }

    // ... apply rewards ...

    await tx.show.update({
      where: { id: showId },
      data: { status: 'completed' },
    });
  });
}
```

**Why:** Without this guard, the endpoint is farmable — two simultaneous calls
distribute double rewards.

---

## N+1 Prevention in Promise.all (established Epic 31F-3)

Never use `array.map(async item => prisma.X.findFirst(...))` — this fires N
queries:

```javascript
// ❌ WRONG — N+1: one query per entry
const groomAssignments = await Promise.all(
  entries.map(async entry =>
    prisma.groomAssignment.findFirst({ where: { horseId: entry.horseId } }),
  ),
);

// ✅ CORRECT — batch query + Map by ID
const groomAssignmentRecords = await prisma.groomAssignment.findMany({
  where: { horseId: { in: entries.map(e => e.horseId) } },
});
const groomAssignmentMap = new Map(
  groomAssignmentRecords.map(ga => [ga.horseId, ga]),
);
const groomAssignments = entries.map(
  e => groomAssignmentMap.get(e.horseId) ?? null,
);
```

---

## Stale Read Prevention in Transactions (established Epic 31F-3)

When computing accumulated values (title points, breeding value boost, stats),
always **re-fetch the current value inside `$transaction`** before computing the
new value:

```javascript
// ❌ WRONG — horse fetched outside $transaction; value may be stale
const horse = await prisma.horse.findUnique(...);
await prisma.$transaction(async (tx) => {
  const newPoints = horse.titlePoints + award;  // stale!
  await tx.horse.update({ data: { titlePoints: newPoints } });
});

// ✅ CORRECT — re-fetch inside $transaction
await prisma.$transaction(async (tx) => {
  const freshHorse = await tx.horse.findUnique({ where: { id: horseId } });
  const newPoints = freshHorse.titlePoints + award;
  await tx.horse.update({ data: { titlePoints: newPoints } });
});
```

---

## Auth Chain Verification (established Epic 31F)

Before flagging a route as missing authentication, trace the **full mount
chain**:

```
app.mjs
  └── authRouter.use(authenticateToken)
        └── authRouter.use('/competition', competitionRoutes)
              └── competitionRoutes.use('/conformation', conformationShowRoutes)
```

Routes mounted on `authRouter` inherit `authenticateToken` — **they do not need
per-route middleware**. Always verify the full hierarchy before adding redundant
auth middleware.

---

## TEA Steps (mandatory — Heirr directive 2026-04-09)

Every story follows the **TEA workflow** — no exceptions:

| Step            | When                                     | What                                    |
| --------------- | ---------------------------------------- | --------------------------------------- |
| **TEA:ATDD**    | Before any implementation code           | Write failing acceptance tests from ACs |
| **TEA:TA + RV** | After implementation, before code review | Expand test suite + quality review      |
| **TEA:TR**      | At epic completion                       | Requirements → test traceability map    |

A story cannot be marked `done` without all three TEA phases.

---

## Story Artifact Preservation (established Epic 31E retro)

When a story is marked `done`, the story file must be saved to:

```
_bmad-output/implementation-artifacts/{story-key}.md
```

Do not leave story files only in the sprint planning folder. The
`implementation-artifacts/` folder is the authoritative record consulted by
future agents.

---

## Prisma Migration Policy

**Do not use `prisma db execute` as a bypass.** If `prisma migrate dev` is
blocked by drift:

1. Identify the drift source (which fields exist in DB but not in migration
   history)
2. Generate a corrective migration: `prisma migrate dev --name fix-drift`
3. If blocked by the test DB, reset it: `prisma migrate reset --force` (test DB
   only)

Three `prisma db execute` bypasses have accumulated (31E/31F/31F). The next
schema change must include a migration history repair task.
