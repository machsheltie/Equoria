# Deferred Major Dependency Migrations — Risk / Effort / Sequencing Spike

**Issue:** Equoria-r30sb (research/planning spike — NO code or version changes made here)
**Date:** 2026-05-21
**Author:** automated spike (Claude Opus 4.7)
**Scope:** Express v4→v5, ESLint v8→v10 (flat config), Jest v29→v30, TypeScript v5→v6, React Router v6→v7

> This document is grounded in the ACTUAL state of the Equoria repo as of the
> commit it ships against. Every blast-radius claim was produced by grepping
> the repo, not by generic migration-guide recall. Current versions were read
> from `package.json` (root / `backend/` / `frontend/`) and the live config
> files. Each migration gets its own follow-up bd issue per the anti-bundling
> rule (`OPTIMAL_FIX_DISCIPLINE.md` §3 / `EDGE_CASE_FIX_DISCIPLINE.md` §7).

---

## Current versions (verified from package.json + configs)

| Tool | Root | backend/ | frontend/ | Config style today |
|------|------|----------|-----------|--------------------|
| Express | `^4.18.2` (dep) | `^4.18.2` (dep) | n/a | classic app + routers |
| ESLint | `^8.57.0` + `@eslint/js ^9.39.2` + `typescript-eslint ^8.50.0` | `^8.57.0` + `@eslint/js ^9.28.0` | `^8.57.0` + `@eslint/js ^8.57.0` | **flat config already** (`eslint.config.js`, `backend/eslint.config.mjs`) |
| Jest | `^29.7.0` (+ `babel-jest ^30.1.1`, `jest-environment-jsdom ^30.1.1`, `jest-environment-node ^30.2.0` already on 30) | `^29.7.0` | **none** (frontend uses Vitest 4) | ESM via `--experimental-vm-modules`, `transform: {}` |
| TypeScript | `^5.3.0` | n/a (backend is `.mjs`, no TS) | `^5.2.2` | `tsconfig.json` (frontend permissive, `strict:false`) |
| React Router | n/a | n/a | `react-router-dom ^6.20.0` | `<BrowserRouter>/<Routes>/<Route>` with **v7 future flags already set** |

Two findings that materially lower effort below the CLAUDE.md headline estimate:

1. **ESLint is already on flat config.** Both `eslint.config.js` (root) and
   `backend/eslint.config.mjs` are flat-config files. There is NO `.eslintrc.*`
   in the active tree (only inside `.archive/`). The "flat config required"
   prerequisite for ESLint 9/10 is **already satisfied**.
2. **React Router already opts into the v7 future flags.** `frontend/src/App.tsx`
   sets `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` on
   `<BrowserRouter>`. The two behavioral breaking changes that bite v6→v7
   migrators are already pre-adopted.

---

## 1. Express v4 → v5

**Current:** `express ^4.18.2` (root + backend). Backend mounts classic routers
under `/api` and `/api/v1`; one SPA/404 catch-all at `backend/app.mjs:748`.

### Breaking changes that matter
- **`path-to-regexp` v8 upgrade.** Express 5 swaps the route-path parser. Bare
  `*` wildcards, optional `:param?`, and inline regex route patterns are no
  longer valid syntax — `*` must become a named splat (`/*splat` or `/{*splat}`),
  `:param?` becomes `{:param}`.
- Removed methods/aliases: `app.del()` → `app.delete()`, `req.param(name)`,
  `res.send(status)` / `res.json(status)` / `res.redirect(url, status)` legacy
  signatures, `res.sendfile()` → `res.sendFile()`, `app.configure()`.
- `req.host` now returns the full host incl. port (was hostname-only).
- Rejected-promise handling: async route handlers that reject now forward to
  the error handler automatically (behavior improvement, not a break for us).
- `express.urlencoded({ extended: ... })` default flipped to `false`.

### Blast radius in THIS codebase (grepped)
- **One real blocker:** `backend/app.mjs:748` → `app.use('*', (req, res) => …)`
  SPA/404 fallback. Under Express 5 the bare `'*'` string is invalid
  path-to-regexp syntax. Fix: change to `app.use((req, res) => …)` (no path —
  matches all) or `app.use('/{*splat}', …)`. **This is the single source-code
  change required.**
- **No** `app.del(`, `req.param(`, `res.send(<status>)`, `res.json(<status>)`,
  `res.sendfile`, `app.configure`, or `res.redirect(<status>)` legacy usages
  found in `backend/` source. (The 4 `http.del(` hits are k6 load-test HTTP
  client calls, not Express — false positives.)
- **No** regex/optional route-path patterns in `backend/routes/` (grep for
  `(?:`, `[^/]`, `(.*)`, `:param?`, `:param*` → zero source matches). The
  module routers all use plain string paths + `/:id` style params, which are
  v5-safe.
- `express.urlencoded` extended-default flip: verify the body parser config in
  `app.mjs` sets `extended` explicitly (the prototype-pollution `verifyUrlEncodedBody`
  guard interacts with urlencoded bodies — see SECURITY.md).
- Helmet `^7.1.0`, cors `^2.8.5`, compression `^1.8.1`, express-rate-limit
  `^7.1.5`, express-validator `^7.0.1`, swagger-ui-express `^5.0.1` are all
  Express-5-compatible at current majors (express-validator 7 and helmet 7
  declare Express 5 peer support; verify at upgrade time).

### Effort: **LOW–MEDIUM (S/M)**
Surprisingly small because the codebase uses plain string routes. Realistic
work: 1 mandatory code change (the `'*'` fallback) + a careful pass over the
~6 Express-ecosystem middleware deps to confirm Express 5 peer support, + a
full backend Jest run (real DB) to catch behavioral surprises. ~0.5–1 day.

### Prerequisites
- None blocking. Independent of the other 4.
- Should run AFTER Jest 30 only if you want the post-upgrade verification suite
  on the newest runner — but not a hard dependency.

---

## 2. ESLint v8 → v10 (flat config)

**Current:** `eslint ^8.57.0` everywhere, but already running **flat config**
(`eslint.config.js`, `backend/eslint.config.mjs`) with `@eslint/js` and
`typescript-eslint ^8.x`.

### Breaking changes that matter
- ESLint 9 made flat config the default and **removed eslintrc support**
  (eslintrc fully removed in 10). → **non-issue, already on flat config.**
- ESLint 9/10 removed many formatting/stylistic core rules (`indent`,
  `comma-dangle`, `quotes`, `semi`, `space-*`, `brace-style`, etc.) — they were
  deprecated in 8.53 and **removed from the core in 9**, relocated to
  `@stylistic/eslint-plugin`.
- `context.getScope()` / several `context.*` methods removed (affects custom
  rules/plugins).
- Node engine floor raised (ESLint 9 needs Node ≥18.18; 10 needs ≥20 — repo is
  on Node ≥22, fine).
- `reportUnusedDisableDirectives` config shape moved under `linterOptions`
  (already done in root config).

### Blast radius in THIS codebase (grepped + read)
- **`backend/eslint.config.mjs` is the big one.** It hard-codes ~30 core
  *stylistic* rules that ESLint 9+ removes from core:
  `array-bracket-spacing`, `block-spacing`, `brace-style`, `comma-dangle`,
  `comma-spacing`, `comma-style`, `computed-property-spacing`, `eol-last`,
  `func-call-spacing`, `key-spacing`, `keyword-spacing`, `no-multiple-empty-lines`,
  `no-trailing-spaces`, `object-curly-spacing`, `quotes`, `semi`,
  `semi-spacing`, `space-before-blocks`, `space-before-function-paren`,
  `space-in-parens`, `space-infix-ops`, `space-unary-ops`, `arrow-spacing`,
  `rest-spread-spacing`, `template-curly-spacing`. Under ESLint 9+ these become
  unknown-rule errors. **Fix:** either (a) add `@stylistic/eslint-plugin` and
  prefix these to `@stylistic/*`, or (b) **delete them entirely** since Prettier
  (`prettier 3.8.3`, run via lint-staged) is already declared the source of
  truth for whitespace in the same config (see the `indent: 'off'` comment).
  Option (b) is cleaner and removes a Prettier/ESLint double-source.
- **Custom inline plugin MUST survive.** `equoria/no-raw-test-horse-create`
  (defined in `backend/eslint-plugins/no-raw-test-horse-create.mjs`, imported
  by BOTH configs) and the inline `no-restricted-syntax` AST sentinels
  (`.js`-import ban, `Date.now()+Math.random()` fixture-ID ban, vi.mock-of-api-client
  ban). These use the rule object API (`create(context)`); verify against any
  removed `context.*` methods in ESLint 10. The custom plugin is plain
  `meta`/`create` — low risk, but it is load-bearing for CLAUDE.md doctrine and
  MUST be re-verified post-upgrade.
- `typescript-eslint ^8.50.0` already supports flat config + ESLint 9; check
  its peer range for ESLint 10 at upgrade time (may need typescript-eslint 9).
- `eslint-config-prettier ^10.1.8`, `eslint-plugin-prettier ^5.5.4`,
  `eslint-plugin-import ^2.31.0` — confirm ESLint 10 peer support.
- Frontend dev-dep oddity: `frontend/package.json` pins `@eslint/js ^8.57.0`
  while root is `^9.39.2`. Align during this migration.

### Effort: **MEDIUM (M)**
The flat-config prerequisite is already done (the headline scary part). Real
work is the stylistic-rule removal in `backend/eslint.config.mjs` + plugin
peer-range bumps + a sentinel-positive re-test that the custom `equoria/*`
rule still FIRES (per OPTIMAL_FIX_DISCIPLINE §2). ~0.5–1 day.

### Prerequisites
- None blocking. Independent. Best done as its own PR because it touches the
  lint gate that every other PR rides through.

---

## 3. Jest v29 → v30

**Current:** `jest ^29.7.0` (root + backend). Frontend does **not** use Jest
(Vitest 4). Several Jest-ecosystem packages are **already on 30** in root
(`babel-jest ^30.1.1`, `jest-environment-jsdom ^30.1.1`, `jest-environment-node ^30.2.0`)
— a version-skew that should be reconciled. ESM is run natively via
`node --experimental-vm-modules` + `transform: {}` + `moduleNameMapper`
`.js`→`$1` rewrite.

### Breaking changes that matter
- Node engine floor raised to ≥18 (repo is ≥22, fine).
- `jest-environment-jsdom` / `-node` are separate packages (already true here).
- Snapshot format changes (printBasicPrototype etc.) — can churn `.snap` files.
- `expect` aliases removed/tightened; some matcher behaviors stricter.
- `testPathPattern` → `testPathPatterns` (CLI flag rename) — used in
  `backend/package.json` `test:integration` script (`--testPathPattern=integration`).
- `--experimental-vm-modules` still required for native ESM in 30 (no native
  replacement yet) — no change to the ESM strategy.
- `errorOnDeprecated: true` (set in both jest configs) means any deprecated API
  call will hard-fail under 30 — this is good (surfaces issues) but may light
  up red on first run.

### Blast radius in THIS codebase (grepped + read)
- **Config files:** `jest.config.js` (root, monorepo projects: backend + unit),
  `backend/jest.config.mjs`, `backend/jest.config.optimized.mjs`,
  `backend/jest.config.performance.mjs`, `backend/jest.config.security.mjs`.
  All use `preset: null`, `transform: {}`, `moduleNameMapper`, `globals.jest.useESM`.
  The `globals['ts-jest']` block in root config is dead (no ts-jest dep) — can
  drop. Verify `globals.jest.useESM` is still honored in 30 (it is).
- **CLI flag rename:** `backend/package.json` `test:integration` uses
  `--testPathPattern=integration` → must become `--testPathPatterns=integration`
  under Jest 30. One-line script fix.
- **`@jest/globals ^29.7.0`** (root + backend) and `@jest/test-sequencer ^29.7.0`
  (backend) must bump to 30 in lockstep with `jest`.
- **`jest-junit`** version skew: root `^16.0.0`, backend `^17.0.0` — both are
  Jest-30-compatible; align.
- **Snapshot churn risk:** grep for `toMatchSnapshot`/`.snap` to size the
  re-baseline (do at upgrade time). Backend is API/DB-integration heavy with
  few snapshots, so likely small.
- **Real-DB suite gate:** the pre-push hook runs the full backend Jest suite
  (~3617 tests / 226 suites, ~10 min). Jest 30 verification = one full real-DB
  run, which is the dominant time cost.
- Frontend is unaffected (Vitest), so no jsdom/React-testing churn from Jest 30.

### Effort: **MEDIUM (M)**
Config is already ESM-clean and on the `transform: {}` strategy, so the upgrade
is mostly version bumps + the `testPathPatterns` rename + reconciling the
already-30 sub-packages + one full real-DB suite run to shake out
`errorOnDeprecated` hits and snapshot churn. ~1 day (dominated by suite runtime
+ triage).

### Prerequisites
- None blocking. Independent. Reconcile the babel-jest/jest-environment-*
  version skew as part of this issue (they were bumped to 30 already without
  the core).

---

## 4. TypeScript v5 → v6

**Current:** `typescript ^5.3.0` (root), `^5.2.2` (frontend). **Backend is
plain `.mjs` — no TypeScript.** TS only governs the frontend (`frontend/tsconfig.json`,
permissive: `strict:false`, `noImplicitAny:false`, `moduleResolution:"bundler"`)
and the root `tsconfig.json` (`strict:true`, `moduleResolution:"node"`, used by
`npm run typecheck`).

> Note: TypeScript 6.0 is on the post-5.x roadmap (the 5.x line is mid-flight
> as of this spike). This assessment is forward-looking; pin the exact 6.0
> breaking-change list from the TS release notes at execution time.

### Breaking changes that matter (expected, per TS roadmap)
- TS 6.0 is the bridge release toward the native (Go) compiler (TS 7); 6.0
  primarily **removes already-deprecated 5.x flags** and turns deprecation
  warnings into errors. Deprecated flags include `--target ES3`,
  `--out` (use `--outFile`), `--noImplicitUseStrict`, `--keyofStringsOnly`,
  `--suppressExcessPropertyErrors`, `--charset`, `--importsNotUsedAsValues`
  (→ `verbatimModuleSyntax`), `--preserveValueImports`, `--moduleResolution node`
  (→ `node10`, with a likely deprecation/rename).
- Lib.d.ts updates can surface new type errors in strict code.
- `moduleResolution: "node"` (root tsconfig) is the classic Node resolution
  that TS has been steering away from — likely renamed to `node10` and
  deprecation-flagged.

### Blast radius in THIS codebase (read)
- **`tsconfig.json` (root):** uses `moduleResolution: "node"` — most likely to
  need a rename to `node10` (or switch to `bundler`/`nodenext`). `strict:true`
  here means lib.d.ts changes could surface new errors in the typechecked
  frontend source. This is the file `npm run typecheck` uses.
- **`frontend/tsconfig.json`:** `moduleResolution: "bundler"` (modern, safe),
  but `allowImportingTsExtensions:true` + `strict:false` + all strictness off.
  The permissive posture means TS 6 is *unlikely* to break the build, but also
  means the codebase has latent type debt that TS 6 won't catch (and shouldn't
  be relied on to).
- **No deprecated flags found** in either tsconfig (`no out`, `no charset`, `no
  importsNotUsedAsValues`, `no keyofStringsOnly`). The only at-risk setting is
  root `moduleResolution: "node"`.
- TS version is shared with `vite` (frontend `build: "tsc && vite build"`) and
  `@vitejs/plugin-react` — confirm those tolerate TS 6 at upgrade time.
- `@types/node`, `@types/react ^18.x`, `@types/react-dom ^18.x` (frontend types
  still on React 18 types while runtime is React 19 — a separate latent issue,
  do NOT bundle here).

### Effort: **LOW–MEDIUM (S/M)**
Backend has zero TS. Frontend is permissive (`strict:false`), so the surface for
new type errors is small. The most likely concrete change is the root
`moduleResolution` rename + a `tsc --noEmit` typecheck pass. ~0.5 day. Risk is
mostly "wait for the actual TS 6.0 release notes" rather than codebase scope.

### Prerequisites
- **Wait for TS 6.0 GA** and its published breaking-change list (forward-looking
  as of this spike).
- Independent of the other 4. Pairs naturally with a React-types bump (separate
  issue) but must not be bundled.

---

## 5. React Router v6 → v7

**Current:** `react-router-dom ^6.20.0` (frontend). Component-based routing
(`<BrowserRouter>/<Routes>/<Route>`), used across **80 files / 132+ import
sites**. App.tsx **already sets the v7 future flags**.

### Breaking changes that matter
- RR 7 merges into the Remix lineage; `react-router-dom` is largely re-exported
  from `react-router` (the package import path may shift — `react-router-dom`
  still works but `react-router` becomes canonical for many APIs).
- The two behavioral breaks (`v7_startTransition`, `v7_relativeSplatPath`) are
  **already opted into** via `future={{...}}` in App.tsx → no behavioral surprise.
- Node/React floors raised (repo on Node ≥22, React 19 — fine).
- Data-router-only flags (`v7_fetcherPersist`, `v7_normalizeFormMethod`,
  `v7_partialHydration`, `v7_skipActionErrorRevalidation`) are **N/A** — this app
  uses the component router, not `createBrowserRouter`/loaders/actions (grep:
  zero `createBrowserRouter`, `RouterProvider`, `useLoaderData`, `defer`).
- TypeScript route-typing / typegen is a new v7 feature (opt-in, not required).

### Blast radius in THIS codebase (grepped)
- **80 files import `react-router-dom`**, ~132+ call sites of `useNavigate`,
  `useParams`, `useSearchParams`, `<Routes>`, `<Route>`, `<Outlet>`, `NavLink`,
  `<BrowserRouter>`. All are stable component-router APIs retained in v7.
- **Zero data-router APIs** (no `createBrowserRouter`, `RouterProvider`,
  `useLoaderData`, `useActionData`, `defer`) — the entire class of v7 data-API
  breaking changes does not apply.
- Future flags already set → the migration is essentially: bump the package,
  (optionally) remove the now-default `future` flags, update the import
  specifier where guidance recommends `react-router` over `react-router-dom`,
  and run the frontend Vitest suite (40 router-touching test files found).
- `frontend/src/test/utils.tsx` wraps tests in a router — verify the test
  harness against v7.

### Effort: **LOW–MEDIUM (S/M)**
The proactive future-flag adoption removes the hard part. Risk is the volume of
touchpoints (80 files) for any import-path change, but those are mechanical.
~0.5–1 day, dominated by running/triaging the 40 router-touching frontend test
files. Lowest *behavioral* risk of the five.

### Prerequisites
- None blocking. Independent.

---

## Recommended sequence

All five are **technically independent** (no migration hard-depends on another).
Sequencing is therefore by *risk isolation and verification leverage*, not by
dependency:

1. **ESLint 9/10 first.** It touches the lint gate every other PR rides through;
   landing it first means subsequent migration PRs are linted by the final
   toolchain. Self-contained, flat-config prerequisite already met.
2. **Jest 30 second.** It is the verification harness for the backend. Getting
   the test runner onto its final major means the Express 5 PR is verified on
   the runner it will live with. Reconciles the existing 30-vs-29 skew.
3. **Express 5 third.** Tiny code surface (one `'*'` fallback) but it is the
   only *runtime/production-path* change of the five; land it on the final lint
   + test toolchain so its real-DB verification run is authoritative.
4. **React Router 7** and **5. TypeScript 6** — both frontend-only, both low
   behavioral risk, can be done **in either order or in parallel** with the
   backend track (1–3). RR 7 is ready now; TS 6 should **wait for TS 6.0 GA**.

**Parallelizable:** the backend track (ESLint→Jest→Express) and the frontend
track (RR 7; TS 6 when GA) touch disjoint files and can proceed concurrently by
different sessions. ESLint 9/10 is the one cross-cutting item (lints both
trees), so land it before the others if a single sequential order is preferred.

---

## What was NOT done (per OPTIMAL_FIX_DISCIPLINE §6)

- **No package versions changed**, no `npm install`/upgrade, no lockfile edits.
  This is planning only (AC4).
- **No migration executed.** No `'*'`→`/{*splat}` edit, no stylistic-rule
  removal, no config rewrites — each is the job of its own follow-up PR.
- **Context7/WebSearch breaking-change lists were not exhaustively pulled** for
  every library; the assessment relies on grounded repo greps + current
  library-major knowledge. TS 6.0 in particular is forward-looking — its exact
  breaking-change list must be pinned from the official release notes at
  execution time (flagged in §4).
- **No audit of transitive peer-dependency conflicts** (e.g. exact Express-5
  peer ranges of helmet/cors/express-validator, ESLint-10 peer ranges of
  typescript-eslint/eslint-plugin-import). Each follow-up issue must run
  `npm ls`/`npm install --dry-run` against its target majors before coding.
- **Adjacent latent issues surfaced but NOT bundled** (file separately if
  pursued): frontend `@eslint/js` pinned at `^8.57.0` vs root `^9.39.2`;
  frontend React *types* on `@types/react ^18` while runtime is React 19;
  dead `globals['ts-jest']` block in `jest.config.js`.
