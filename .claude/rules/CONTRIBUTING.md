---
paths:
  - "backend/**/*.mjs"
  - "backend/**/*.json"
  - "scripts/**/*.mjs"
  - "scripts/**/*.sh"
  - "package.json"
  - "backend/package.json"
  - "frontend/package.json"
  - "backend/jest.config*.mjs"
  - "frontend/vitest.config.ts"
  - "playwright*.config.ts"
---

# Backend and Test Implementation Guardrails

**Status:** Active rule
**Owner:** Project owner
**Last verified:** 2026-08-19
**Load only when:** A matching backend, script, package, or test-configuration file is read
**Do not load for:** Product/design work, ordinary frontend components, documentation cleanup, or project status
**Live sources:** `AGENTS.md`, `CLAUDE.md`, package scripts, test configuration, ESLint, source, tests, and `scripts/doctrine-checks/`
**Retire when:** Its remaining rules are all mechanically enforced or moved into a smaller applicable authority

Live configuration and executable gates win over examples in this file. Do not
copy a command, threshold, path, or pattern without checking its current source.

## Test-run resource budget

- The user's development machine has a strict two-worker ceiling. Never raise
  Jest, Vitest, or Playwright worker counts or their configured heap limits
  without explicit owner approval.
- Use the commands in `AGENTS.md` and live package scripts. In particular,
  `npm run test:backend` is intentionally serial. Do not invent a different
  full-suite shape from an old rule or diary.
- Never run backend, frontend, or E2E suites concurrently. They share machine
  headroom, and backend suites also share the real database.
- If a run is interrupted, use the current `test:reap` package script when
  applicable and verify that no orphaned Jest workers remain.
- `scripts/doctrine-checks/check-jest-memory-budget.mjs`,
  `check-vitest-memory-budget.mjs`, and
  `check-playwright-workers-budget.mjs` own the enforceable limits. Do not add
  exceptions or change baselines merely to make a run green.
- Capture noisy command output outside the repository and read the failure
  block plus final summary. Never suppress failure evidence.

## Backend conventions

- Backend application code is ESM `.mjs`. Use `import`/`export`; include `.mjs`
  on relative backend imports. Never introduce `require()` or copy old `.js`
  examples.
- Use camelCase for JavaScript identifiers and PascalCase for classes and React
  components. Match names to the live Prisma schema rather than translating
  them into a second naming system.
- Before treating a Prisma `Json` value as an object, reject `null`, arrays,
  and primitives:

  ```js
  const value =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  ```

- Register static and specific routes before parameter catch-alls such as
  `/:id`. Route order is behavior in Express.
- New or changed player-state mutations must use the repository's transaction
  boundary and ownership/security middleware. New route chains must preserve
  the applicable request-pollution guards; derive the exact middleware from
  neighboring live routes and security tests.
- Breeding or two-parent operations reject `sireId === damId` before database
  work.

## Module public API boundaries

- Cross-module production imports under `backend/modules/` go through the
  target module's `index.mjs`; same-module imports may use internal paths.
- Domain behavior belongs in its domain module. Top-level services are for
  genuinely cross-cutting infrastructure. Do not extend legacy placement just
  because it exists.
- The ESLint boundary is authoritative. If the desired symbol is not exported,
  update the module barrel instead of bypassing the rule.

## Test organization and fixtures

- Module-owned tests belong in `backend/modules/<domain>/__tests__/`.
  Cross-module and cross-cutting security/integration tests may live in the
  applicable `backend/__tests__/` subtree.
- Backend tests use the real database and scoped cleanup. Never use a bare
  table-wide `deleteMany()` or assume fixture ordering/count dominance.
- Horse fixtures created through raw Prisma calls must include the current
  canonical color fields, normally through `fixtureColor()`. Prefer the live
  `createTestHorse()` helper for new tests. ESLint and fixture sentinels own the
  exact allowed shape.
- A doctrine/sentinel test must prove that its detector fires on a planted
  violation as well as passes on compliant code. A check that only stays green
  can be vacuous.

## CLI scripts and destructive side effects

Any script capable of writes, migrations, DDL, destructive cleanup, or process
execution must be import-safe. Put side effects in `main()` and guard the direct
entry point with a Windows-safe ESM comparison:

```js
import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

Never construct `file://` URLs manually. The destructive-script sentinel owns
the full detection boundary.

## File-size ratchet

- Current thresholds are 600 raw lines for production source and 800 for test
  files, with a shrink-only legacy baseline.
- `scripts/doctrine-checks/check-file-size-thresholds.mjs` and its baseline are
  authoritative. A baselined file may not grow past its recorded count.
- Prune or lower a baseline entry when the file shrinks. New or raised
  exceptions require an owner-approved, issue-named reason; they are not a
  routine escape hatch.
