/**
 * horseNamePolicy.mjs (module root) — the horses module's PUBLIC horse-name rule
 * (Equoria-zalyb).
 *
 * The rule itself lives in `./services/horseNamePolicy.mjs`, one layer down,
 * for the reason recorded in that file: `foalingService` needs it and a service
 * must not import from `routes/`. This file publishes it, and nothing else.
 *
 * WHY A PUBLISHED SURFACE RATHER THAN A DEEP IMPORT OR THE BARREL
 *   `POST /api/v1/auth/advance-onboarding` writes `horses.name`, so the auth
 *   module has to meet this rule (owner ruling 2026-09-14). It has exactly three
 *   ways to reach it and two of them are closed:
 *
 *     - deep import of `horses/services/...` — refused by ESLint
 *       (no-restricted-imports, cross-module deep import, Equoria-v8l96).
 *     - `horses/index.mjs`, the barrel — the barrel re-exports the horse ROUTES,
 *       which reach back into auth, so importing it from an auth controller
 *       forms a module cycle. Measured, not assumed: it fails
 *       `backend/__tests__/scripts/moduleImportCycleTdz.sentinel.test.mjs` with
 *       "Cannot access 'register' before initialization" at authRoutes.mjs:76.
 *     - THIS file: module-root, so cross-module imports are permitted (the
 *       restriction pattern is `**\/horses/*\/**`, i.e. a sub-directory), and it
 *       imports nothing but the rule, so it cannot cycle.
 *
 *   It exports the whole policy rather than the two functions onboarding
 *   happens to need, so the next module that must meet this rule has one
 *   obvious place to import from rather than a reason to add a second file.
 *
 * DO NOT PUT ANY RULE HERE. Behaviour belongs in `./services/horseNamePolicy.mjs`;
 * a second copy of the bounds is exactly the divergence this whole campaign
 * exists to close.
 */

export * from './services/horseNamePolicy.mjs';
