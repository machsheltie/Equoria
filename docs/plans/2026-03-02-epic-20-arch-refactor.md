# Epic 20 — Backend Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the flat Express backend (45 route files, 35 controller files) into organized domain modules under `backend/modules/`, and enhance the OpenAPI spec to be canonical and committed.

**Architecture:** Incremental module-by-module migration. Both `/api` and `/api/v1` stay dual-mounted (no breaking changes). Each domain gets `modules/{domain}/routes/`, `modules/{domain}/controllers/`, and `modules/{domain}/tests/`. Cross-cutting concerns (middleware, utils, db, config) remain at `backend/` root. Jest's `testMatch: ['**/*.test.mjs']` already finds tests anywhere, so no Jest config change needed.

**Tech Stack:** Node.js/Express, ES Modules (.mjs), Prisma, Jest, YAML (swagger.yaml)

**Key constraint:** The pre-push hook runs all 229+ test suites. Every commit must pass. Test after EVERY module move before committing.

---

## Import Path Rules (critical — memorize before starting)

When a file moves from `backend/routes/` → `backend/modules/{domain}/routes/`:

- `'../middleware/x.mjs'` → `'../../../middleware/x.mjs'`
- `'../controllers/x.mjs'` → `'../controllers/x.mjs'` (if controller moved into same module)
- `'../utils/x.mjs'` → `'../../../utils/x.mjs'`
- `'../db/index.mjs'` → `'../../../db/index.mjs'`
- `'../config/x.mjs'` → `'../../../config/x.mjs'`
- `'../models/x.mjs'` → `'../../../models/x.mjs'`
- `'../services/x.mjs'` → `'../../../services/x.mjs'`

When a controller moves from `backend/controllers/` → `backend/modules/{domain}/controllers/`:

- `'../utils/x.mjs'` → `'../../../utils/x.mjs'`
- `'../../packages/database/prismaClient.mjs'` → `'../../../../packages/database/prismaClient.mjs'`
- `'../middleware/x.mjs'` → `'../../../middleware/x.mjs'`
- `'../models/x.mjs'` → `'../../../models/x.mjs'`
- `'../services/x.mjs'` → `'../../../services/x.mjs'`

When a test moves from `backend/__tests__/` → `backend/modules/{domain}/tests/`:

- `'../helpers/x.mjs'` → `'../../../__tests__/helpers/x.mjs'`
- `'../setup.mjs'` → (irrelevant — Jest loads setupFilesAfterEnv automatically)
- `'../../app.mjs'` → `'../../../app.mjs'`
- `'../../controllers/x.mjs'` → `'../controllers/x.mjs'`

When a test moves from `backend/tests/integration/` → `backend/modules/{domain}/tests/`:

- `'../helpers/testAuth.mjs'` → `'../../../tests/helpers/testAuth.mjs'`
- `'../../../packages/database/prismaClient.mjs'` → `'../../../../packages/database/prismaClient.mjs'`
- `'../../app.mjs'` → `'../../../app.mjs'`

---

## Task 1: Create module skeleton directories

**Files:**

- Create: `backend/modules/` (and all subdirs below)

**Step 1: Create all domain module directories**

Run from `backend/`:

```bash
mkdir -p modules/auth/routes modules/auth/controllers modules/auth/tests
mkdir -p modules/users/routes modules/users/controllers modules/users/tests
mkdir -p modules/horses/routes modules/horses/controllers modules/horses/tests
mkdir -p modules/training/routes modules/training/controllers modules/training/tests
mkdir -p modules/competition/routes modules/competition/controllers modules/competition/tests
mkdir -p modules/breeding/routes modules/breeding/controllers modules/breeding/tests
mkdir -p modules/traits/routes modules/traits/controllers modules/traits/tests
mkdir -p modules/grooms/routes modules/grooms/controllers modules/grooms/tests
mkdir -p modules/community/routes modules/community/controllers modules/community/tests
mkdir -p modules/riders/routes modules/riders/controllers modules/riders/tests
mkdir -p modules/trainers/routes modules/trainers/controllers modules/trainers/tests
mkdir -p modules/services/routes modules/services/controllers modules/services/tests
mkdir -p modules/leaderboards/routes modules/leaderboards/controllers modules/leaderboards/tests
mkdir -p modules/admin/routes modules/admin/controllers modules/admin/tests
mkdir -p modules/docs/routes modules/docs/controllers
mkdir -p modules/labs/routes modules/labs/controllers modules/labs/tests
```

**Step 2: Verify /api/v1 is already dual-mounted**

```bash
# In app.mjs, line 431 already has: app.use('/api/v1', authRouter);
# This means /api/v1/horses, /api/v1/clubs etc. already work.
# Confirm:
grep "api/v1" backend/app.mjs
```

Expected output includes:

```
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1', authRouter);
```

**Step 3: Commit the skeleton**

```bash
cd backend
git add modules/
git commit -m "chore(arch): create backend/modules/ domain skeleton directories"
```

---

## Task 2: Auth module

**Files:**

- Move: `backend/routes/authRoutes.mjs` → `backend/modules/auth/routes/authRoutes.mjs`
- Move: `backend/controllers/authController.mjs` → `backend/modules/auth/controllers/authController.mjs`
- Move tests: `backend/__tests__/auth.test.mjs`, `auth-simple.test.mjs`, `auth-working.test.mjs` → `backend/modules/auth/tests/`
- Move tests: `backend/tests/integration/auth-system-integration.test.mjs` → `backend/modules/auth/tests/`
- Modify: `backend/app.mjs` (update import path)

**Step 1: Move with git mv**

```bash
cd backend
git mv routes/authRoutes.mjs modules/auth/routes/authRoutes.mjs
git mv controllers/authController.mjs modules/auth/controllers/authController.mjs
git mv __tests__/auth.test.mjs modules/auth/tests/auth.test.mjs
git mv __tests__/auth-simple.test.mjs modules/auth/tests/auth-simple.test.mjs
git mv __tests__/auth-working.test.mjs modules/auth/tests/auth-working.test.mjs
git mv tests/integration/auth-system-integration.test.mjs modules/auth/tests/auth-system-integration.test.mjs
```

**Step 2: Update imports in `modules/auth/routes/authRoutes.mjs`**

Find all imports referencing `'../` and update depth:

- `'../controllers/authController.mjs'` → `'../controllers/authController.mjs'` (same module, no change)
- `'../middleware/x.mjs'` → `'../../../middleware/x.mjs'`
- `'../utils/x.mjs'` → `'../../../utils/x.mjs'`

**Step 3: Update imports in `modules/auth/controllers/authController.mjs`**

- `'../utils/x.mjs'` → `'../../../utils/x.mjs'`
- `'../../packages/database/prismaClient.mjs'` → `'../../../../packages/database/prismaClient.mjs'`
- `'../middleware/x.mjs'` → `'../../../middleware/x.mjs'`
- `'../models/x.mjs'` → `'../../../models/x.mjs'`
- `'../services/x.mjs'` → `'../../../services/x.mjs'`

**Step 4: Update imports in moved test files**

In `modules/auth/tests/auth-system-integration.test.mjs`:

- `'../../app.mjs'` → `'../../../app.mjs'`
- `'../helpers/testAuth.mjs'` → `'../../../tests/helpers/testAuth.mjs'`
- `'../../../packages/database/prismaClient.mjs'` → `'../../../../packages/database/prismaClient.mjs'`

In `modules/auth/tests/auth.test.mjs` (and similar):

- `'../../app.mjs'` → `'../../../app.mjs'`
- `'../helpers/'` → `'../../../__tests__/helpers/'`

**Step 5: Update `backend/app.mjs`**

```javascript
// OLD:
import authRoutes from './routes/authRoutes.mjs';
// NEW:
import authRoutes from './modules/auth/routes/authRoutes.mjs';
```

**Step 6: Run auth tests to verify**

```bash
cd backend
npx jest --testPathPattern="modules/auth" --forceExit
```

Expected: all auth tests PASS.

**Step 7: Run full suite**

```bash
cd backend
npm test
```

Expected: same count as before (229+ suites, same pass rate).

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(arch): migrate auth module to backend/modules/auth/"
```

---

## Task 3: Users module

**Files:**

- Move: `backend/routes/userRoutes.mjs` → `backend/modules/users/routes/userRoutes.mjs`
- Move: `backend/controllers/userController.mjs` → `backend/modules/users/controllers/userController.mjs`
- Move: `backend/controllers/progressionController.mjs` → `backend/modules/users/controllers/progressionController.mjs`
- Move tests: `backend/tests/integration/userRoutes.test.mjs`, `user.test.mjs`, `userProgressAPI.integration.test.mjs`, `dashboardRoutes.test.mjs`, `xpLogging.test.mjs` → `backend/modules/users/tests/`
- Move tests: `backend/__tests__/horseXpSystem.test.mjs`, `horseXpIntegration.test.mjs`, `xpLogModel.test.mjs` → `backend/modules/users/tests/`
- Modify: `backend/app.mjs`

**Step 1: git mv all files (same pattern as Task 2)**

**Step 2: Update imports — same depth rules apply**

For `userRoutes.mjs`:

- Route imports: `'../middleware/'` → `'../../../middleware/'`
- Controller imports: `'../controllers/userController.mjs'` → `'../controllers/userController.mjs'`

For `userController.mjs`:

- `'../utils/'` → `'../../../utils/'`
- `'../../packages/database/prismaClient.mjs'` → `'../../../../packages/database/prismaClient.mjs'`

**Step 3: Update app.mjs**

```javascript
// OLD:
import userRoutes from './routes/userRoutes.mjs';
// NEW:
import userRoutes from './modules/users/routes/userRoutes.mjs';
```

**Step 4: Run tests**

```bash
cd backend
npx jest --testPathPattern="modules/users" --forceExit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(arch): migrate users module to backend/modules/users/"
```

---

## Task 4: Horses module

**Files:**

- Move: `backend/routes/horseRoutes.mjs` → `backend/modules/horses/routes/horseRoutes.mjs`
- Move: `backend/routes/horseXp.mjs` → `backend/modules/horses/routes/horseXp.mjs` (if used — check app.mjs; it's NOT imported, likely dead code — delete it instead)
- Move: `backend/routes/breedRoutes.mjs` → `backend/modules/horses/routes/breedRoutes.mjs`
- Move: `backend/controllers/horseController.mjs` → `backend/modules/horses/controllers/horseController.mjs`
- Move: `backend/controllers/horseXpController.mjs` → `backend/modules/horses/controllers/horseXpController.mjs`
- Move: `backend/controllers/breedController.mjs` → `backend/modules/horses/controllers/breedController.mjs`
- Move tests: `backend/__tests__/horseModel.test.mjs`, `horseHistory.test.mjs`, `horseConformation.test.mjs`, `horseAgingSystem.test.mjs`, `horseAgingIntegration.test.mjs`, `horseModelTask7.test.mjs`, `horseModelAtBirth.test.mjs`, `horseModelTraitHelpers.test.mjs`, `horseXpController.test.mjs` → `backend/modules/horses/tests/`
- Move tests: `backend/tests/integration/horseRoutes.test.mjs`, `horseOverview.test.mjs`, `horseBreedingWorkflow.integration.test.mjs` → `backend/modules/horses/tests/`
- Modify: `backend/app.mjs`

**Step 1: Check if horseXp.mjs is dead code**

```bash
grep "horseXp" backend/app.mjs
```

If not found in app.mjs, delete it: `git rm routes/horseXp.mjs`

**Step 2: git mv all active horse files**

```bash
git mv routes/horseRoutes.mjs modules/horses/routes/horseRoutes.mjs
git mv routes/breedRoutes.mjs modules/horses/routes/breedRoutes.mjs
git mv controllers/horseController.mjs modules/horses/controllers/horseController.mjs
git mv controllers/horseXpController.mjs modules/horses/controllers/horseXpController.mjs
git mv controllers/breedController.mjs modules/horses/controllers/breedController.mjs
# Move tests
git mv __tests__/horseModel.test.mjs modules/horses/tests/horseModel.test.mjs
# ... (all horse tests listed above)
```

**Step 3: Update imports in moved files**

`horseRoutes.mjs` imports `trainingController.mjs` (cross-module reference):

```javascript
// OLD:
import { getTrainableHorses } from '../controllers/trainingController.mjs';
// NEW (training not yet moved, so still in controllers/):
import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
```

All other horse controller imports follow the depth rules above.

**Step 4: Update app.mjs**

```javascript
import horseRoutes from './modules/horses/routes/horseRoutes.mjs';
import breedRoutes from './modules/horses/routes/breedRoutes.mjs';
```

**Step 5: Run tests**

```bash
cd backend
npx jest --testPathPattern="modules/horses" --forceExit
npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(arch): migrate horses module to backend/modules/horses/"
```

---

## Task 5: Training module

**Files:**

- Move: `backend/routes/trainingRoutes.mjs` → `backend/modules/training/routes/trainingRoutes.mjs`
- Move: `backend/controllers/trainingController.mjs` → `backend/modules/training/controllers/trainingController.mjs`
- Move: `backend/routes/enhancedMilestoneRoutes.mjs` → `backend/modules/training/routes/enhancedMilestoneRoutes.mjs`
- Move: `backend/controllers/enhancedMilestoneController.mjs` → `backend/modules/training/controllers/enhancedMilestoneController.mjs`
- Move tests: `backend/__tests__/training*.test.mjs`, `trainingController*.test.mjs`, `trainingCooldown.test.mjs`, `trainingModel.test.mjs`, `milestoneTraitEvaluator.test.mjs` → `backend/modules/training/tests/`
- Move tests: `backend/tests/integration/trainingProgression.integration.test.mjs` → `backend/modules/training/tests/`
- Modify: `backend/app.mjs`

**Step 1: git mv**

```bash
git mv routes/trainingRoutes.mjs modules/training/routes/trainingRoutes.mjs
git mv routes/enhancedMilestoneRoutes.mjs modules/training/routes/enhancedMilestoneRoutes.mjs
git mv controllers/trainingController.mjs modules/training/controllers/trainingController.mjs
git mv controllers/enhancedMilestoneController.mjs modules/training/controllers/enhancedMilestoneController.mjs
```

**Step 2: Fix cross-module reference in horses module**

Now that `trainingController.mjs` has moved, update the reference in `modules/horses/routes/horseRoutes.mjs`:

```javascript
// OLD (set in Task 4):
import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
// NEW:
import { getTrainableHorses } from '../../training/controllers/trainingController.mjs';
```

**Step 3: Update app.mjs**

```javascript
import trainingRoutes from './modules/training/routes/trainingRoutes.mjs';
import enhancedMilestoneRoutes from './modules/training/routes/enhancedMilestoneRoutes.mjs';
```

**Step 4: Run tests**

```bash
cd backend
npx jest --testPathPattern="modules/(training|horses)" --forceExit
npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(arch): migrate training module to backend/modules/training/"
```

---

## Task 6: Competition module

**Files:**

- Move: `backend/routes/competitionRoutes.mjs` → `backend/modules/competition/routes/competitionRoutes.mjs`
- Move: `backend/controllers/competitionController.mjs` → `backend/modules/competition/controllers/competitionController.mjs`
- Move: `backend/controllers/traitCompetitionController.mjs` → `backend/modules/competition/controllers/traitCompetitionController.mjs`
- Move tests: `backend/__tests__/competition.test.mjs`, `competitionController*.test.mjs`, `competitionRewards.test.mjs`, `competitionScore.test.mjs`, `simulateCompetition.test.mjs`, `enhancedCompetitionIntegration.test.mjs`, `enhancedCompetitionLogic.test.mjs`, `legacyScoreTraitIntegration.test.mjs`, `resultModel.test.mjs`, `isHorseEligible.test.mjs` → `backend/modules/competition/tests/`
- Move tests: `backend/tests/integration/competitionAPIEndpoints.integration.test.mjs`, `competitionWithTraits.test.mjs`, `competitionWorkflow.integration.test.mjs` → `backend/modules/competition/tests/`
- Modify: `backend/app.mjs`

**Steps:** Follow the same pattern as Tasks 2-5. Update all relative imports.

**Step after git mv — update app.mjs:**

```javascript
import competitionRoutes from './modules/competition/routes/competitionRoutes.mjs';
```

**Run tests:**

```bash
cd backend
npx jest --testPathPattern="modules/competition" --forceExit
npm test
```

**Commit:**

```bash
git add -A
git commit -m "refactor(arch): migrate competition module to backend/modules/competition/"
```

---

## Task 7: Breeding module

**Files:**

- Move: `backend/routes/foalRoutes.mjs` → `backend/modules/breeding/routes/foalRoutes.mjs`
- Move: `backend/routes/advancedBreedingGeneticsRoutes.mjs` → `backend/modules/breeding/routes/advancedBreedingGeneticsRoutes.mjs`
- Move: `backend/controllers/` (foal-related controllers — check what foalRoutes.mjs imports)
- Move tests: `backend/__tests__/foal*.test.mjs`, `breedingPrediction.test.mjs`, `horseBreedingWorkflow.integration.test.mjs` (if not moved), `foalCreationIntegration.test.mjs` → `backend/modules/breeding/tests/`
- Move tests: `backend/tests/integration/advancedBreedingGeneticsAPI.test.mjs`, `horseBreedingWorkflow.integration.test.mjs` → `backend/modules/breeding/tests/`
- Modify: `backend/app.mjs`

**Step 1: Identify foal controllers**

```bash
head -20 backend/routes/foalRoutes.mjs | grep import
```

**Step 2: git mv files (same pattern)**

**Step 3: Update app.mjs**

```javascript
import foalRoutes from './modules/breeding/routes/foalRoutes.mjs';
import advancedBreedingGeneticsRoutes from './modules/breeding/routes/advancedBreedingGeneticsRoutes.mjs';
```

Note: `advancedBreedingGeneticsRoutes` was mounted with `authRouter.use('/', ...)` — keep that mounting in app.mjs.

**Run tests + Commit:**

```bash
cd backend
npx jest --testPathPattern="modules/breeding" --forceExit
npm test
git add -A
git commit -m "refactor(arch): migrate breeding module to backend/modules/breeding/"
```

---

## Task 8: Traits module

**Files:**

- Move: `backend/routes/traitRoutes.mjs` → `backend/modules/traits/routes/traitRoutes.mjs`
- Move: `backend/routes/traitDiscoveryRoutes.mjs` → `backend/modules/traits/routes/traitDiscoveryRoutes.mjs`
- Move: `backend/routes/epigeneticTraitRoutes.mjs` → `backend/modules/traits/routes/epigeneticTraitRoutes.mjs`
- Move: `backend/routes/epigeneticFlagRoutes.mjs` → `backend/modules/traits/routes/epigeneticFlagRoutes.mjs`
- Move: `backend/routes/ultraRareTraitRoutes.mjs` → `backend/modules/traits/routes/ultraRareTraitRoutes.mjs`
- Move corresponding controllers: `traitController.mjs`, and those imported by these routes
- Move tests: all `trait*.test.mjs`, `epigenetic*.test.mjs`, `ultraRare*.test.mjs`, `atBirthTraits.test.mjs`, `lineageTraitCheck.test.mjs`, `disciplineAffinityBonusTask9.test.mjs`, `traitMilestone*.test.mjs`, `burnout*.test.mjs` → `backend/modules/traits/tests/`
- Move tests: `backend/tests/integration/traitRoutes.test.mjs`, `epigeneticTraitSystem.test.mjs`, `epigeneticFlagRoutes.test.mjs` → `backend/modules/traits/tests/`
- Modify: `backend/app.mjs`

**Step 1: Update app.mjs (5 imports):**

```javascript
import traitRoutes from './modules/traits/routes/traitRoutes.mjs';
import traitDiscoveryRoutes from './modules/traits/routes/traitDiscoveryRoutes.mjs';
import epigeneticTraitRoutes from './modules/traits/routes/epigeneticTraitRoutes.mjs';
import epigeneticFlagRoutes from './modules/traits/routes/epigeneticFlagRoutes.mjs';
import ultraRareTraitRoutes from './modules/traits/routes/ultraRareTraitRoutes.mjs';
```

**Run tests + Commit:**

```bash
cd backend
npx jest --testPathPattern="modules/traits" --forceExit
npm test
git add -A
git commit -m "refactor(arch): migrate traits module to backend/modules/traits/"
```

---

## Task 9: Grooms module

**Files (7 route files, 7 controllers):**

- Move routes: `groomRoutes.mjs`, `enhancedGroomRoutes.mjs`, `groomAssignmentRoutes.mjs`, `groomHandlerRoutes.mjs`, `groomSalaryRoutes.mjs`, `groomPerformanceRoutes.mjs`, `groomMarketplaceRoutes.mjs`
- Move controllers: `groomController.mjs`, `enhancedGroomController.mjs`, `groomAssignmentController.mjs`, `groomHandlerController.mjs`, `groomSalaryController.mjs`, `groomPerformanceController.mjs`, `groomMarketplaceController.mjs`
- Move tests: `backend/__tests__/groom*.test.mjs` (all ~15 groom test files) → `backend/modules/grooms/tests/`
- Move tests: `backend/tests/integration/groom*.test.mjs`, `enhancedGroomInteractions.test.mjs` → `backend/modules/grooms/tests/`
- Modify: `backend/app.mjs` (7 imports)

**Step 1: git mv all 14 route/controller files in one pass:**

```bash
for f in groomRoutes enhancedGroomRoutes groomAssignmentRoutes groomHandlerRoutes groomSalaryRoutes groomPerformanceRoutes groomMarketplaceRoutes; do
  git mv routes/${f}.mjs modules/grooms/routes/${f}.mjs
done
for f in groomController enhancedGroomController groomAssignmentController groomHandlerController groomSalaryController groomPerformanceController groomMarketplaceController; do
  git mv controllers/${f}.mjs modules/grooms/controllers/${f}.mjs
done
```

**Step 2: Update all imports in moved files (depth change: 3 levels up)**

**Step 3: Update app.mjs — replace 7 groom route imports**

```javascript
import groomRoutes from './modules/grooms/routes/groomRoutes.mjs';
import enhancedGroomRoutes from './modules/grooms/routes/enhancedGroomRoutes.mjs';
import groomAssignmentRoutes from './modules/grooms/routes/groomAssignmentRoutes.mjs';
import groomHandlerRoutes from './modules/grooms/routes/groomHandlerRoutes.mjs';
import groomSalaryRoutes from './modules/grooms/routes/groomSalaryRoutes.mjs';
import groomPerformanceRoutes from './modules/grooms/routes/groomPerformanceRoutes.mjs';
import groomMarketplaceRoutes from './modules/grooms/routes/groomMarketplaceRoutes.mjs';
```

**Run tests + Commit:**

```bash
cd backend
npx jest --testPathPattern="modules/grooms" --forceExit
npm test
git add -A
git commit -m "refactor(arch): migrate grooms module to backend/modules/grooms/"
```

---

## Task 10: Community module (forum, messages, clubs)

**Files:**

- Move: `backend/routes/forumRoutes.mjs` → `backend/modules/community/routes/forumRoutes.mjs`
- Move: `backend/routes/messageRoutes.mjs` → `backend/modules/community/routes/messageRoutes.mjs`
- Move: `backend/routes/clubRoutes.mjs` → `backend/modules/community/routes/clubRoutes.mjs`
- Move: `backend/controllers/forumController.mjs` → `backend/modules/community/controllers/forumController.mjs`
- Move: `backend/controllers/messageController.mjs` → `backend/modules/community/controllers/messageController.mjs`
- Move: `backend/controllers/clubController.mjs` → `backend/modules/community/controllers/clubController.mjs`
- Move tests: `backend/tests/integration/forumAPI.test.mjs`, `messageAPI.test.mjs`, `clubAPI.test.mjs` → `backend/modules/community/tests/`
- Modify: `backend/app.mjs`

**Step 1: git mv**

```bash
for f in forumRoutes messageRoutes clubRoutes; do
  git mv routes/${f}.mjs modules/community/routes/${f}.mjs
done
for f in forumController messageController clubController; do
  git mv controllers/${f}.mjs modules/community/controllers/${f}.mjs
done
git mv tests/integration/forumAPI.test.mjs modules/community/tests/forumAPI.test.mjs
git mv tests/integration/messageAPI.test.mjs modules/community/tests/messageAPI.test.mjs
git mv tests/integration/clubAPI.test.mjs modules/community/tests/clubAPI.test.mjs
```

**Step 2: Update app.mjs**

```javascript
import forumRoutes from './modules/community/routes/forumRoutes.mjs';
import messageRoutes from './modules/community/routes/messageRoutes.mjs';
import clubRoutes from './modules/community/routes/clubRoutes.mjs';
```

**Run tests + Commit:**

```bash
cd backend
npx jest --testPathPattern="modules/community" --forceExit
npm test
git add -A
git commit -m "refactor(arch): migrate community module to backend/modules/community/"
```

---

## Task 11: Riders + Trainers modules

**Files:**

- Move: `backend/routes/riderRoutes.mjs` → `backend/modules/riders/routes/riderRoutes.mjs`
- Move: `backend/controllers/riderController.mjs` → `backend/modules/riders/controllers/riderController.mjs`
- Move: `backend/controllers/riderMarketplaceController.mjs` → `backend/modules/riders/controllers/riderMarketplaceController.mjs`
- Move: `backend/routes/trainerRoutes.mjs` → `backend/modules/trainers/routes/trainerRoutes.mjs`
- Move: `backend/controllers/trainerController.mjs` → `backend/modules/trainers/controllers/trainerController.mjs`
- Move: `backend/controllers/trainerMarketplaceController.mjs` → `backend/modules/trainers/controllers/trainerMarketplaceController.mjs`
- Move tests: `backend/__tests__/riderMarketplace.test.mjs`, `trainerMarketplace.test.mjs` → respective modules
- Move tests: `backend/tests/integration/riderAPI.test.mjs`, `trainerAPI.test.mjs` → respective modules
- Modify: `backend/app.mjs`

**Update app.mjs:**

```javascript
import riderRoutes from './modules/riders/routes/riderRoutes.mjs';
import trainerRoutes from './modules/trainers/routes/trainerRoutes.mjs';
```

**Run tests + Commit:**

```bash
npm test
git add -A
git commit -m "refactor(arch): migrate riders and trainers modules"
```

---

## Task 12: World Services module (vet, tack-shop, farrier, feed-shop, inventory)

**Files:**

- Move: `backend/routes/vetRoutes.mjs` → `backend/modules/services/routes/vetRoutes.mjs`
- Move: `backend/routes/tackShopRoutes.mjs` → `backend/modules/services/routes/tackShopRoutes.mjs`
- Move: `backend/routes/farrierRoutes.mjs` → `backend/modules/services/routes/farrierRoutes.mjs`
- Move: `backend/routes/feedShopRoutes.mjs` → `backend/modules/services/routes/feedShopRoutes.mjs`
- Move: `backend/routes/inventoryRoutes.mjs` → `backend/modules/services/routes/inventoryRoutes.mjs`
- Move: `backend/controllers/vetController.mjs`, `tackShopController.mjs`, `farrierController.mjs`, `feedShopController.mjs`, `inventoryController.mjs` → `backend/modules/services/controllers/`
- Modify: `backend/app.mjs`

**Update app.mjs:**

```javascript
import vetRoutes from './modules/services/routes/vetRoutes.mjs';
import tackShopRoutes from './modules/services/routes/tackShopRoutes.mjs';
import farrierRoutes from './modules/services/routes/farrierRoutes.mjs';
import feedShopRoutes from './modules/services/routes/feedShopRoutes.mjs';
import inventoryRoutes from './modules/services/routes/inventoryRoutes.mjs';
```

**Run tests + Commit:**

```bash
npm test
git add -A
git commit -m "refactor(arch): migrate world-services module (vet/tack/farrier/feed/inventory)"
```

---

## Task 13: Leaderboards + Admin + Docs modules

**Files:**

- Move: `backend/routes/leaderboardRoutes.mjs` → `backend/modules/leaderboards/routes/leaderboardRoutes.mjs`
- Move: `backend/controllers/leaderboardController.mjs` → `backend/modules/leaderboards/controllers/leaderboardController.mjs`
- Move: `backend/routes/adminRoutes.mjs` → `backend/modules/admin/routes/adminRoutes.mjs`
- Move: `backend/routes/documentationRoutes.mjs` → `backend/modules/docs/routes/documentationRoutes.mjs`
- Move: `backend/routes/userDocumentationRoutes.mjs` → `backend/modules/docs/routes/userDocumentationRoutes.mjs`
- Move tests: `backend/tests/integration/leaderboardRoutes.test.mjs` → `backend/modules/leaderboards/tests/`
- Move tests: `backend/tests/integration/documentation-system-integration.test.mjs` → `backend/modules/docs/tests/`
- Modify: `backend/app.mjs`

**Update app.mjs:**

```javascript
import leaderboardRoutes from './modules/leaderboards/routes/leaderboardRoutes.mjs';
import adminRoutes from './modules/admin/routes/adminRoutes.mjs';
import documentationRoutes from './modules/docs/routes/documentationRoutes.mjs';
import userDocumentationRoutes from './modules/docs/routes/userDocumentationRoutes.mjs';
```

**Run tests + Commit:**

```bash
npm test
git add -A
git commit -m "refactor(arch): migrate leaderboards, admin, docs modules"
```

---

## Task 14: Labs module (experimental routes)

These are the 7 experimental routes mounted with `authRouter.use('/', ...)`:

- `advancedEpigeneticRoutes` — horse-specific routes at /horses/:id/...
- `enhancedReportingRoutes`
- `advancedBreedingGeneticsRoutes` (if not already in breeding module)
- `apiOptimizationRoutes`
- `memoryManagementRoutes`
- `environmentalRoutes`
- `personalityEvolutionRoutes`
- `dynamicCompatibilityRoutes`

**Files:**

- Move all above to `backend/modules/labs/routes/`
- Move their controllers to `backend/modules/labs/controllers/`
- Move tests if any to `backend/modules/labs/tests/`
- Modify: `backend/app.mjs`

**Update app.mjs lab route mounting:**

```javascript
// After moving:
import advancedEpigeneticRoutes from './modules/labs/routes/advancedEpigeneticRoutes.mjs';
import enhancedReportingRoutes from './modules/labs/routes/enhancedReportingRoutes.mjs';
// etc.

// Mounting stays the same:
authRouter.use('/', advancedEpigeneticRoutes); // horse-specific nested routes
authRouter.use('/optimization', apiOptimizationRoutes);
authRouter.use('/memory', memoryManagementRoutes);
// etc.
```

**Run tests + Commit:**

```bash
npm test
git add -A
git commit -m "refactor(arch): migrate experimental routes to backend/modules/labs/"
```

---

## Task 15: Ping + xpRoutes cleanup

**Files:**

- `backend/routes/ping.mjs` — stays in routes/ (it's a health utility, not a domain)
- `backend/routes/xpRoutes.mjs` — check if used in app.mjs; if not, delete it
- `backend/controllers/pingController.mjs` — stays at root controllers/

**Step 1: Check dead code**

```bash
grep "xpRoutes\|horseXp.mjs\|xpRoutes" backend/app.mjs
```

**Step 2: Delete unused files**

```bash
# If not imported in app.mjs:
git rm backend/routes/xpRoutes.mjs
git rm backend/routes/horseXp.mjs
```

**Step 3: Verify backend/routes/ is now empty (except ping.mjs)**

```bash
ls backend/routes/
```

Expected: only `ping.mjs` remains.

**Step 4: Verify backend/controllers/ is now empty**

```bash
ls backend/controllers/
```

Expected: only `pingController.mjs` remains.

**Step 5: Full test run**

```bash
cd backend
npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore(arch): remove dead route files; routes/ and controllers/ now empty except ping"
```

---

## Task 16: OpenAPI spec enhancement

The existing `backend/docs/swagger.yaml` is the source of truth for Swagger UI at `/api-docs`. It needs to reflect all current endpoints.

**Files:**

- Modify: `backend/docs/swagger.yaml`
- Create: `docs/api/API-01-Overview.md`

**Step 1: Check current swagger.yaml coverage**

```bash
grep "paths:" backend/docs/swagger.yaml
```

**Step 2: Update swagger.yaml server URLs to reflect /api/v1**

```yaml
servers:
  - url: '{baseUrl}/api/v1'
    description: 'Production/Dev — versioned'
    variables:
      baseUrl:
        default: 'http://localhost:3000'
  - url: '{baseUrl}/api'
    description: 'Legacy (backwards compatible)'
    variables:
      baseUrl:
        default: 'http://localhost:3000'
```

**Step 3: Add missing paths** for new endpoints added in Epics 11-19B:

Add to swagger.yaml `paths:` section:

```yaml
/forum/sections:
  get:
    tags: [community]
    summary: List forum sections
    security: [{ bearerAuth: [] }]
    responses:
      '200':
        description: Forum sections list

/forum/sections/{sectionId}/threads:
  get:
    tags: [community]
    parameters:
      - in: path
        name: sectionId
        required: true
        schema: { type: integer }
    responses:
      '200':
        description: Threads in section

/messages:
  get:
    tags: [community]
    summary: Get inbox messages
    responses:
      '200':
        description: Inbox messages

/messages/send:
  post:
    tags: [community]
    summary: Send a direct message
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              recipientId: { type: string }
              subject: { type: string }
              body: { type: string }
    responses:
      '201':
        description: Message sent

/clubs:
  get:
    tags: [community]
    summary: List clubs
    parameters:
      - in: query
        name: type
        schema: { type: string, enum: [discipline, breed] }
    responses:
      '200':
        description: Clubs list
  post:
    tags: [community]
    summary: Create a club
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name, type, category, description]
            properties:
              name: { type: string }
              type: { type: string, enum: [discipline, breed] }
              category: { type: string }
              description: { type: string }
    responses:
      '201':
        description: Club created

/clubs/{id}/join:
  post:
    tags: [community]
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: integer }
    responses:
      '201':
        description: Joined club

/clubs/{id}/leave:
  delete:
    tags: [community]
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: integer }
    responses:
      '200':
        description: Left club

/clubs/elections/{id}/nominate:
  post:
    tags: [community]
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: integer }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              statement: { type: string }
    responses:
      '201':
        description: Nominated

/clubs/elections/{id}/vote:
  post:
    tags: [community]
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: integer }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              candidateId: { type: integer }
    responses:
      '201':
        description: Vote cast
```

**Step 4: Add tags section to swagger.yaml if missing**

```yaml
tags:
  - name: auth
    description: Authentication and user registration
  - name: horses
    description: Horse CRUD and management
  - name: training
    description: Training sessions and milestones
  - name: competition
    description: Competition entry and results
  - name: breeding
    description: Breeding and foal development
  - name: traits
    description: Trait discovery and epigenetics
  - name: grooms
    description: Groom hiring, assignments, and performance
  - name: community
    description: Forum, messages, and clubs
  - name: riders
    description: Rider system
  - name: trainers
    description: Trainer system
  - name: leaderboards
    description: Rankings and leaderboards
  - name: admin
    description: Administrative operations
  - name: labs
    description: Experimental endpoints (non-SLO, subject to change)
```

**Step 5: Create API overview doc**

Create `docs/api/API-01-Overview.md`:

```markdown
# Equoria API v1 — Overview

## Base URL

- Production/Dev: `/api/v1`
- Legacy (backwards compatible): `/api`

## Authentication

All endpoints except `/auth/login` and `/auth/register` require a JWT Bearer token:
```

Authorization: Bearer <your-token>

````
Tokens are obtained from `POST /api/auth/login`.

## Rate Limiting
- Global: 100 requests per 15 minutes per IP (production)
- Auth: 5 failed login attempts per 15 minutes

## Error Format
```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": []  // optional validation errors
}
````

## Pagination

List endpoints support `?page=1&limit=20` query params.

## Labs Endpoints

Routes under `/api/v1/labs/` are experimental, have no SLO, and may change without notice.

## Interactive Docs

Swagger UI: `/api-docs`

````

**Step 6: Run tests (unchanged — swagger is served, not tested)**

```bash
cd backend
npm test
````

**Step 7: Commit**

```bash
git add -A
git commit -m "docs(api): enhance swagger.yaml with v1 servers + community endpoints + overview"
```

---

## Task 17: Frontend /api/v1 migration (optional, low-risk)

The frontend `api-client.ts` currently calls `/api/horses`, `/api/clubs`, etc. Since `/api` and `/api/v1` are dual-mounted, both work. This task updates the frontend to use the versioned path.

**Files:**

- Modify: `frontend/src/lib/api-client.ts`

**Step 1: Update API base in api-client.ts**

Find the base URL constant or where paths are constructed:

```typescript
// OLD:
const BASE = import.meta.env.VITE_API_URL ?? '';
// api calls: `${BASE}/api/horses`

// Change all '/api/' prefixes to '/api/v1/' in apiClient helper methods:
// OR update VITE_API_URL to point to /api/v1
```

The simplest change: update the `baseUrl` constant so all api calls use /api/v1 automatically.

**Step 2: Verify Vite build still passes**

```bash
cd frontend
npx vite build
```

**Step 3: Verify E2E tests still pass** (they hit the backend through the frontend)

```bash
cd frontend
npx playwright test --project=chromium
```

**Step 4: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(frontend): update api-client to use /api/v1 versioned endpoints"
```

---

## Task 18: Final verification + push

**Step 1: Run full backend test suite**

```bash
cd backend
npm test
```

Expected: 229+ suites, same pass rate as before refactor.

**Step 2: Run frontend build**

```bash
cd frontend
npx vite build
```

Expected: clean build.

**Step 3: Verify module structure is complete**

```bash
ls backend/modules/
ls backend/routes/   # Should be near-empty
ls backend/controllers/  # Should be near-empty
```

**Step 4: Push**

```bash
git push origin master
```

Expected: pre-push hook passes, push succeeds.

**Step 5: Update MEMORY.md with Epic 20 completion**

---

## Summary

| Phase        | Tasks | Scope                                                                                                                                      |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup        | 1     | Skeleton dirs, verify /api/v1                                                                                                              |
| Domain moves | 2–14  | auth, users, horses, training, competition, breeding, traits, grooms, community, riders, trainers, services, leaderboards/admin/docs, labs |
| Cleanup      | 15    | Dead route files                                                                                                                           |
| Docs         | 16    | OpenAPI spec, overview doc                                                                                                                 |
| Frontend     | 17    | /api/v1 adoption                                                                                                                           |
| Verify       | 18    | Full suite + push                                                                                                                          |

**Total route files to move:** ~43 (leaving only ping.mjs)
**Total controller files to move:** ~34 (leaving only pingController.mjs)
**Test files to move:** ~70 (from **tests**/ and tests/integration/)
**Breaking changes:** NONE — /api remains mounted throughout

---

## Gotchas

1. **Cross-module imports**: `horseRoutes.mjs` imports `trainingController.mjs`. When training moves, update horses reference. Use `grep -r "trainingController" backend/modules/` after each move to find stale references.

2. **advancedEpigeneticRoutes / enhancedReportingRoutes / advancedBreedingGeneticsRoutes** are mounted with `authRouter.use('/', ...)` not a named path. Their route handlers define the actual paths internally (e.g., `/horses/:id/epigenetic`). The mounting line in app.mjs stays as `authRouter.use('/', ...)`.

3. **Flaky tests**: `databaseOptimization.test.mjs` p95 timing test is known flaky. If push fails on this test, retry.

4. **groomBondingIntegration.test.mjs** stall_care `bondingChange > 0` is known flaky. Retry if needed.

5. **Tests that import from helpers**: After moving tests from `__tests__/` to `modules/x/tests/`, update helper imports:

   - `'../helpers/testUtils.mjs'` → `'../../../__tests__/helpers/testUtils.mjs'`
   - `'../../../tests/helpers/testAuth.mjs'` stays (unchanged from tests/integration/)

6. **The `tests/setup.mjs` and `tests/teardown.mjs`**: Referenced in jest.config.mjs as `<rootDir>/tests/setup.mjs`. Leave in place — do not move.
